const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const REACTION_IDS = ["love", "touched", "haha", "stunning", "thanks"];
const VIS = new Set(["only_me", "friends", "people"]);

function shapeStrip(row, extras = {}) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: extras.ownerName || "",
    serial: row.serial,
    title: row.title,
    note: row.note || "",
    date: row.strip_date instanceof Date
      ? row.strip_date.toISOString().slice(0, 10)
      : String(row.strip_date || "").slice(0, 10),
    time: row.time_text || "",
    place: row.place || "",
    layout: row.layout || "simple",
    color: row.color || "paper",
    tone: row.tone || "original",
    headerText: row.header_text || "",
    songTitle: row.song_title || "",
    artist: row.artist || "",
    style: row.color || "paper",
    visibility: row.visibility || "only_me",
    photos: Array.isArray(row.photos) ? row.photos : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extras,
  };
}

async function ownerName(userId) {
  const result = await pool.query(
    `SELECT display_name, username, full_name FROM users WHERE id = $1`,
    [userId],
  );
  const u = result.rows[0];
  if (!u) return "";
  return u.display_name || String(u.full_name || "").split(/\s+/)[0] || u.username || "";
}

async function acceptedFriendIds(userId) {
  const result = await pool.query(
    `SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS id
     FROM friendships WHERE status = 'accepted' AND (user_id = $1 OR friend_id = $1)`,
    [userId],
  );
  return result.rows.map((row) => row.id);
}

async function replaceShares(client, strip, requested, fromName) {
  await client.query(`DELETE FROM strip_shares WHERE strip_id = $1`, [strip.id]);
  let targets = [];
  if (strip.visibility === "friends") {
    targets = await acceptedFriendIds(strip.owner_id);
  } else if (strip.visibility === "people") {
    const allowed = new Set(await acceptedFriendIds(strip.owner_id));
    targets = (requested || [])
      .map((row) => row.userId || row)
      .filter((id) => allowed.has(id) && id !== strip.owner_id);
  }
  for (const userId of [...new Set(targets)]) {
    await client.query(
      `INSERT INTO strip_shares (strip_id, user_id, from_name)
       VALUES ($1, $2, $3)`,
      [strip.id, userId, fromName],
    );
  }
}

function parseBody(body) {
  const title = String(body?.title || "").trim();
  const note = String(body?.note || "").trim();
  const date = String(body?.date || "");
  if (!title) throw Object.assign(new Error("Give your strip a title."), { status: 400 });
  if (title.length > 40) throw Object.assign(new Error("The title can be up to 40 characters."), { status: 400 });
  if (note.length > 80) throw Object.assign(new Error("The note can be up to 80 characters."), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error("Choose a date."), { status: 400 });
  const photos = [];
  const seen = new Set();
  (body?.photos || []).forEach((photo) => {
    const photoId = photo.photoId || photo.id;
    if (!photoId || seen.has(photoId) || photos.length >= 6) return;
    seen.add(photoId);
    photos.push({
      photoId,
      order: photos.length + 1,
      cropSrc: typeof photo.cropSrc === "string" && photo.cropSrc.startsWith("data:image/")
        ? photo.cropSrc
        : "",
    });
  });
  if (![2, 4, 6].includes(photos.length)) {
    throw Object.assign(new Error("A strip needs 2, 4 or 6 photos."), { status: 400 });
  }
  const visibility = VIS.has(body?.visibility) ? body.visibility : "only_me";
  return {
    title,
    note,
    date,
    time: String(body?.time || "").trim(),
    place: String(body?.place || "").trim(),
    layout: String(body?.layout || "simple"),
    color: String(body?.color || body?.style || "paper"),
    tone: String(body?.tone || "original"),
    headerText: String(body?.headerText || "").trim().slice(0, 30),
    songTitle: String(body?.songTitle || "").trim().slice(0, 40),
    artist: String(body?.artist || "").trim().slice(0, 40),
    visibility,
    photos,
  };
}

