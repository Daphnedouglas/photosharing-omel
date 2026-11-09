const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: row.avatar_url || "",
  };
}

/** GET /api/friends — accepted friendships for the signed-in user */
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, f.created_at AS friends_since
       FROM friendships f
       JOIN users u ON u.id = CASE
         WHEN f.user_id = $1 THEN f.friend_id
         ELSE f.user_id
       END
       WHERE f.status = 'accepted'
         AND (f.user_id = $1 OR f.friend_id = $1)
       ORDER BY lower(u.display_name), lower(u.username)`,
      [req.user.id],
    );
    return res.json({ friends: result.rows.map(mapUser) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load friends." });
  }
});

/** GET /api/friends/requests — pending requests sent to me */
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, f.created_at
       FROM friendships f
       JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user.id],
    );
    return res.json({
      requests: result.rows.map((row) => ({
        ...mapUser(row),
        requestedAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load friend requests." });
  }
});

/** GET /api/friends/search?q= — find people to add */
router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().replace(/^@/, "").toLowerCase();
    if (q.length < 2) return res.json({ users: [] });

    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url
       FROM users u
       WHERE u.id <> $1
         AND (lower(u.username) LIKE $2 OR lower(u.display_name) LIKE $2 OR lower(u.email) LIKE $2)
         AND NOT EXISTS (
           SELECT 1 FROM friendships f
           WHERE f.status IN ('pending', 'accepted', 'blocked')
             AND (
               (f.user_id = $1 AND f.friend_id = u.id)
               OR (f.user_id = u.id AND f.friend_id = $1)
             )
         )
       ORDER BY lower(u.username)
       LIMIT 20`,
      [req.user.id, `%${q}%`],
    );
    return res.json({ users: result.rows.map(mapUser) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not search people." });
  }
});

/** GET /api/friends/invite — shareable join link payload for the current user */
router.get("/invite", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT username, display_name FROM users WHERE id = $1`,
      [req.user.id],
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found." });
    const username = user.username;
    const path = `/clowder?add=${encodeURIComponent(username)}`;
    return res.json({
      username,
      displayName: user.display_name || username,
      path,
      message: `Join me on Omel to share our photos together — @${username}`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not create invite." });
  }
});

/** POST /api/friends/request — { username? , userId? } */
router.post("/request", requireAuth, async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().replace(/^@/, "");
    let targetId = req.body?.userId || null;

    if (!targetId && username) {
      const found = await pool.query(
        `SELECT id FROM users WHERE lower(username) = lower($1) LIMIT 1`,
        [username],
      );
      targetId = found.rows[0]?.id || null;
    }
    if (!targetId) return res.status(404).json({ error: "That person isn't on Omel yet." });
    if (targetId === req.user.id) {
      return res.status(400).json({ error: "You can't add yourself." });
    }

    const existing = await pool.query(
      `SELECT user_id, friend_id, status FROM friendships
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
       LIMIT 1`,
      [req.user.id, targetId],
    );
    const row = existing.rows[0];
    if (row?.status === "accepted") {
      return res.status(409).json({ error: "You're already friends." });
    }
    if (row?.status === "blocked") {
      return res.status(403).json({ error: "You can't add this person." });
    }
    if (row?.status === "pending") {
      if (row.friend_id === req.user.id) {
        await pool.query(
          `UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2`,
          [targetId, req.user.id],
        );
        return res.json({ ok: true, status: "accepted" });
      }
      return res.status(409).json({ error: "Friend request already sent." });
    }

    await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'pending')`,
      [req.user.id, targetId],
    );
    return res.status(201).json({ ok: true, status: "pending" });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Friend request already sent." });
    }
    console.error(error);
    return res.status(500).json({ error: "Could not send friend request." });
  }
});

/** DELETE /api/friends/:userId — remove an accepted friendship either direction */
router.delete("/:userId", requireAuth, async (req, res) => {
  try {
    const otherId = req.params.userId;
    if (!otherId || otherId === req.user.id) {
      return res.status(400).json({ error: "Pick a friend to remove." });
    }
    const result = await pool.query(
      `DELETE FROM friendships
       WHERE status = 'accepted'
         AND (
           (user_id = $1 AND friend_id = $2)
           OR (user_id = $2 AND friend_id = $1)
         )
       RETURNING user_id`,
      [req.user.id, otherId],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "You're not friends with that person." });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not remove friend." });
  }
});

/** POST /api/friends/:userId/accept */
router.post("/:userId/accept", requireAuth, async (req, res) => {
  try {
    const fromId = req.params.userId;
    const result = await pool.query(
      `UPDATE friendships SET status = 'accepted'
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
       RETURNING user_id`,
      [fromId, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "No pending request from that person." });
    return res.json({ ok: true, status: "accepted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not accept request." });
  }
});

/** POST /api/friends/:userId/decline */
router.post("/:userId/decline", requireAuth, async (req, res) => {
  try {
    const fromId = req.params.userId;
    const result = await pool.query(
      `DELETE FROM friendships
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
       RETURNING user_id`,
      [fromId, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "No pending request from that person." });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not decline request." });
  }
});

module.exports = router;
