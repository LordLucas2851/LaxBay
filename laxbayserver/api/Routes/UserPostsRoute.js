// api/Routes/UserPostsRoute.js
import express from "express";
import multer from "multer";
import pool from "./PoolConnection.js";

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
    const b64 = req.file.buffer.toString("base64");
    return `data:${mime};base64,${b64}`;
  }
  return undefined; // no change
}

/* ===================== NEW: list your own posts ===================== */
// GET /api/store/user/posts   (returns [] if none)
router.get(["/posts", "/my", "/mine"], async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rows } = await pool.query(
      `SELECT * FROM postings WHERE username = $1 ORDER BY id DESC`,
      [username]
    );

    // Always 200 with an array (possibly empty)
    res.json(rows);
  } catch (err) {
    console.error("Owner list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===================== existing endpoints ===================== */

// GET /api/store/user/post(s)/:id
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

// PUT /api/store/user/update/:id  or /posts/:id
// Supports partial updates and ignores empty strings
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
    const imageValue = extractImageData(req);

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
      [title, description, price, category, location, imageValue, req.params.id, username]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Owner update error:", err);
    res.status(500).json({ error: "Server error updating post" });
  }
});

// Image-only endpoint for owners
router.post(["/posts/:id/image", "/update/:id/image"], upload.single("image"), async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rows: owned } = await pool.query(
      `SELECT id FROM postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (owned.length === 0) return res.status(403).json({ error: "Not your post or not found" });

    const imageValue = extractImageData(req);
    if (!imageValue) return res.status(400).json({ error: "No image provided" });

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

export default router;
