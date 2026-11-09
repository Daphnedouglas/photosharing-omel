const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { deleteObjectKeys, signedGetUrl } = require("../lib/s3");

const router = express.Router();

const isValidUUID = (id) =>
  typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** POST /api/posts — { caption?, visibility?, albumId?, photos: [{ objectKey, width?, height?, sortOrder?, takenAt? }] } */
router.post("/", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const caption = String(req.body?.caption || "").trim();
    const visibility = req.body?.visibility === "only_me" ? "only_me" : "friends";
    // Reject "", "null", "undefined", local album names, etc. — only real UUIDs.
    const finalAlbumId = isValidUUID(req.body?.albumId) ? req.body.albumId : null;
    const uploaderId = req.user.id;
    const photos = Array.isArray(req.body?.photos) ? req.body.photos : [];
    // Post id is always DB-generated (DEFAULT gen_random_uuid). Do not insert
    // frontend placeholders like "post-…" even if sent as id/postId.

    if (!photos.length) {
      return res.status(400).json({ error: "Add at least one photo." });
    }
    for (const photo of photos) {
      if (!photo?.objectKey) {
        return res.status(400).json({ error: "Each photo needs an objectKey from presign." });
      }
    }

    await client.query("BEGIN");
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((tag) => String(tag || "").trim()).filter(Boolean).slice(0, 20)
      : [];
    const postResult = await client.query(
      `INSERT INTO posts (owner_id, album_id, caption, visibility, tags)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, owner_id, album_id, caption, visibility, tags, created_at`,
      [uploaderId, finalAlbumId, caption, visibility, tags],
    );
    const post = postResult.rows[0];

    const insertedPhotos = [];
    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i];
      const row = await client.query(
        `INSERT INTO photos (post_id, owner_id, object_key, sort_order, width, height, taken_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, post_id, object_key, sort_order, width, height, taken_at, created_at`,
        [
          post.id,
          uploaderId,
          photo.objectKey,
          Number.isFinite(photo.sortOrder) ? photo.sortOrder : i,
          photo.width || null,
          photo.height || null,
          photo.takenAt || null,
        ],
      );
      insertedPhotos.push(row.rows[0]);
    }

    await client.query("COMMIT");
    return res.status(201).json({
      post: {
        id: post.id,
        ownerId: post.owner_id,
        albumId: post.album_id,
        caption: post.caption,
        visibility: post.visibility,
        tags: post.tags || [],
        createdAt: post.created_at,
        photos: insertedPhotos.map((p) => ({
          id: p.id,
          objectKey: p.object_key,
          sortOrder: p.sort_order,
          width: p.width,
          height: p.height,
          takenAt: p.taken_at,
          createdAt: p.created_at,
        })),
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch { /* ignore rollback errors */ }
    console.error("POST /api/posts crash:", err);
    return res.status(500).json({
      error: "could not create post",
      details: err.message,
      db_code: err.code,
    });
  } finally {
    client.release();
  }
});

