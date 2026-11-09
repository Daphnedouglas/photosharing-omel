const express = require("express");
const { pool } = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { signedGetUrl } = require("../lib/s3");

const router = express.Router();
const SHARE_TTL_MS = 5 * 60 * 1000;

function shortCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = require("crypto").randomBytes(8);
  for (let i = 0; i < 8; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function rowOut(row) {
  return {
    id: row.id,
    kind: row.kind,
    targetId: row.target_id,
    photoIndex: row.photo_index == null ? null : Number(row.photo_index),
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

/** POST /api/share — { kind, targetId, photoIndex? } */
router.post("/", requireAuth, async (req, res) => {
  try {
    const kind = String(req.body?.kind || "");
    const targetId = String(req.body?.targetId || "");
    const photoIndex = req.body?.photoIndex == null || req.body?.photoIndex === ""
      ? null
      : Number(req.body.photoIndex);
    if (!["album", "post", "strip"].includes(kind) || !targetId) {
      return res.status(400).json({ error: "Choose what to share." });
    }

    if (kind === "post") {
      const owned = await pool.query(
        `SELECT id FROM posts WHERE id = $1 AND owner_id = $2`,
        [targetId, req.user.id],
      );
      if (!owned.rows[0]) return res.status(404).json({ error: "Post not found." });
    } else if (kind === "album") {
      const owned = await pool.query(
        `SELECT id FROM albums WHERE id = $1 AND owner_id = $2`,
        [targetId, req.user.id],
      );
      if (!owned.rows[0]) return res.status(404).json({ error: "Album not found." });
    } else if (kind === "strip") {
      const owned = await pool.query(
        `SELECT id FROM photostrips WHERE id = $1 AND owner_id = $2`,
        [targetId, req.user.id],
      );
      if (!owned.rows[0]) return res.status(404).json({ error: "Strip not found." });
    }

    // Invalidate earlier active shares for the same target by this user.
    await pool.query(
      `UPDATE share_links
       SET revoked_at = NOW()
       WHERE created_by = $1 AND kind = $2 AND target_id = $3 AND revoked_at IS NULL`,
      [req.user.id, kind, targetId],
    );

    let id = shortCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await pool.query(`SELECT 1 FROM share_links WHERE id = $1`, [id]);
      if (!clash.rows[0]) break;
      id = shortCode();
    }

    const expiresAt = new Date(Date.now() + SHARE_TTL_MS);
    const result = await pool.query(
      `INSERT INTO share_links (id, kind, target_id, photo_index, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, kind, targetId, Number.isFinite(photoIndex) ? photoIndex : null, req.user.id, expiresAt],
    );
    return res.status(201).json({ share: rowOut(result.rows[0]) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not create share link." });
  }
});

/** GET /api/share/:id — public resolve (phone QR). */
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const result = await pool.query(`SELECT * FROM share_links WHERE id = $1`, [id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Link not found.", reason: "missing" });
    if (row.revoked_at) return res.status(410).json({ error: "This share expired.", reason: "revoked" });
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return res.status(410).json({ error: "This share expired.", reason: "expired" });
    }

    const share = rowOut(row);
    let preview = null;
    if (share.kind === "post") {
      const post = await pool.query(
        `SELECT p.id, p.caption, p.owner_id, u.display_name, u.username
         FROM posts p
         JOIN users u ON u.id = p.owner_id
         WHERE p.id = $1`,
        [share.targetId],
      );
      const photos = await pool.query(
        `SELECT id, object_key, sort_order, width, height
         FROM photos WHERE post_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [share.targetId],
      );
      const index = Math.max(0, Math.min(share.photoIndex || 0, Math.max(photos.rows.length - 1, 0)));
      const shot = photos.rows[index] || photos.rows[0];
      preview = {
        caption: post.rows[0]?.caption || "",
        ownerName: post.rows[0]?.display_name || post.rows[0]?.username || "",
        photoUrl: shot ? await signedGetUrl(shot.object_key) : "",
        photoId: shot?.id || "",
        width: shot?.width || 0,
        height: shot?.height || 0,
      };
    } else if (share.kind === "album") {
      const album = await pool.query(
        `SELECT a.id, a.name, a.owner_id, u.display_name, u.username
         FROM albums a JOIN users u ON u.id = a.owner_id WHERE a.id = $1`,
        [share.targetId],
      );
      const photos = await pool.query(
        `SELECT ph.id, ph.object_key, ph.width, ph.height
         FROM photos ph JOIN posts p ON p.id = ph.post_id
         WHERE p.album_id = $1
         ORDER BY ph.sort_order ASC, ph.created_at ASC LIMIT 1`,
        [share.targetId],
      );
      const shot = photos.rows[0];
      preview = {
        caption: album.rows[0]?.name || "Album",
        ownerName: album.rows[0]?.display_name || album.rows[0]?.username || "",
        photoUrl: shot ? await signedGetUrl(shot.object_key) : "",
        photoId: shot?.id || "",
        width: shot?.width || 0,
        height: shot?.height || 0,
      };
    } else if (share.kind === "strip") {
      const strip = await pool.query(
        `SELECT s.id, s.title, s.photos, s.owner_id, u.display_name, u.username
         FROM photostrips s JOIN users u ON u.id = s.owner_id WHERE s.id = $1`,
        [share.targetId],
      );
      const photos = Array.isArray(strip.rows[0]?.photos) ? strip.rows[0].photos : [];
      const first = photos[0] || {};
      let photoUrl = first.cropSrc || "";
      if (!photoUrl && first.photoId) {
        const shot = await pool.query(`SELECT object_key, width, height FROM photos WHERE id = $1`, [first.photoId]);
        if (shot.rows[0]) photoUrl = await signedGetUrl(shot.rows[0].object_key);
      }
      preview = {
        caption: strip.rows[0]?.title || "Strip",
        ownerName: strip.rows[0]?.display_name || strip.rows[0]?.username || "",
        photoUrl,
        photoId: first.photoId || "",
        width: 0,
        height: 0,
      };
    }

    return res.json({ share, preview });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not open share link." });
  }
});

/** DELETE /api/share/:id — revoke */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE share_links SET revoked_at = NOW()
       WHERE id = $1 AND created_by = $2 AND revoked_at IS NULL
       RETURNING *`,
      [req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Share not found." });
    return res.json({ share: rowOut(result.rows[0]), ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not revoke share link." });
  }
});

module.exports = router;
