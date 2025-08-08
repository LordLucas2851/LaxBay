import express from "express";
import pool from "./PoolConnection.js";

const adminRouter = express.Router();

adminRouter.get("/listings", async (req, res) => {
  try {
    const results = await pool.query("SELECT * FROM postings");
    res.json(results.rows);
  } catch (err) {
    console.error("Error fetching all listings for admin:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

adminRouter.delete("/posts/:id", async (req, res) => {
  const postId = req.params.id;
  try {
    const result = await pool.query("DELETE FROM postings WHERE id = $1", [postId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default adminRouter;