/** GET /api/strips */
router.get("/", requireAuth, async (req, res) => {
  try {
    const own = await pool.query(
      `SELECT * FROM photostrips WHERE owner_id = $1 ORDER BY created_at DESC`,
      [req.user.id],
    );
    const shared = await pool.query(
      `SELECT s.*, sh.shared_at, sh.seen_at, sh.dismissed, sh.from_name
       FROM photostrips s
       JOIN strip_shares sh ON sh.strip_id = s.id
       WHERE sh.user_id = $1 AND sh.dismissed = FALSE
       ORDER BY sh.shared_at DESC`,
      [req.user.id],
    );
    const name = await ownerName(req.user.id);
    const strips = [];
    for (const row of own.rows) {
      strips.push(shapeStrip(row, { ownerName: name, board: "mine" }));
    }
    for (const row of shared.rows) {
      strips.push(
        shapeStrip(row, {
          ownerName: row.from_name || (await ownerName(row.owner_id)),
          board: "shared",
          sharedAt: row.shared_at,
          seenAt: row.seen_at,
        }),
      );
    }
    return res.json({ strips });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load strips." });
  }
});

/** POST /api/strips */
router.post("/", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const fields = parseBody(req.body || {});
    await client.query("BEGIN");
    const serialRow = await client.query(
      `SELECT COALESCE(MAX(serial), 0) + 1 AS next FROM photostrips WHERE owner_id = $1`,
      [req.user.id],
    );
    const serial = serialRow.rows[0].next;
    const result = await client.query(
      `INSERT INTO photostrips (
         owner_id, title, note, strip_date, time_text, place, layout, color, tone,
         header_text, song_title, artist, visibility, photos, serial
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)
       RETURNING *`,
      [
        req.user.id,
        fields.title,
        fields.note,
        fields.date,
        fields.time,
        fields.place,
        fields.layout,
        fields.color,
        fields.tone,
        fields.headerText,
        fields.songTitle,
        fields.artist,
        fields.visibility,
        JSON.stringify(fields.photos),
        serial,
      ],
    );
    const strip = result.rows[0];
    const name = await ownerName(req.user.id);
    await replaceShares(client, strip, req.body?.shares, name);
    await client.query("COMMIT");
    return res.status(201).json({ strip: shapeStrip(strip, { ownerName: name }) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "Could not create strip." });
  } finally {
    client.release();
  }
});

/** GET /api/strips/:id */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM photostrips WHERE id = $1`, [req.params.id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Strip not found." });
    if (row.owner_id !== req.user.id) {
      const share = await pool.query(
        `SELECT 1 FROM strip_shares WHERE strip_id = $1 AND user_id = $2 AND dismissed = FALSE`,
        [row.id, req.user.id],
      );
      if (!share.rows[0] && row.visibility === "only_me") {
        return res.status(404).json({ error: "Strip not found." });
      }
    }
    return res.json({ strip: shapeStrip(row, { ownerName: await ownerName(row.owner_id) }) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load strip." });
  }
});

/** PATCH /api/strips/:id */
router.patch("/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const fields = parseBody(req.body || {});
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT * FROM photostrips WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Strip not found." });
    }
    if (req.body?.expectedUpdatedAt && current.rows[0].updated_at) {
      const expected = new Date(req.body.expectedUpdatedAt).getTime();
      const actual = new Date(current.rows[0].updated_at).getTime();
      if (expected && actual && expected !== actual) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This strip was changed somewhere else. Open it again before saving." });
      }
    }
    const result = await client.query(
      `UPDATE photostrips SET
         title = $2, note = $3, strip_date = $4, time_text = $5, place = $6,
         layout = $7, color = $8, tone = $9, header_text = $10, song_title = $11,
         artist = $12, visibility = $13, photos = $14::jsonb, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        fields.title,
        fields.note,
        fields.date,
        fields.time,
        fields.place,
        fields.layout,
        fields.color,
        fields.tone,
        fields.headerText,
        fields.songTitle,
        fields.artist,
        fields.visibility,
        JSON.stringify(fields.photos),
      ],
    );
    const strip = result.rows[0];
    const name = await ownerName(req.user.id);
    await replaceShares(client, strip, req.body?.shares, name);
    await client.query("COMMIT");
    return res.json({ strip: shapeStrip(strip, { ownerName: name }) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "Could not update strip." });
  } finally {
    client.release();
  }
});

