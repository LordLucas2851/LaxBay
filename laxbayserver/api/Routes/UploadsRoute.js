import express from "express";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { makeS3, objectPublicUrl } from "./s3Client.js";

const router = express.Router();

function requireAuth(req, res) {
  const username = req.session?.username;
  if (!username) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return username;
}

function slug(s="") {
  return String(s).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

// POST /api/uploads/presign  { filename, contentType }
// -> { uploadUrl, key, publicUrl, expiresIn }
router.post("/presign", async (req, res) => {
  try {
    const username = requireAuth(req, res);
    if (!username) return;

    const { filename, contentType } = req.body || {};
    if (!filename || !contentType) {
      return res.status(400).json({ error: "filename and contentType are required" });
    }
    if (!/^image\/(png|jpe?g|webp)$/i.test(contentType)) {
      return res.status(400).json({ error: "Only PNG, JPEG or WEBP images allowed" });
    }

    const { client, bucket } = makeS3();

    const ts = Date.now();
    const rand = crypto.randomBytes(4).toString("hex");
    const key = `postings/${slug(username)}/${ts}-${rand}-${slug(filename)}`;

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ACL: process.env.S3_ACL || undefined, // e.g. "public-read" on AWS if you need public
      // (R2 ignores ACL; use Public Base URL / bucket policy instead)
    });

    const expiresIn = 900; // 15 minutes
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn });
    const publicUrl = objectPublicUrl(key);

    res.json({ uploadUrl, key, publicUrl, expiresIn });
  } catch (e) {
    console.error("presign error:", e);
    res.status(500).json({ error: "presign failed" });
  }
});

export default router;
