const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { signedGetUrl } = require("../lib/s3");

const router = express.Router();

const isValidUUID = (id) =>
  typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function canSeeAlbum(album, userId) {
  if (!album) return false;
  if (album.owner_id === userId) return true;
  const member = await pool.query(
    `SELECT 1 FROM album_members WHERE album_id = $1 AND user_id = $2`,
    [album.id, userId],
  );
  if (member.rows[0]) return true;
  if (album.visibility === "friends") {
    const friend = await pool.query(
      `SELECT 1 FROM friendships
       WHERE status = 'accepted'
         AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))`,
      [userId, album.owner_id],
    );
    return Boolean(friend.rows[0]);
  }
  return album.visibility === "link";
}

async function loadMembers(albumId) {
  const result = await pool.query(
    `SELECT m.user_id, m.role, u.display_name, u.username, u.avatar_url
     FROM album_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.album_id = $1
     ORDER BY m.joined_at ASC`,
    [albumId],
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    role: row.role,
    name: row.display_name || row.username || "",
    username: row.username || "",
    avatar: row.avatar_url || "",
  }));
}

async function loadAlbumPhotos(albumId) {
  const result = await pool.query(
    `SELECT ph.id, ph.post_id, ph.object_key, ph.sort_order, ph.width, ph.height,
            ph.taken_at, ph.created_at, p.caption, p.tags, p.owner_id,
            u.display_name, u.username
     FROM photos ph
     JOIN posts p ON p.id = ph.post_id
     JOIN users u ON u.id = p.owner_id
     WHERE p.album_id = $1
     ORDER BY ph.taken_at DESC NULLS LAST, ph.created_at DESC`,
    [albumId],
  );
  return Promise.all(
    result.rows.map(async (row) => ({
      id: row.id,
      postId: row.post_id,
      src: await signedGetUrl(row.object_key),
      thumb: await signedGetUrl(row.object_key),
      objectKey: row.object_key,
      width: row.width,
      height: row.height,
      taken: row.taken_at,
      uploaded: row.created_at,
      caption: row.caption || "",
      tags: row.tags || [],
      uploaderId: row.owner_id,
      uploaderName: row.display_name || row.username || "",
      sortOrder: row.sort_order,
    })),
  );
}

async function shapeAlbum(row, userId, { withPhotos = false } = {}) {
  const members = await loadMembers(row.id);
  const owner = await pool.query(
    `SELECT display_name, username FROM users WHERE id = $1`,
    [row.owner_id],
  );
  const ownerName = owner.rows[0]?.display_name || owner.rows[0]?.username || "";
  const memberRows = [
    { userId: row.owner_id, role: "owner", name: ownerName, username: owner.rows[0]?.username || "", avatar: "" },
    ...members,
  ];
  const photos = withPhotos ? await loadAlbumPhotos(row.id) : [];
  let coverUrl = "";
  if (row.cover_photo_id) {
    const cover = await pool.query(`SELECT object_key FROM photos WHERE id = $1`, [row.cover_photo_id]);
    if (cover.rows[0]) coverUrl = await signedGetUrl(cover.rows[0].object_key);
  } else if (photos[0]) {
    coverUrl = photos[0].src;
  } else {
    const first = await pool.query(
      `SELECT ph.object_key FROM photos ph
       JOIN posts p ON p.id = ph.post_id
       WHERE p.album_id = $1
       ORDER BY ph.sort_order ASC, ph.created_at ASC LIMIT 1`,
      [row.id],
    );
    if (first.rows[0]) coverUrl = await signedGetUrl(first.rows[0].object_key);
  }
  const count = await pool.query(
    `SELECT COUNT(*)::int AS n FROM photos ph
     JOIN posts p ON p.id = ph.post_id WHERE p.album_id = $1`,
    [row.id],
  );
  return {
    id: row.id,
    name: row.name,
    visibility: row.visibility,
    ownerId: row.owner_id,
    allowComments: row.allow_comments !== false,
    coverId: row.cover_photo_id || "",
    coverUrl,
    created: row.created_at,
    updatedAt: row.updated_at,
    photoCount: count.rows[0]?.n || 0,
    members: memberRows,
    sharedWithMe: row.owner_id !== userId,
    photos,
  };
}

