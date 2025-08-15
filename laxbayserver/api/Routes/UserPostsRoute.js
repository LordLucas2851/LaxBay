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
  return undefined; // means "do not change"
}

// GET your own post (EditPost.jsx GET)
router.get(["/post/:id", "/posts/:id"], async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rows } = await pool.query(
      `SELECT * FROM public.postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Owner get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE your own post (EditPost.jsx PUT — JSON or multipart)
router.put(["/update/:id", "/posts/:id"], upload.single("image"), async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    // Ensure ownership
    const { rows: owned } = await pool.query(
      `SELECT id FROM public.postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (owned.length === 0) return res.status(403).json({ error: "Not your post or not found" });

    const { title, description, price, category, location } = req.body;
    const imageValue = extractImageData(req); // data-URL string or undefined

    const { rows } = await pool.query(
      `UPDATE public.postings
         SET title       = COALESCE($1, title),
             description = COALESCE($2, description),
             price       = COALESCE($3, price),
             category    = COALESCE($4, category),
             location    = COALESCE($5, location),
             image       = COALESCE($6, image),
             updated_at  = NOW()
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

export default router;
