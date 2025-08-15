import express from "express";
import multer from "multer";
import pool from "./PoolConnection.js";

const router = express.Router();

// Use memory storage to avoid writing temp files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Helper: turn multipart file buffer into data URL; or use provided imageData
function extractImageData(req) {
  // JSON base64 path
  const data = req.body?.imageData || req.body?.image;
  if (data && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(String(data))) {
    return String(data);
  }
  // Multipart file path
  if (req.file?.buffer) {
    const mime = req.file.mimetype || "image/png";
    const b64 = req.file.buffer.toString("base64");
    return `data:${mime};base64,${b64}`;
  }
  return null;
}

// Mounted at /api/store/create  => POST /api/store/create/
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const username = req.session?.username;
    if (!username) return res.status(401).json({ error: "User not authenticated" });

    const { title, description, price, category, location } = req.body;
    if (!title || !description || !price || !category || !location) {
      return res.status(400).json({ error: "All fields must be provided" });
    }

    const imageValue = extractImageData(req); // may be null

    const { rows } = await pool.query(
      `INSERT INTO public.postings
         (username, title, description, price, category, location, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [username, title, description, price, category, location, imageValue]
    );

    res.status(201).json({ message: "Post created successfully", post: rows[0] });
  } catch (error) {
    console.error("Post creation error:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

export default router;