/** GET /api/albums */
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT a.*
       FROM albums a
       LEFT JOIN album_members m ON m.album_id = a.id
       WHERE a.owner_id = $1
          OR m.user_id = $1
          OR (
            a.visibility = 'friends'
            AND EXISTS (
              SELECT 1 FROM friendships f
              WHERE f.status = 'accepted'
                AND (
                  (f.user_id = $1 AND f.friend_id = a.owner_id)
                  OR (f.friend_id = $1 AND f.user_id = a.owner_id)
                )
            )
          )
       ORDER BY a.updated_at DESC`,
      [req.user.id],
    );
    const albums = [];
    for (const row of result.rows) {
      albums.push(await shapeAlbum(row, req.user.id, { withPhotos: true }));
    }
    return res.json({ albums });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load albums." });
  }
});

/** GET /api/albums/favorites */
router.get("/favorites", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT post_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id],
    );
    return res.json({ favorites: result.rows.map((row) => row.post_id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load favorites." });
  }
});

/** PUT /api/albums/favorites/:postId — toggle on */
router.put("/favorites/:postId", requireAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    if (!isValidUUID(postId)) return res.status(400).json({ error: "Invalid post." });
    const post = await pool.query(`SELECT id FROM posts WHERE id = $1`, [postId]);
    if (!post.rows[0]) return res.status(404).json({ error: "Post not found." });
    await pool.query(
      `INSERT INTO favorites (user_id, post_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, postId],
    );
    return res.json({ favorited: true, postId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not save favorite." });
  }
});

/** DELETE /api/albums/favorites/:postId */
router.delete("/favorites/:postId", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM favorites WHERE user_id = $1 AND post_id = $2`,
      [req.user.id, req.params.postId],
    );
    return res.json({ favorited: false, postId: req.params.postId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not remove favorite." });
  }
});

/** POST /api/albums — { name, visibility? } */
router.post("/", requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Give the album a name." });
    const visibility = ["private", "friends", "link"].includes(req.body?.visibility)
      ? req.body.visibility
      : "private";
    let allowComments = true;
    const settings = await pool.query(`SELECT settings FROM users WHERE id = $1`, [req.user.id]);
    if (settings.rows[0]?.settings?.privacy?.allowAlbumComments === false) allowComments = false;

    const existing = await pool.query(
      `SELECT * FROM albums WHERE owner_id = $1 AND lower(name) = lower($2) LIMIT 1`,
      [req.user.id, name],
    );
    if (existing.rows[0]) {
      return res.status(200).json({ album: await shapeAlbum(existing.rows[0], req.user.id) });
    }

    const result = await pool.query(
      `INSERT INTO albums (owner_id, name, visibility, allow_comments)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, name, visibility, allowComments],
    );
    return res.status(201).json({ album: await shapeAlbum(result.rows[0], req.user.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not create album." });
  }
});

/** GET /api/albums/:id */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) return res.status(404).json({ error: "Album not found." });
    const result = await pool.query(`SELECT * FROM albums WHERE id = $1`, [req.params.id]);
    const row = result.rows[0];
    if (!row || !(await canSeeAlbum(row, req.user.id))) {
      return res.status(404).json({ error: "Album not found." });
    }
    return res.json({ album: await shapeAlbum(row, req.user.id, { withPhotos: true }) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load album." });
  }
});

