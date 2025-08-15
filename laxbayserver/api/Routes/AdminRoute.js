import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

// TODO: real admin auth later
const requireAdmin = (req, res, next) => next();

/**
 * Mounted at /api/store/admin
 * Final paths:
 *   GET    /api/store/admin/listings
 *   DELETE /api/store/admin/listings/:id
 */
router.get("/listings", requireAdmin, async (req, res) => {
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

router.delete("/listings/:id", requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM public.postings WHERE id = $1`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin delete posting error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
