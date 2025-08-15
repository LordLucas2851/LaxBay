import express from "express";
import multer from "multer";
import path from "path";
import pool from "./PoolConnection.js";
import { UPLOAD_DIR } from "../index.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const username = req.session?.username;
    if (!username) return res.status(401).json({ error: "User not authenticated" });

    const { title, description, price, category, location } = req.body;
    if (!title || !description || !price || !category || !location) {
      return res.status(400).json({ error: "All fields must be provided" });
    }

    // store a URL-friendly path that your frontend can render directly
    const imagePath = req.file ? `uploads/${req.file.filename}` : null;

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
