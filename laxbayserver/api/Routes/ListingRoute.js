import express from "express";
import pg from "pg";

const router = express.Router();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/store/listings
 * Public listing feed (pagination)
 */
router.get("/listings", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { rows } = await pool.query(
      `SELECT * FROM postings
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

/**
 * GET /api/store/listings/:id
 * Public single posting
 */
router.get("/listings/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM postings WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Fetch posting error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
