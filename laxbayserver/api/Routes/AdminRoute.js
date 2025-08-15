// api/Routes/AdminRoute.js
import express from "express";
import pool from "./PoolConnection.js";

const router = express.Router();

// TODO: real admin auth
const requireAdmin = (req, res, next) => next();

/**
 * Mounted at /api/store/admin
 * Supported (all equivalent):
 *   GET    /api/store/admin/posts
 *   GET    /api/store/admin/listings
 *   GET    /api/store/admin/postdetails/:id
 *   GET    /api/store/admin/posts/:id
 *   GET    /api/store/admin/listings/:id
 *   PUT    /api/store/admin/postdetails/:id
 *   PUT    /api/store/admin/posts/:id
 *   PUT    /api/store/admin/listings/:id
 *   DELETE /api/store/admin/postdetails/:id
 *   DELETE /api/store/admin/posts/:id
 *   DELETE /api/store/admin/listings/:id
 */

// List (useful for admin table)
router.get(["/posts", "/listings"], requireAdmin, async (req, res) => {
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

// Get single (mirror postdetails)
router.get(
  ["/postdetails/:id", "/posts/:id", "/listings/:id"],
  requireAdmin,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM public.postings WHERE id = $1`,
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("Admin get posting error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Edit (JSON only; image handling can be added later)
router.put(
  ["/postdetails/:id", "/posts/:id", "/listings/:id"],
  requireAdmin,
  async (req, res) => {
    try {
      const { title, description, price, category, location, image } = req.body;

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
        [title, description, price, category, location, image, req.params.id]
      );

      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("Admin update posting error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Delete
router.delete(
  ["/postdetails/:id", "/posts/:id", "/listings/:id"],
  requireAdmin,
  async (req, res) => {
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
  }
);

export default router;
