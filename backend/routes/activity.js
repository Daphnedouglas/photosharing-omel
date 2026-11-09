const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const TYPES = new Set(["post", "comment", "reaction", "join", "share", "security"]);

function shape(row) {
  return {
    id: row.id,
    type: row.type,
    actorId: row.actor_id,
    actorName: row.actor_name || "",
    postId: row.post_id || "",
    albumId: row.album_id || "",
    stripId: row.strip_id || "",
    targetId: row.target_id || "",
    payload: row.payload || {},
    private: Boolean(row.private),
    createdAt: row.created_at,
  };
}

/** GET /api/activity */
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*
       FROM activity_events e
       WHERE
         (e.private = TRUE AND e.actor_id = $1)
         OR (
           e.private = FALSE
           AND (
             e.actor_id = $1
             OR e.target_id = $1
             OR EXISTS (
               SELECT 1 FROM friendships f
               WHERE f.status = 'accepted'
                 AND (
                   (f.user_id = $1 AND f.friend_id = e.actor_id)
                   OR (f.friend_id = $1 AND f.user_id = e.actor_id)
                 )
             )
           )
         )
       ORDER BY e.created_at DESC
       LIMIT 200`,
      [req.user.id],
    );
    const seen = await pool.query(
      `SELECT event_id FROM activity_seen WHERE user_id = $1`,
      [req.user.id],
    );
    return res.json({
      events: result.rows.map(shape),
      seenIds: seen.rows.map((row) => row.event_id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load activity." });
  }
});

/** POST /api/activity — record an event */
router.post("/", requireAuth, async (req, res) => {
  try {
    const type = String(req.body?.type || "");
    if (!TYPES.has(type)) return res.status(400).json({ error: "Unknown activity type." });
    const actorName = String(req.body?.actorName || req.user.username || "").trim();
    const result = await pool.query(
      `INSERT INTO activity_events (
         type, actor_id, actor_name, post_id, album_id, strip_id, target_id, payload, private
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       RETURNING *`,
      [
        type,
        req.user.id,
        actorName,
        req.body?.postId || null,
        req.body?.albumId || null,
        req.body?.stripId || null,
        req.body?.targetId || null,
        JSON.stringify(req.body?.payload || {}),
        Boolean(req.body?.private),
      ],
    );
    return res.status(201).json({ event: shape(result.rows[0]) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not record activity." });
  }
});

/** POST /api/activity/seen — { ids: [] } */
router.post("/seen", requireAuth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
    for (const id of ids.slice(0, 400)) {
      await pool.query(
        `INSERT INTO activity_seen (user_id, event_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.user.id, id],
      );
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not mark activity seen." });
  }
});

module.exports = router;
