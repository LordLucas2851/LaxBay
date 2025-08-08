import express from "express";
import pool from "./PoolConnection.js";

const searchRouter = express.Router();

searchRouter.get("/", async (req, res) => {
  const { query = "", category, location, minPrice, maxPrice } = req.query;

  let sql = `SELECT * FROM postings WHERE (LOWER(title) LIKE LOWER($1) OR LOWER(description) LIKE LOWER($1))`;
  const values = [`%${query}%`];
  let count = 2;

  if (category) {
    sql += ` AND category = $${count++}`;
    values.push(category);
  }
  if (location) {
    sql += ` AND location = $${count++}`;
    values.push(location);
  }
  if (minPrice) {
    sql += ` AND price >= $${count++}`;
    values.push(minPrice);
  }
  if (maxPrice) {
    sql += ` AND price <= $${count++}`;
    values.push(maxPrice);
  }

  try {
    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Server error during search." });
  }
});

export default searchRouter;