/** GET /api/posts — own posts + friends-visibility posts from accepted friends */
router.get("/", requireAuth, async (req, res) => {
  try {
    const postsResult = await pool.query(
      `SELECT p.id, p.owner_id, p.album_id, p.caption, p.visibility, p.tags, p.created_at,
              u.username, u.display_name, u.avatar_url
       FROM posts p
       JOIN users u ON u.id = p.owner_id
       WHERE p.owner_id = $1
          OR (
            p.visibility = 'friends'
            AND EXISTS (
              SELECT 1 FROM friendships f
              WHERE f.status = 'accepted'
                AND (
                  (f.user_id = $1 AND f.friend_id = p.owner_id)
                  OR (f.friend_id = $1 AND f.user_id = p.owner_id)
                )
            )
          )
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [req.user.id],
    );

    const postIds = postsResult.rows.map((row) => row.id);
    const reactionMap = new Map();
    if (postIds.length) {
      const reactionResult = await pool.query(
        `SELECT r.post_id, r.user_id, r.reaction, u.username, u.display_name
         FROM reactions r
         JOIN users u ON u.id = r.user_id
         WHERE r.post_id = ANY($1::uuid[])`,
        [postIds],
      );
      for (const row of reactionResult.rows) {
        const list = reactionMap.get(row.post_id) || [];
        list.push(row);
        reactionMap.set(row.post_id, list);
      }
    }

    const posts = [];
    for (const row of postsResult.rows) {
      const photosResult = await pool.query(
        `SELECT id, object_key, sort_order, width, height, taken_at, created_at
         FROM photos
         WHERE post_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [row.id],
      );
      const photos = await Promise.all(
        photosResult.rows.map(async (photo) => ({
          id: photo.id,
          objectKey: photo.object_key,
          url: await signedGetUrl(photo.object_key),
          sortOrder: photo.sort_order,
          width: photo.width,
          height: photo.height,
          takenAt: photo.taken_at,
          createdAt: photo.created_at,
        })),
      );
      posts.push({
        id: row.id,
        ownerId: row.owner_id,
        albumId: row.album_id,
        caption: row.caption,
        visibility: row.visibility,
        tags: row.tags || [],
        createdAt: row.created_at,
        owner: {
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        },
        photos,
        reactions: packReactions(reactionMap.get(row.id) || [], req.user.id),
      });
    }

    return res.json({ posts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load posts." });
  }
});

const REACTION_IDS = ["love", "touched", "haha", "stunning", "thanks"];

function emptyReactionCounts() {
  return Object.fromEntries(REACTION_IDS.map((id) => [id, 0]));
}

function packReactions(rows, userId) {
  const reaction_counts = emptyReactionCounts();
  for (const row of rows) {
    if (reaction_counts[row.reaction] != null) reaction_counts[row.reaction] += 1;
  }
  const mine = rows.find((row) => row.user_id === userId);
  return {
    my_reaction: mine ? mine.reaction : null,
    reaction_counts,
    total: rows.length,
    reactors: rows.map((row) => ({
      user_id: row.user_id,
      name: row.display_name || row.username || "",
      reaction: row.reaction,
    })),
  };
}

async function loadPackedReactions(postId, userId) {
  const result = await pool.query(
    `SELECT r.post_id, r.user_id, r.reaction, u.username, u.display_name
     FROM reactions r
     JOIN users u ON u.id = r.user_id
     WHERE r.post_id = $1`,
    [postId],
  );
  return packReactions(result.rows, userId);
}

/** GET /api/posts/:id/reactions */
router.get("/:id/reactions", requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await pool.query(`SELECT id FROM posts WHERE id = $1`, [postId]);
    if (!post.rows[0]) return res.status(404).json({ error: "Post not found." });
    return res.json(await loadPackedReactions(postId, req.user.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load reactions." });
  }
});

/** PUT /api/posts/:id/reactions — { reaction: "love" | ... | null } */
router.put("/:id/reactions", requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const reaction = req.body?.reaction == null || req.body?.reaction === ""
      ? null
      : String(req.body.reaction);
    if (reaction != null && !REACTION_IDS.includes(reaction)) {
      return res.status(400).json({ error: "That reaction isn't available." });
    }

    const post = await pool.query(`SELECT id FROM posts WHERE id = $1`, [postId]);
    if (!post.rows[0]) return res.status(404).json({ error: "Post not found." });

    if (reaction == null) {
      await pool.query(`DELETE FROM reactions WHERE post_id = $1 AND user_id = $2`, [postId, req.user.id]);
    } else {
      await pool.query(
        `INSERT INTO reactions (user_id, post_id, reaction)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, post_id)
         DO UPDATE SET reaction = EXCLUDED.reaction, created_at = NOW()`,
        [req.user.id, postId, reaction],
      );
    }

    return res.json(await loadPackedReactions(postId, req.user.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not save reaction." });
  }
});

/** GET /api/posts/:id/comments */
router.get("/:id/comments", requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await pool.query(`SELECT id FROM posts WHERE id = $1`, [postId]);
    if (!post.rows[0]) return res.status(404).json({ error: "Post not found." });

    const result = await pool.query(
      `SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
              u.username, u.display_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId],
    );
    return res.json({
      comments: result.rows.map((row) => ({
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        body: row.body,
        createdAt: row.created_at,
        authorName: row.display_name || row.username,
        authorUsername: row.username,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load comments." });
  }
});

/** POST /api/posts/:id/comments — { body } */
router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Comment text is required." });

    const post = await pool.query(`SELECT id FROM posts WHERE id = $1`, [postId]);
    if (!post.rows[0]) return res.status(404).json({ error: "Post not found." });

    const result = await pool.query(
      `INSERT INTO comments (post_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, body, created_at`,
      [postId, req.user.id, body],
    );
    const comment = result.rows[0];
    const author = await pool.query(
      `SELECT username, display_name FROM users WHERE id = $1`,
      [req.user.id],
    );
    const person = author.rows[0];
    return res.status(201).json({
      comment: {
        id: comment.id,
        postId: comment.post_id,
        userId: comment.user_id,
        body: comment.body,
        createdAt: comment.created_at,
        authorName: person?.display_name || person?.username || "",
        authorUsername: person?.username || "",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not add comment." });
  }
});

/** PATCH /api/posts/:id — { caption?, visibility?, albumId?, tags? } */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const current = await pool.query(
      `SELECT * FROM posts WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    const post = current.rows[0];
    if (!post) return res.status(404).json({ error: "Post not found." });

    const caption = "caption" in (req.body || {}) ? String(req.body.caption || "").trim() : post.caption;
    const visibility = "visibility" in (req.body || {})
      ? (req.body.visibility === "only_me" ? "only_me" : "friends")
      : post.visibility;
    let albumId = post.album_id;
    if ("albumId" in (req.body || {})) {
      albumId = isValidUUID(req.body.albumId) ? req.body.albumId : null;
    }
    const tags = "tags" in (req.body || {})
      ? (Array.isArray(req.body.tags) ? req.body.tags.map((t) => String(t || "").trim()).filter(Boolean).slice(0, 20) : [])
      : (post.tags || []);

    const result = await pool.query(
      `UPDATE posts SET caption = $2, visibility = $3, album_id = $4, tags = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING id, owner_id, album_id, caption, visibility, tags, created_at, updated_at`,
      [post.id, caption, visibility, albumId, tags],
    );
    const row = result.rows[0];
    return res.json({
      post: {
        id: row.id,
        ownerId: row.owner_id,
        albumId: row.album_id,
        caption: row.caption,
        visibility: row.visibility,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not update post." });
  }
});

/** PATCH /api/posts/:id/comments/:commentId — { body } */
router.patch("/:id/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Comment text is required." });
    const result = await pool.query(
      `UPDATE comments c SET body = $3, updated_at = NOW()
       FROM posts p
       WHERE c.id = $2 AND c.post_id = $1 AND p.id = c.post_id
         AND (c.user_id = $4 OR p.owner_id = $4)
       RETURNING c.id, c.post_id, c.user_id, c.body, c.created_at, c.updated_at`,
      [req.params.id, req.params.commentId, body, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Comment not found." });
    const row = result.rows[0];
    return res.json({
      comment: {
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        body: row.body,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not update comment." });
  }
});

/** DELETE /api/posts/:id/comments/:commentId */
router.delete("/:id/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM comments c
       USING posts p
       WHERE c.id = $2 AND c.post_id = $1 AND p.id = c.post_id
         AND (c.user_id = $3 OR p.owner_id = $3)
       RETURNING c.id`,
      [req.params.id, req.params.commentId, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Comment not found." });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not delete comment." });
  }
});

/** PATCH /api/posts/:id/photos/reorder — { orderedIds: [] } */
router.patch("/:id/photos/reorder", requireAuth, async (req, res) => {
  try {
    const post = await pool.query(
      `SELECT id FROM posts WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!post.rows[0]) return res.status(404).json({ error: "Post not found." });
    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
    for (let i = 0; i < orderedIds.length; i += 1) {
      await pool.query(
        `UPDATE photos SET sort_order = $3 WHERE id = $1 AND post_id = $2`,
        [orderedIds[i], req.params.id, i],
      );
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not reorder photos." });
  }
});

/** POST /api/posts/:id/photos — { photos: [{ objectKey, ... }] } */
router.post("/:id/photos", requireAuth, async (req, res) => {
  try {
    const post = await pool.query(
      `SELECT id FROM posts WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!post.rows[0]) return res.status(404).json({ error: "Post not found." });
    const photos = Array.isArray(req.body?.photos) ? req.body.photos : [];
    if (!photos.length) return res.status(400).json({ error: "Add at least one photo." });
    const max = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS m FROM photos WHERE post_id = $1`,
      [req.params.id],
    );
    let order = Number(max.rows[0].m) + 1;
    const inserted = [];
    for (const photo of photos) {
      if (!photo?.objectKey) continue;
      const row = await pool.query(
        `INSERT INTO photos (post_id, owner_id, object_key, sort_order, width, height, taken_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, object_key, sort_order, width, height, taken_at, created_at`,
        [
          req.params.id,
          req.user.id,
          photo.objectKey,
          Number.isFinite(photo.sortOrder) ? photo.sortOrder : order,
          photo.width || null,
          photo.height || null,
          photo.takenAt || null,
        ],
      );
      order += 1;
      inserted.push(row.rows[0]);
    }
    await pool.query(`UPDATE posts SET updated_at = NOW() WHERE id = $1`, [req.params.id]);
    return res.status(201).json({
      photos: inserted.map((p) => ({
        id: p.id,
        objectKey: p.object_key,
        sortOrder: p.sort_order,
        width: p.width,
        height: p.height,
        takenAt: p.taken_at,
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not add photos." });
  }
});

/** DELETE /api/posts/:id/photos/:photoId */
router.delete("/:id/photos/:photoId", requireAuth, async (req, res) => {
  try {
    const post = await pool.query(
      `SELECT id FROM posts WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!post.rows[0]) return res.status(404).json({ error: "Post not found." });
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM photos WHERE post_id = $1`,
      [req.params.id],
    );
    if ((count.rows[0]?.n || 0) <= 1) {
      return res.status(400).json({ error: "A post needs at least one photo. Delete the post instead." });
    }
    const photo = await pool.query(
      `DELETE FROM photos WHERE id = $1 AND post_id = $2 RETURNING object_key`,
      [req.params.photoId, req.params.id],
    );
    if (!photo.rows[0]) return res.status(404).json({ error: "Photo not found." });
    await deleteObjectKeys([photo.rows[0].object_key]);
    await pool.query(`UPDATE posts SET updated_at = NOW() WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not delete photo." });
  }
});

/** DELETE /api/posts/:id — owner removes post + S3 objects + related rows */
router.delete("/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const post = await client.query(
      `SELECT id FROM posts WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!post.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Post not found." });
    }
    const keys = await client.query(
      `SELECT object_key FROM photos WHERE post_id = $1`,
      [req.params.id],
    );
    await client.query(`DELETE FROM comments WHERE post_id = $1`, [req.params.id]);
    await client.query(`DELETE FROM reactions WHERE post_id = $1`, [req.params.id]);
    await client.query(`DELETE FROM favorites WHERE post_id = $1`, [req.params.id]);
    await client.query(`DELETE FROM photos WHERE post_id = $1`, [req.params.id]);
    await client.query(`DELETE FROM posts WHERE id = $1`, [req.params.id]);
    await client.query(
      `UPDATE share_links SET revoked_at = NOW()
       WHERE kind = 'post' AND target_id = $1 AND revoked_at IS NULL`,
      [req.params.id],
    );
    await client.query("COMMIT");
    await deleteObjectKeys(keys.rows.map((row) => row.object_key));
    return res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ error: "Could not delete post." });
  } finally {
    client.release();
  }
});

module.exports = router;
