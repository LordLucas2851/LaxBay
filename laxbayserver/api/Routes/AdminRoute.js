import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./PoolConnection.js";

const router = express.Router();
// TODO: replace with real admin check
const requireAdmin = (req, _res, next) => next();

// absolute uploads dir: .../api/uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

/**
 * Mounted at /api/store/admin in index.js
 * Supported:
 *   GET    /posts           , /listings
 *   GET    /posts/:id       , /listings/:id       , /postdetails/:id
 *   PUT    /posts/:id       , /listings/:id       , /postdetails/:id  (JSON or multipart)
 *   DELETE /posts/:id       , /listings/:id       , /postdetails/:id
 */

// List
router.get(["/posts", "/listings"], requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { rows } = await pool.query(
      `SELECT * FROM public.postings ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    console.error("Admin list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get single (mirror postdetails)
router.get(["/posts/:id", "/listings/:id", "/postdetails/:id"], requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM public.postings WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Admin get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Edit (accepts JSON or multipart; image optional)
router.put(["/posts/:id", "/listings/:id", "/postdetails/:id"], requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, description, price, category, location, image } = req.body;
    const newImage = req.file ? `uploads/${req.file.filename}` : image ?? undefined;

    const { rows } = await pool.query(
      `UPDATE public.postings
         SET title       = COALESCE($1, title),
             description = COALESCE($2, description),
             price       = COALESCE($3, price),
             category    = COALESCE($4, category),
             location    = COALESCE($5, location),
             image       = COALESCE($6, image),
             updated_at  = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, description, price, category, location, newImage, req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Admin update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete
router.delete(["/posts/:id", "/listings/:id", "/postdetails/:id"], requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM public.postings WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    console.error("Admin delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
