import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./PoolConnection.js";

const router = express.Router();
const requireAdmin = (req, res, next) => next(); // TODO: real auth

// Resolve absolute uploads dir
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
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Mounted at /api/store/admin
 * Your frontend calls:
 *   DELETE /api/store/admin/posts/:id   ✅ now supported (alias)
 * We also support:
 *   GET    /api/store/admin/listings  and /posts
 *   PUT    /api/store/admin/listings/:id  and /posts/:id
 *   DELETE /api/store/admin/listings/:id  and /posts/:id
 */

// list all (aliases)
router.get(["/listings", "/posts"], requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { rows } = await pool.query(
      `SELECT * FROM public.postings
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    console.error("Admin fetch postings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// delete by id (aliases)
router.delete(["/listings/:id", "/posts/:id"], requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM public.postings WHERE id = $1`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    console.error("Admin delete posting error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// edit by id (aliases; image optional)
router.put(["/listings/:id", "/posts/:id"], requireAdmin, upload.single("image"), async (req, res) => {
  try {
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
       WHERE id = $7
       RETURNING *`,
      [title, description, price, category, location, newImage, req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Admin update posting error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
