const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { pool } = require("../db");
const { signToken, setAuthCookie, clearAuthCookie, requireAuth } = require("../middleware/auth");
const { deleteObjectKeys, signedGetUrl } = require("../lib/s3");

const router = express.Router();
const SALT_ROUNDS = 10;

function looksLikeObjectKey(value) {
  const text = String(value || "");
  return Boolean(text) && !/^https?:\/\//i.test(text) && !text.startsWith("data:");
}

async function publicMediaUrl(value) {
  if (!value) return "";
  if (!looksLikeObjectKey(value)) return String(value);
  return signedGetUrl(value);
}

async function shapeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    fullName: row.full_name,
    avatarUrl: await publicMediaUrl(row.avatar_url),
    avatarKey: looksLikeObjectKey(row.avatar_url) ? row.avatar_url : "",
    coverUrl: await publicMediaUrl(row.cover_url),
    coverKey: looksLikeObjectKey(row.cover_url) ? row.cover_url : "",
    bio: row.bio || "",
    location: row.location || "",
    settings: row.settings && typeof row.settings === "object" ? row.settings : {},
    createdAt: row.created_at,
  };
}

const USER_COLS = `id, email, username, display_name, full_name, avatar_url, cover_url, bio, location, settings, created_at`;

router.post("/register", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const fullName = String(req.body?.fullName || req.body?.full_name || "").trim();
    const displayName = String(req.body?.displayName || req.body?.display_name || fullName || username || "").trim();

    if (!email || !username || password.length < 8) {
      return res.status(400).json({ error: "Email, username, and a password (8+ chars) are required." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, username, display_name, full_name, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${USER_COLS}`,
      [email, username, displayName, fullName || displayName, passwordHash],
    );
    const user = result.rows[0];
    const token = signToken({ id: user.id, username: user.username });
    setAuthCookie(res, token);
    return res.status(201).json({ user: await shapeUser(user) });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That email or username is already taken." });
    }
    console.error(error);
    return res.status(500).json({ error: "Could not register." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const identifier = String(req.body?.email || req.body?.identifier || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/username and password are required." });
    }

    const result = await pool.query(
      `SELECT ${USER_COLS}, password_hash
       FROM users
       WHERE lower(email) = $1 OR lower(username) = $1
       LIMIT 1`,
      [identifier],
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "No account found for that email or username." });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials." });

    const token = signToken({ id: user.id, username: user.username });
    setAuthCookie(res, token);
    return res.json({ user: await shapeUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not sign in." });
  }
});

router.post("/logout", requireAuth, (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${USER_COLS} FROM users WHERE id = $1`,
      [req.user.id],
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({ user: await shapeUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load profile." });
  }
});

/** PATCH /api/auth/me — profile, account fields, avatar/cover keys, settings */
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const current = await pool.query(
      `SELECT ${USER_COLS} FROM users WHERE id = $1`,
      [req.user.id],
    );
    const user = current.rows[0];
    if (!user) return res.status(404).json({ error: "User not found." });

    const body = req.body || {};
    let email = user.email;
    let username = user.username;
    let displayName = user.display_name;
    let fullName = user.full_name;
    let bio = user.bio || "";
    let location = user.location || "";
    let avatarUrl = user.avatar_url || "";
    let coverUrl = user.cover_url || "";
    let settings = user.settings && typeof user.settings === "object" ? user.settings : {};

    if ("displayName" in body || "display_name" in body) {
      displayName = String(body.displayName ?? body.display_name ?? "").trim();
    }
    if ("fullName" in body || "full_name" in body) {
      fullName = String(body.fullName ?? body.full_name ?? "").trim();
    }
    if ("bio" in body) bio = String(body.bio ?? "");
    if ("location" in body) location = String(body.location ?? "").trim();
    if ("avatarKey" in body || "avatar_url" in body || "avatarUrl" in body) {
      avatarUrl = String(body.avatarKey ?? body.avatar_url ?? body.avatarUrl ?? "");
    }
    if ("coverKey" in body || "cover_url" in body || "coverUrl" in body) {
      coverUrl = String(body.coverKey ?? body.cover_url ?? body.coverUrl ?? "");
    }
    if (body.settings && typeof body.settings === "object") {
      settings = { ...settings, ...body.settings };
    }

    if ("username" in body) {
      const nextUsername = String(body.username || "").trim();
      if (nextUsername && nextUsername.toLowerCase() !== String(user.username || "").toLowerCase()) {
        username = nextUsername;
      }
    }

    if ("email" in body) {
      const nextEmail = String(body.email || "").trim().toLowerCase();
      if (nextEmail && nextEmail !== String(user.email || "").toLowerCase()) {
        const currentPassword = String(body.currentPassword || "");
        if (!currentPassword) {
          return res.status(401).json({ error: "Enter your current password to change your email." });
        }
        const auth = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
        const ok = await bcrypt.compare(currentPassword, auth.rows[0]?.password_hash || "");
        if (!ok) return res.status(401).json({ error: "That password isn't right." });
        email = nextEmail;
      }
    }

    const result = await pool.query(
      `UPDATE users SET
         email = $2,
         username = $3,
         display_name = $4,
         full_name = $5,
         bio = $6,
         location = $7,
         avatar_url = $8,
         cover_url = $9,
         settings = $10::jsonb,
         updated_at = NOW()
       WHERE id = $1
       RETURNING ${USER_COLS}`,
      [
        req.user.id,
        email,
        username,
        displayName,
        fullName,
        bio,
        location,
        avatarUrl,
        coverUrl,
        JSON.stringify(settings || {}),
      ],
    );
    return res.json({ user: await shapeUser(result.rows[0]) });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That email or username is already taken." });
    }
    console.error(error);
    return res.status(500).json({ error: "Could not update profile." });
  }
});

