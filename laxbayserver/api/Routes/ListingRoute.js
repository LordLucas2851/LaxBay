import express from "express";
import pool from "./PoolConnection.js"; 

const listingRouter = express.Router();

listingRouter.get("/", async (req, res) => {
  const searchTerm = req.query.search || "";

  try {
    const result = await pool.query(
      "SELECT * FROM postings WHERE name ILIKE $1 OR description ILIKE $1", 
      [`%${searchTerm}%`]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching listings:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

listingRouter.get("/recommended", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM postings
      ORDER BY RANDOM()
      LIMIT 5
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching recommended listings:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

listingRouter.get("/postdetails/:postId", async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await pool.query("SELECT * FROM postings WHERE id = $1", [postId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching post details:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

export default listingRouter;
