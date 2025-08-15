// api/Routes/UserPostsRoute.js
import express from "express";
import pg from "pg";
import multer from "multer";

const router = express.Router();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Multer for optional image upload
const upload = multer({ dest: "uploads/" });

// GET a single post that belongs to the logged-in user
router.get("/posts/:id", async (req, res) => {
  try {
    const username = req.session?.username;
    if (!username) return res.status(401).json({ error: "Not authenticated" });

    const { rows } = await pool.query(
      "SELECT * FROM listings WHERE id = $1 AND username = $2",
      [req.params.id, username]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("Fetch post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE a post (title/desc/price/category/location; image optional)
router.put("/posts/:id", upload.single("image"), async (req, res) => {
  try {
    const username = req.session?.username;
    if (!username) return res.status(401).json({ error: "Not authenticated" });

    const { rows: owned } = await pool.query(
      "SELECT id FROM listings WHERE id = $1 AND username = $2",
      [req.params.id, username]
    );
    if (owned.length === 0) {
      return res.status(403).json({ error: "Not your post or not found" });
    }

    const { title, description, price, category, location } = req.body;
    const imagePath = req.file ? req.file.path : undefined;

    const { rows } = await pool.query(
      `UPDATE listings
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             price = COALESCE($3, price),
             category = COALESCE($4, category),
             location = COALESCE($5, location),
             image = COALESCE($6, image),
             updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, description, price, category, location, imagePath, req.params.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Update post error:", err);
    res.status(500).json({ error: "Server error updating post" });
  }
});

export default router;