/** POST /api/auth/password — { currentPassword, newPassword } */
router.post("/password", requireAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!currentPassword || newPassword.length < 8 || !/\d/.test(newPassword)) {
      return res.status(400).json({ error: "Use at least 8 characters and one number." });
    }
    const found = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    const row = found.rows[0];
    if (!row) return res.status(404).json({ error: "User not found." });
    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) return res.status(401).json({ error: "That password isn't right." });
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [req.user.id, passwordHash],
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not change password." });
  }
});

/** DELETE /api/auth/account — { username, password } hard-deletes user + S3 photos */
router.delete("/account", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const found = await client.query(
      `SELECT id, username, password_hash, avatar_url, cover_url FROM users WHERE id = $1`,
      [req.user.id],
    );
    const user = found.rows[0];
    if (!user) return res.status(404).json({ error: "User not found." });
    if (String(user.username || "").toLowerCase() !== username) {
      return res.status(400).json({ error: "Type your username exactly to confirm." });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "That password isn't right." });

    await client.query("BEGIN");
    const keys = await client.query(
      `SELECT object_key FROM photos WHERE owner_id = $1`,
      [user.id],
    );
    const mediaKeys = [
      ...keys.rows.map((row) => row.object_key),
      user.avatar_url,
      user.cover_url,
    ].filter((key) => looksLikeObjectKey(key));
    await client.query(`DELETE FROM users WHERE id = $1`, [user.id]);
    await client.query("COMMIT");
    await deleteObjectKeys(mediaKeys);
    clearAuthCookie(res);
    return res.json({ ok: true, immediate: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    return res.status(500).json({ error: "Could not delete your account." });
  } finally {
    client.release();
  }
});

/** GET /api/auth/username-available?username= */
router.get("/username-available", async (req, res) => {
  try {
    const username = String(req.query.username || "").trim();
    if (!username || username.length < 3) {
      return res.json({ available: false, reason: "Username is too short." });
    }
    const except = String(req.query.except || "");
    const result = await pool.query(
      `SELECT id FROM users WHERE lower(username) = lower($1) LIMIT 1`,
      [username],
    );
    if (result.rows[0] && result.rows[0].id !== except) {
      return res.json({ available: false, reason: "That username is taken." });
    }
    return res.json({ available: true, reason: "" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not check username." });
  }
});

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("base64url");
}

/** POST /api/auth/forgot-password — { email } always { ok: true } */
router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (email) {
      const found = await pool.query(
        `SELECT id, email FROM users WHERE lower(email) = $1 LIMIT 1`,
        [email],
      );
      const user = found.rows[0];
      if (user) {
        const token = crypto.randomBytes(32).toString("base64url");
        const tokenHash = hashResetToken(token);
        await pool.query(
          `UPDATE password_reset_tokens SET used_at = NOW()
           WHERE user_id = $1 AND used_at IS NULL`,
          [user.id],
        );
        await pool.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
          [user.id, tokenHash],
        );
        const origin = process.env.PUBLIC_APP_URL || "http://localhost:5173";
        const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
        console.log(`[password-reset] ${user.email} → ${link}`);
        // Never reveal in production; DEV gets the token so the local mailbox can show the link.
        if (process.env.NODE_ENV !== "production") {
          return res.json({ ok: true, devToken: token, devLink: link });
        }
      }
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.json({ ok: true });
  }
});

/** GET /api/auth/reset-password/validate?token= */
router.get("/reset-password/validate", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.json({ valid: false });
    const tokenHash = hashResetToken(token);
    const result = await pool.query(
      `SELECT id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return res.json({ valid: Boolean(result.rows[0]) });
  } catch (error) {
    console.error(error);
    return res.json({ valid: false });
  }
});

/** POST /api/auth/reset-password — { token, newPassword } */
router.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body?.token || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!token) return res.status(400).json({ ok: false, error: "This link isn't valid anymore. Request a new one." });
    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      return res.status(400).json({ ok: false, error: "Use at least 8 characters and one number." });
    }
    const tokenHash = hashResetToken(token);
    const found = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    const row = found.rows[0];
    if (!row) {
      return res.status(400).json({ ok: false, error: "This link isn't valid anymore. Request a new one." });
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [row.user_id, passwordHash],
    );
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [row.id],
    );
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [row.user_id],
    );
    await pool.query(
      `INSERT INTO activity_events (type, actor_id, actor_name, private)
       VALUES ('security', $1, 'You', TRUE)`,
      [row.user_id],
    ).catch(() => {});
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: "Could not update the password. Try again." });
  }
});

module.exports = router;
