import express from "express";
import multer from "multer";
import path from "path";
import pool from "./PoolConnection.js";

const userPostRouter = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

userPostRouter.use("/uploads", express.static("uploads"));

userPostRouter.get("/", async (req, res) => {
  const username = req.session.username;

  if (!username) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM postings WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No posts found for this user." });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({ error: "Failed to fetch user posts" });
  }
});

userPostRouter.get("/post/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM postings WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching post by ID:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

userPostRouter.put("/update/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { title, description, price, category, location } = req.body;
  const newImagePath = req.file ? `uploads/${req.file.filename}` : null;

  try {
    const currentPost = await pool.query("SELECT * FROM postings WHERE id = $1", [id]);

    if (currentPost.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const imageToSave = newImagePath || currentPost.rows[0].image;

    const result = await pool.query(
      `UPDATE postings 
       SET title = $1, description = $2, price = $3, category = $4, location = $5, image = $6
       WHERE id = $7 RETURNING *`,
      [title, description, price, category, location, imageToSave, id]
    );

    res.json({ message: "Post updated", post: result.rows[0] });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

userPostRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM postings WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.status(200).json({ message: "Post deleted successfully." });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default userPostRouter;