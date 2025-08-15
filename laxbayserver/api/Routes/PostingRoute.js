import express from "express";
import multer from "multer";
import pool from "./PoolConnection.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/**
 * Mounted at /api/store/create
 * Final path:
 *   POST /api/store/create/
 */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const username = req.session?.username;
    if (!username) return res.status(401).json({ error: "User not authenticated" });

    const { title, description, price, category, location } = req.body;
    if (!title || !description || !price || !category || !location) {
      return res.status(400).json({ error: "All fields must be provided" });
    }

    const imagePath = req.file ? req.file.path : null;

    const { rows } = await pool.query(
      `INSERT INTO public.postings
         (username, title, description, price, category, location, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [username, title, description, price, category, location, imagePath]
    );

    res.status(201).json({ message: "Post created successfully", post: rows[0] });
  } catch (error) {
    console.error("Post creation error:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

export default router;
