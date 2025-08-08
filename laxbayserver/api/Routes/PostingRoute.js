import express from "express";
import multer from "multer";
import pool from "./PoolConnection.js";

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, 
});

const postingRouter = express.Router();

postingRouter.post("/", upload.single("image"), async (req, res) => {
  const { title, description, price, category, location } = req.body;

  const username = req.session.username;

  if (!username) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  if (!title || !description || !price || !category || !location) {
    return res.status(400).json({ error: "All fields must be provided" });
  }

  let imagePath = null;
  if (req.file) {
    imagePath = req.file.path; 
  }

  try {
    const result = await pool.query(
      `INSERT INTO postings (username, title, description, price, category, location, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [username, title, description, price, category, location, imagePath]
    );

    res.status(201).json({ message: "Post created successfully", post: result.rows[0] });
  } catch (error) {
    console.error("Post creation error:", error.message); 
    console.error(error.stack);
    res.status(500).json({ error: "Server error. Please try again later." });
  }  
});

export default postingRouter;