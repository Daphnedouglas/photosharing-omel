const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { signedGetUrl } = require("../lib/s3");

const router = express.Router();

function cleanDate(value) {
  const text = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

/** GET /api/search?q=&uploader=&from=&to=&tag=&comment= */
router.get("/", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || "").trim();
    const uploader = String(req.query.uploader || "").trim();
    const from = cleanDate(req.query.from);
    const to = cleanDate(req.query.to);
    const tag = String(req.query.tag || "").trim();
    const comment = String(req.query.comment || "").trim();
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const tagLike = `%${tag.replace(/[%_]/g, "")}%`;
    const commentLike = `%${comment.replace(/[%_]/g, "")}%`;
    const narrowed = Boolean(q || uploader || from || to || tag || comment);

    const albumsResult = await pool.query(
      `SELECT a.id, a.name, a.visibility, a.owner_id
       FROM albums a
       WHERE (
         a.owner_id = $1
         OR EXISTS (SELECT 1 FROM album_members m WHERE m.album_id = a.id AND m.user_id = $1)
         OR (
           a.visibility = 'friends'
           AND EXISTS (
             SELECT 1 FROM friendships f
             WHERE f.status = 'accepted'
               AND ((f.user_id = $1 AND f.friend_id = a.owner_id) OR (f.friend_id = $1 AND f.user_id = a.owner_id))
           )
         )
       )
       AND ($2 = '' OR a.name ILIKE $3)
       AND ($4 = '' OR a.owner_id::text = $4)
       ORDER BY a.updated_at DESC
       LIMIT 40`,
      [req.user.id, q, like, uploader],
    );

    const postsResult = await pool.query(
      `SELECT p.id, p.caption, p.album_id, p.tags, p.created_at, p.owner_id,
              u.display_name, u.username, a.name AS album_name,
              (
                SELECT ph.taken_at
                FROM photos ph
                WHERE ph.post_id = p.id
                ORDER BY ph.sort_order ASC, ph.created_at ASC
                LIMIT 1
              ) AS taken_at
       FROM posts p
       JOIN users u ON u.id = p.owner_id
       LEFT JOIN albums a ON a.id = p.album_id
       WHERE (
         p.owner_id = $1
         OR (
           p.visibility = 'friends'
           AND EXISTS (
             SELECT 1 FROM friendships f
             WHERE f.status = 'accepted'
               AND ((f.user_id = $1 AND f.friend_id = p.owner_id) OR (f.friend_id = $1 AND f.user_id = p.owner_id))
           )
         )
       )
       AND (
         $2 = ''
         OR p.caption ILIKE $3
         OR u.display_name ILIKE $3
         OR u.username ILIKE $3
         OR COALESCE(a.name, '') ILIKE $3
         OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE $3)
         OR EXISTS (
           SELECT 1 FROM comments c
           WHERE c.post_id = p.id AND c.body ILIKE $3
         )
       )
       AND ($4 = '' OR p.owner_id::text = $4)
       AND (
         $5 = ''
         OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE lower(t) = lower($5) OR t ILIKE $6)
       )
       AND (
         $7 = ''
         OR EXISTS (
           SELECT 1 FROM comments c
           WHERE c.post_id = p.id AND c.body ILIKE $8
         )
       )
       AND (
         $9 = ''
         OR COALESCE(
           (
             SELECT ph.taken_at::date
             FROM photos ph
             WHERE ph.post_id = p.id
             ORDER BY ph.sort_order ASC, ph.created_at ASC
             LIMIT 1
           ),
           p.created_at::date
         ) >= $9::date
       )
       AND (
         $10 = ''
         OR COALESCE(
           (
             SELECT ph.taken_at::date
             FROM photos ph
             WHERE ph.post_id = p.id
             ORDER BY ph.sort_order ASC, ph.created_at ASC
             LIMIT 1
           ),
           p.created_at::date
         ) <= $10::date
       )
       ORDER BY p.created_at DESC
       LIMIT 60`,
      [req.user.id, q, like, uploader, tag, tagLike, comment, commentLike, from, to],
    );

    const peopleResult = await pool.query(
      `SELECT u.id, u.display_name, u.username, u.avatar_url
       FROM users u
       JOIN friendships f ON f.status = 'accepted'
         AND ((f.user_id = $1 AND f.friend_id = u.id) OR (f.friend_id = $1 AND f.user_id = u.id))
       WHERE ($2 = '' OR u.display_name ILIKE $3 OR u.username ILIKE $3)
         AND ($4 = '' OR u.id::text = $4)
       ORDER BY u.display_name ASC
       LIMIT 30`,
      [req.user.id, q, like, uploader],
    );

    const photos = [];
    for (const row of postsResult.rows) {
      const shot = await pool.query(
        `SELECT id, object_key, width, height, taken_at, created_at FROM photos
         WHERE post_id = $1 ORDER BY sort_order ASC, created_at ASC LIMIT 1`,
        [row.id],
      );
      const first = shot.rows[0];
      const src = first ? await signedGetUrl(first.object_key) : "";
      if (!src) continue;
      const title = row.caption || row.display_name || row.username || "Photo";
      const taken = first?.taken_at || row.taken_at || row.created_at;
      photos.push({
        id: row.id,
        postId: row.id,
        title,
        caption: row.caption || "",
        tags: row.tags || [],
        albumId: row.album_id || "",
        albumName: row.album_name || "",
        taken,
        uploaded: first?.created_at || row.created_at,
        uploaderId: row.owner_id,
        uploaderName: row.display_name || row.username || "",
        src,
        thumb: src,
        width: first?.width || 0,
        height: first?.height || 0,
        photos: [{
          id: first.id,
          src,
          url: src,
          thumb: src,
          width: first.width || 0,
          height: first.height || 0,
        }],
      });
    }

    // When filters are on, keep albums that matched by name or hold a matched photo.
    const albumIds = new Set(photos.map((photo) => photo.albumId).filter(Boolean));
    const albums = (narrowed
      ? albumsResult.rows.filter((row) => Boolean(q) || albumIds.has(row.id))
      : albumsResult.rows
    ).map((row) => ({
      id: row.id,
      name: row.name,
      visibility: row.visibility,
      ownerId: row.owner_id,
    }));

    return res.json({
      photos,
      albums,
      people: peopleResult.rows.map((row) => ({
        id: row.id,
        name: row.display_name || row.username || "",
        displayName: row.display_name || "",
        username: row.username || "",
        avatar: row.avatar_url || "",
      })),
      narrowed,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not search." });
  }
});

module.exports = router;
