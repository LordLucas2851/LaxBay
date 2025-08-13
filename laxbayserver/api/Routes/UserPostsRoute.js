import express from "express";
import multer from "multer";
import path from "path";
import pool from "./PoolConnection.js";

const userPostRouter = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
});

const upload = multer({ storage });

// You also serve /uploads at app level; this is harmless but optional here
userPostRouter.use("/uploads", express.static("uploads"));

userPostRouter.get("/", async (req, res) => {
  const username = req.session?.username;
  if (!username) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM postings WHERE username = $1 ORDER BY id DESC",
      [username]
    );
    // ✅ Return 200 with [] when no posts
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching user posts:", error);
    return res.status(500).json({ error: "Failed to fetch user posts" });
  }
});

userPostRouter.get("/post/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM postings WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching post by ID:", error);
    return res.status(500).json({ error: "Failed to fetch post" });
  }
});

userPostRouter.put("/update/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { title, description, price, category, location } = req.body;
  const username = req.session?.username; // ensure the editor owns it
  const newImagePath = req.file ? `uploads/${req.file.filename}` : null;

  if (!username) return res.status(401).json({ error: "Unauthorized" });

  try {
    const current = await pool.query(
      "SELECT * FROM postings WHERE id = $1 AND username = $2",
      [id, username]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const imageToSave = newImagePath || current.rows[0].image;

    const result = await pool.query(
      `UPDATE postings 
       SET title = $1, description = $2, price = $3, category = $4, location = $5, image = $6
       WHERE id = $7 AND username = $8
       RETURNING *`,
      [title, description, price, category, location, imageToSave, id, username]
    );

    return res.json({ message: "Post updated", post: result.rows[0] });
  } catch (err) {
    console.error("Update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

userPostRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const username = req.session?.username;
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      "DELETE FROM postings WHERE id = $1 AND username = $2 RETURNING *",
      [id, username]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(200).json({ message: "Post deleted successfully." });
  } catch (err) {
    console.error("Error deleting post:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default userPostRouter;
