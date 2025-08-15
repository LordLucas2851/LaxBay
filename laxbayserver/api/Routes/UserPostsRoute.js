import express from "express";
import pg from "pg";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

const mustBeAuthed = (req, res) => {
  const username = req.session?.username;
  if (!username) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return username;
};

// GET your own post by ID
// supports both /post/:id and /posts/:id
router.get(["/post/:id", "/posts/:id"], async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rows } = await pool.query(
      `SELECT * FROM postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Fetch post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE your own post by ID (image optional)
// supports both /update/:id and /posts/:id
router.put(["/update/:id", "/posts/:id"], upload.single("image"), async (req, res) => {
  try {
    const username = mustBeAuthed(req, res);
    if (!username) return;

    const { rows: owned } = await pool.query(
      `SELECT id FROM postings WHERE id = $1 AND username = $2`,
      [req.params.id, username]
    );
    if (owned.length === 0) {
      return res.status(403).json({ error: "Not your post or not found" });
    }

    const { title, description, price, category, location } = req.body;
    const imagePath = req.file ? req.file.path : undefined;

    const { rows } = await pool.query(
      `UPDATE postings
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
