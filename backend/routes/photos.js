const express = require("express");
const { randomUUID } = require("crypto");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { requireAuth } = require("../middleware/auth");
const { pool } = require("../db");

const router = express.Router();

const isValidUUID = (id) =>
  typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function s3() {
  return new S3Client({
    region: process.env.AWS_REGION || "ap-southeast-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

/** GET /api/photos/presign?contentType=image/jpeg&ext=jpg */
router.get("/presign", requireAuth, async (req, res) => {
  try {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return res.status(500).json({ error: "S3_BUCKET is not configured." });

    const contentType = String(req.query.contentType || "image/jpeg");
    const ext = String(req.query.ext || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
    const kind = String(req.query.kind || "upload").toLowerCase();
    const folder = kind === "avatar" || kind === "cover" ? kind : "uploads";
    const key = `${folder}/${req.user.id}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3(), command, { expiresIn: 60 * 5 });

    return res.json({
      uploadUrl,
      objectKey: key,
      bucket,
      expiresIn: 300,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not create upload URL." });
  }
});

/**
 * GET /api/photos/:id/file — stream owned photo bytes (same-origin for crop/canvas).
 * Avoids browser CORS/taint when editing S3 images in CropDialog.
 */
router.get("/:id/file", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!isValidUUID(id)) return res.status(404).json({ error: "Photo not found." });

    const found = await pool.query(
      `SELECT object_key, owner_id FROM photos WHERE id = $1`,
      [id],
    );
    const row = found.rows[0];
    if (!row || row.owner_id !== req.user.id) {
      return res.status(404).json({ error: "Photo not found." });
    }

    const bucket = process.env.S3_BUCKET;
    if (!bucket) return res.status(500).json({ error: "S3_BUCKET is not configured." });

    const object = await s3().send(
      new GetObjectCommand({ Bucket: bucket, Key: row.object_key }),
    );
    res.setHeader("Content-Type", object.ContentType || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=60");
    if (object.ContentLength != null) res.setHeader("Content-Length", String(object.ContentLength));
    if (object.Body?.pipe) {
      object.Body.pipe(res);
      return;
    }
    const bytes = await object.Body.transformToByteArray();
    return res.send(Buffer.from(bytes));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not open that photo." });
  }
});

module.exports = router;
