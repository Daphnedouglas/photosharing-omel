const { S3Client, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function s3() {
  return new S3Client({
    region: process.env.AWS_REGION || "ap-southeast-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

function bucketName() {
  return process.env.S3_BUCKET || "";
}

async function signedGetUrl(objectKey) {
  const bucket = bucketName();
  if (!bucket || !objectKey) return "";
  const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
  return getSignedUrl(s3(), command, { expiresIn: 60 * 15 });
}

async function deleteObjectKey(objectKey) {
  const bucket = bucketName();
  if (!bucket || !objectKey) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  } catch (error) {
    console.error("S3 delete failed:", objectKey, error.message);
  }
}

async function deleteObjectKeys(keys = []) {
  const unique = [...new Set((keys || []).filter(Boolean))];
  await Promise.all(unique.map((key) => deleteObjectKey(key)));
}

module.exports = {
  s3,
  bucketName,
  signedGetUrl,
  deleteObjectKey,
  deleteObjectKeys,
};
