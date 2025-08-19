// api/Routes/ListingRoute.js
import express from "express";
import pool from "./PoolConnection.js";

const router = express.Router();

router.get("/listings", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { rows } = await pool.query(
      `SELECT * FROM postings ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    console.error("Public list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get(["/listings/:id", "/postdetails/:id", "/listing/:id"], async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM postings WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Public details error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
