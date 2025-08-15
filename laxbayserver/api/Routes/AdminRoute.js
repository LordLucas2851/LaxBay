import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

// (Optional) add real auth later
const requireAdmin = (req, res, next) => next();

// GET admin list (aliases)
router.get(["/admin/listings", "/admin/postings"], requireAdmin, async (req, res) => {
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

// DELETE admin by id (aliases)
router.delete(
  ["/admin/listings/:id", "/admin/postings/:id"],
  requireAdmin,
  async (req, res) => {
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
  }
);

export default router;
