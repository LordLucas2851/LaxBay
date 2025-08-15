import express from "express";
import multer from "multer";
import pool from "./PoolConnection.js";

const router = express.Router();
// TODO: replace with real admin check
const requireAdmin = (req, _res, next) => next();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

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
  return undefined;
}

/**
 * Mounted at /api/store/admin
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

// Edit (JSON or multipart)
router.put(["/posts/:id", "/listings/:id", "/postdetails/:id"], requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, description, price, category, location } = req.body;
    const imageValue = extractImageData(req);

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
      [title, description, price, category, location, imageValue, req.params.id]
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