/** PATCH /api/albums/:id */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM albums WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Album not found." });

    const name = "name" in (req.body || {}) ? String(req.body.name || "").trim() : row.name;
    if (!name) return res.status(400).json({ error: "Give the album a name." });
    const visibility = "visibility" in (req.body || {}) && ["private", "friends", "link"].includes(req.body.visibility)
      ? req.body.visibility
      : row.visibility;
    const allowComments = "allowComments" in (req.body || {})
      ? Boolean(req.body.allowComments)
      : row.allow_comments;
    let coverPhotoId = row.cover_photo_id;
    if ("coverPhotoId" in (req.body || {}) || "coverId" in (req.body || {})) {
      const next = req.body.coverPhotoId ?? req.body.coverId ?? null;
      coverPhotoId = next && isValidUUID(String(next)) ? String(next) : null;
    }

    const updated = await pool.query(
      `UPDATE albums SET name = $2, visibility = $3, allow_comments = $4,
         cover_photo_id = $5, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [row.id, name, visibility, allowComments, coverPhotoId],
    );
    return res.json({ album: await shapeAlbum(updated.rows[0], req.user.id, { withPhotos: true }) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not update album." });
  }
});

/** DELETE /api/albums/:id */
router.delete("/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id FROM albums WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Album not found." });
    }
    await client.query(`UPDATE posts SET album_id = NULL WHERE album_id = $1`, [req.params.id]);
    await client.query(
      `UPDATE share_links SET revoked_at = NOW()
       WHERE kind = 'album' AND target_id = $1 AND revoked_at IS NULL`,
      [req.params.id],
    );
    await client.query(`DELETE FROM albums WHERE id = $1`, [req.params.id]);
    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    return res.status(500).json({ error: "Could not delete album." });
  } finally {
    client.release();
  }
});

/** GET /api/albums/:id/members */
router.get("/:id/members", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM albums WHERE id = $1`, [req.params.id]);
    if (!result.rows[0] || !(await canSeeAlbum(result.rows[0], req.user.id))) {
      return res.status(404).json({ error: "Album not found." });
    }
    return res.json({ members: await loadMembers(req.params.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load members." });
  }
});

/** POST /api/albums/:id/members — { userId, role? } */
router.post("/:id/members", requireAuth, async (req, res) => {
  try {
    const album = await pool.query(
      `SELECT * FROM albums WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!album.rows[0]) return res.status(404).json({ error: "Album not found." });
    const userId = String(req.body?.userId || "");
    if (!isValidUUID(userId) || userId === req.user.id) {
      return res.status(400).json({ error: "Choose a friend to share with." });
    }
    const friend = await pool.query(
      `SELECT 1 FROM friendships
       WHERE status = 'accepted'
         AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))`,
      [req.user.id, userId],
    );
    if (!friend.rows[0]) return res.status(400).json({ error: "You can only share with friends." });
    const role = req.body?.role === "contributor" ? "contributor" : "viewer";
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (album_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, userId, role],
    );
    if (album.rows[0].visibility === "private") {
      await pool.query(`UPDATE albums SET visibility = 'friends', updated_at = NOW() WHERE id = $1`, [
        req.params.id,
      ]);
    }
    const refreshed = await pool.query(`SELECT * FROM albums WHERE id = $1`, [req.params.id]);
    return res.status(201).json({ album: await shapeAlbum(refreshed.rows[0], req.user.id, { withPhotos: true }) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not add member." });
  }
});

/** DELETE /api/albums/:id/members/:userId */
router.delete("/:id/members/:userId", requireAuth, async (req, res) => {
  try {
    const album = await pool.query(
      `SELECT * FROM albums WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!album.rows[0]) return res.status(404).json({ error: "Album not found." });
    await pool.query(
      `DELETE FROM album_members WHERE album_id = $1 AND user_id = $2`,
      [req.params.id, req.params.userId],
    );
    const left = await pool.query(
      `SELECT COUNT(*)::int AS n FROM album_members WHERE album_id = $1`,
      [req.params.id],
    );
    if (!left.rows[0]?.n && album.rows[0].visibility !== "link") {
      await pool.query(`UPDATE albums SET visibility = 'private', updated_at = NOW() WHERE id = $1`, [
        req.params.id,
      ]);
    }
    const refreshed = await pool.query(`SELECT * FROM albums WHERE id = $1`, [req.params.id]);
    return res.json({ album: await shapeAlbum(refreshed.rows[0], req.user.id, { withPhotos: true }) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not remove member." });
  }
});

module.exports = router;
