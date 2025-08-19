import express from "express";
import multer from "multer";
import pool from "./PoolConnection.js";
import { validateOptionalPriceAndCategory } from "./validators.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const mustBeAuthed = (req, res) => {
  const username = req.session?.username;
  if (!username) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return username;
};

function extractImageData(req) {
  const data = req.body?.imageData || req.body?.image;
  if (data && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(String(data))) {
    return String(data);
  }
  if (req.file?.buffer) {
    const mime = req.file.mimetype || "image/png";
    if (!/^image\/(png|jpe?g|webp)$/i.test(mime)) {
      return { error: "Only PNG, JPEG, or WEBP images are allowed" };
    }
    const b64 = req.file.buffer.toString("base64");
    return `data:${mime};base64,${b64}`;
  }
  return undefined; // no change
}

// NEW: support presigned updates via imageKey/imageUrl
async function resolveImageFromBody(body = {}) {
  const { imageKey, imageUrl } = body;
  if (imageUrl && /^https?:\/\//i.test(String(imageUrl))) return String(imageUrl);
  if (imageKey) {
    const { objectPublicUrl } = await import("./s3Client.js");
    return objectPublicUrl(String(imageKey));
  }
  return undefined; // means "no change" unless multipart/dataURL provided
}

/* ===================== list your own posts ===================== */
router.get(["/posts", "/my", "/mine"], async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rows } = await pool.query(
      `SELECT * FROM postings WHERE username = $1 ORDER BY id DESC`,
      [username]
    );
    res.json(rows);
  } catch (err) {
    console.error("Owner list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===================== get single owned post ===================== */
router.get(["/post/:id", "/posts/:id"], async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rows } = await pool.query(
      `SELECT * FROM postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Owner get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===================== update owned post ===================== */
router.put(["/update/:id", "/posts/:id"], upload.single("image"), async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    // Ensure ownership
    const { rows: owned } = await pool.query(
      `SELECT id FROM postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (owned.length === 0) return res.status(403).json({ error: "Not your post or not found" });

    const { title = "", description = "", price = "", category = "", location = "" } = req.body;

    // Validate optional fields
    const vErr = validateOptionalPriceAndCategory({ price, category });
    if (vErr) return res.status(400).json({ error: vErr });

    // Image (either presigned input or file/dataURL). undefined => no change
    const presignedUrl = await resolveImageFromBody(req.body);
    const imageValue = presignedUrl !== undefined ? presignedUrl : extractImageData(req);
    if (imageValue && typeof imageValue === "object" && imageValue.error) {
      return res.status(400).json({ error: imageValue.error });
    }

    const params = [
      title, description, price, category, location,
      imageValue === undefined ? null : imageValue, // if undefined, ignore
      req.params.id, username
    ];

    const { rows } = await pool.query(
      `UPDATE postings
         SET title       = COALESCE(NULLIF($1, ''), title),
             description = COALESCE(NULLIF($2, ''), description),
             price       = COALESCE(NULLIF($3, '')::numeric, price),
             category    = COALESCE(NULLIF($4, ''), category),
             location    = COALESCE(NULLIF($5, ''), location),
             image       = COALESCE($6, image)
       WHERE id = $7 AND username = $8
       RETURNING *`,
      params
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Owner update error:", err);
    res.status(500).json({ error: "Server error updating post" });
  }
});

/* ===================== image-only endpoint for owners ===================== */
router.post(["/posts/:id/image", "/update/:id/image"], upload.single("image"), async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rows: owned } = await pool.query(
      `SELECT id FROM postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (owned.length === 0) return res.status(403).json({ error: "Not your post or not found" });

    // Allow presigned route usage here too
    const presignedUrl = await resolveImageFromBody(req.body);
    const directImg = extractImageData(req);
    const imageValue = presignedUrl || directImg;

    if (!imageValue) return res.status(400).json({ error: "No image provided" });
    if (typeof imageValue === "object" && imageValue.error) {
      return res.status(400).json({ error: imageValue.error });
    }

    const { rows } = await pool.query(
      `UPDATE postings SET image = $1 WHERE id = $2 RETURNING *`,
      [imageValue, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("Owner image-only update error:", err);
    res.status(500).json({ error: "Server error updating image" });
  }
});

/* ===================== delete owned post (NEW) ===================== */
router.delete(["/posts/:id", "/delete/:id"], async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rowCount } = await pool.query(
      `DELETE FROM postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    console.error("Owner delete error:", err);
    res.status(500).json({ error: "Server error deleting post" });
  }
});

export default router;
