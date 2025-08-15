import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

// GET collections (aliases supported)
router.get(["/listings", "/postings", "/posts"], async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { rows } = await pool.query(
      `SELECT * FROM public.postings
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch postings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET single by id (aliases supported)
router.get(
  ["/listings/:id", "/listing/:id", "/postings/:id", "/posts/:id"],
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM public.postings WHERE id = $1`,
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("Fetch posting error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
