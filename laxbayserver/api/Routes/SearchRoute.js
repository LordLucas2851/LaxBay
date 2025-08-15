import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/**
 * Mounted at /api/store/search
 * Final path:
 *   GET /api/store/search
 * Query: ?query=&category=&location=&minPrice=&maxPrice=
 */
router.get("/", async (req, res) => {
  try {
    const { query = "", category, location, minPrice, maxPrice } = req.query;

    const clauses = [`(LOWER(title) LIKE LOWER($1) OR LOWER(description) LIKE LOWER($1))`];
    const values = [`%${query}%`];
    let i = 2;

    if (category) { clauses.push(`category = $${i}`); values.push(category); i++; }
    if (location) { clauses.push(`location = $${i}`); values.push(location); i++; }
    if (minPrice) { clauses.push(`price >= $${i}`); values.push(minPrice); i++; }
    if (maxPrice) { clauses.push(`price <= $${i}`); values.push(maxPrice); i++; }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const { rows } = await pool.query(
      `SELECT * FROM public.postings
       ${where}
       ORDER BY created_at DESC
       LIMIT 100`,
      values
    );

    res.json(rows);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Server error during search." });
  }
});

export default router;
