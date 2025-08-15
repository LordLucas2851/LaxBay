import express from "express";
import pg from "pg";

const router = express.Router();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Optional: simple “is admin” check; adjust to your auth model
function requireAdmin(req, res, next) {
  // Example: req.session.role === 'admin'
  // For now, let it through to avoid blocking while debugging
  return next();
}

/**
 * GET /api/store/admin/listings
 * Admin view of postings (kept “listings” path)
 */
router.get("/admin/listings", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { rows } = await pool.query(
      `SELECT * FROM postings
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

/**
 * DELETE /api/store/admin/listings/:id
 */
router.delete("/admin/listings/:id", requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM postings WHERE id = $1`,
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
