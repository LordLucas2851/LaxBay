import express from "express";
import multer from "multer";
import path from "path";
import pool from "./PoolConnection.js";
import { UPLOAD_DIR } from "../index.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const mustBeAuthed = (req, res) => {
  const username = req.session?.username;
  if (!username) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return username;
};

// GET (owner-only)
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
    console.error("Fetch post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT (owner-only)
router.put(["/update/:id", "/posts/:id"], upload.single("image"), async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rows: owned } = await pool.query(
      `SELECT id FROM public.postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (owned.length === 0) {
      return res.status(403).json({ error: "Not your post or not found" });
    }

    const { title, description, price, category, location } = req.body;
    const newImage = req.file ? `uploads/${req.file.filename}` : undefined;

    const { rows } = await pool.query(
      `UPDATE public.postings
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             price = COALESCE($3, price),
             category = COALESCE($4, category),
             location = COALESCE($5, location),
             image = COALESCE($6, image),
             updated_at = NOW()
       WHERE id = $7 AND username = $8
       RETURNING *`,
      [title, description, price, category, location, newImage, req.params.id, username]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Update post error:", err);
    res.status(500).json({ error: "Server error updating post" });
  }
});

export default router;