/** DELETE /api/strips/:id */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM photostrips WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Strip not found." });
    await pool.query(
      `UPDATE share_links SET revoked_at = NOW()
       WHERE kind = 'strip' AND target_id = $1 AND revoked_at IS NULL`,
      [req.params.id],
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not delete strip." });
  }
});

/** POST /api/strips/:id/seen */
router.post("/:id/seen", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE strip_shares SET seen_at = NOW()
       WHERE strip_id = $1 AND user_id = $2 AND dismissed = FALSE`,
      [req.params.id, req.user.id],
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not mark seen." });
  }
});

/** POST /api/strips/:id/dismiss */
router.post("/:id/dismiss", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE strip_shares SET dismissed = TRUE, seen_at = COALESCE(seen_at, NOW())
       WHERE strip_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not remove strip." });
  }
});

function packStripReactions(rows, userId) {
  const reaction_counts = Object.fromEntries(REACTION_IDS.map((id) => [id, 0]));
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

router.get("/:id/reactions", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.user_id, r.reaction, u.username, u.display_name
       FROM strip_reactions r JOIN users u ON u.id = r.user_id
       WHERE r.strip_id = $1`,
      [req.params.id],
    );
    return res.json(packStripReactions(result.rows, req.user.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load reactions." });
  }
});

router.put("/:id/reactions", requireAuth, async (req, res) => {
  try {
    const reaction = req.body?.reaction == null || req.body?.reaction === ""
      ? null
      : String(req.body.reaction);
    if (reaction != null && !REACTION_IDS.includes(reaction)) {
      return res.status(400).json({ error: "That reaction isn't available." });
    }
    if (reaction == null) {
      await pool.query(`DELETE FROM strip_reactions WHERE strip_id = $1 AND user_id = $2`, [
        req.params.id,
        req.user.id,
      ]);
    } else {
      await pool.query(
        `INSERT INTO strip_reactions (user_id, strip_id, reaction)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, strip_id)
         DO UPDATE SET reaction = EXCLUDED.reaction, created_at = NOW()`,
        [req.user.id, req.params.id, reaction],
      );
    }
    const result = await pool.query(
      `SELECT r.user_id, r.reaction, u.username, u.display_name
       FROM strip_reactions r JOIN users u ON u.id = r.user_id
       WHERE r.strip_id = $1`,
      [req.params.id],
    );
    return res.json(packStripReactions(result.rows, req.user.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not save reaction." });
  }
});

router.get("/:id/comments", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.strip_id, c.user_id, c.body, c.created_at, u.username, u.display_name
       FROM strip_comments c JOIN users u ON u.id = c.user_id
       WHERE c.strip_id = $1 ORDER BY c.created_at ASC`,
      [req.params.id],
    );
    return res.json({
      comments: result.rows.map((row) => ({
        id: row.id,
        stripId: row.strip_id,
        userId: row.user_id,
        body: row.body,
        createdAt: row.created_at,
        authorName: row.display_name || row.username,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load comments." });
  }
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Comment text is required." });
    const result = await pool.query(
      `INSERT INTO strip_comments (strip_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, strip_id, user_id, body, created_at`,
      [req.params.id, req.user.id, body],
    );
    const author = await pool.query(`SELECT username, display_name FROM users WHERE id = $1`, [req.user.id]);
    const c = result.rows[0];
    return res.status(201).json({
      comment: {
        id: c.id,
        stripId: c.strip_id,
        userId: c.user_id,
        body: c.body,
        createdAt: c.created_at,
        authorName: author.rows[0]?.display_name || author.rows[0]?.username || "",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not add comment." });
  }
});

router.delete("/:id/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM strip_comments
       WHERE id = $1 AND strip_id = $2
         AND (user_id = $3 OR EXISTS (
           SELECT 1 FROM photostrips s WHERE s.id = $2 AND s.owner_id = $3
         ))
       RETURNING id`,
      [req.params.commentId, req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Comment not found." });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not delete comment." });
  }
});

module.exports = router;
