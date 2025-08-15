// api/Routes/AdminRoute.js
import express from "express";
import multer from "multer";
import axios from "axios";
import pool from "./PoolConnection.js";

const router = express.Router();
// TODO: replace with real admin check
const requireAdmin = (req, _res, next) => next();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Accept JSON base64 (imageData/image) or multipart file, store as data-URL in DB
function extractImageData(req) {
  const data = req.body?.imageData || req.body?.image;
  if (data && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(String(data))) {
    return String(data);
  }
  if (req.file?.buffer) {
    const mime = req.file.mimetype || "image/png";
    const b64 = req.file.buffer.toString("base64");
    return `data:${mime};base64,${b64}`;
  }
  return undefined; // "no change" for updates
}

/**
 * Mounted at /api/store/admin
 * Supported:
 *   GET    /posts           , /listings
 *   GET    /posts/:id       , /listings/:id       , /postdetails/:id
 *   PUT    /posts/:id       , /listings/:id       , /postdetails/:id
 *   POST   /posts/:id/image , /listings/:id/image , /postdetails/:id/image  (image-only)
 *   DELETE /posts/:id       , /listings/:id       , /postdetails/:id
 *   POST   /migrate-uploads (one-shot migration from GitHub -> DB data-URLs)
 */

// List
router.get(["/posts", "/listings"], requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { rows } = await pool.query(
      `SELECT * FROM postings ORDER BY id DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    console.error("Admin list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get one (mirrors postdetails)
router.get(["/posts/:id", "/listings/:id", "/postdetails/:id"], requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM postings WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Admin get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Edit (JSON or multipart; supports partial updates + ignores empty strings)
router.put(
  ["/posts/:id", "/listings/:id", "/postdetails/:id"],
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title = "", description = "", price = "", category = "", location = "" } = req.body;
      const imageValue = extractImageData(req); // undefined => keep current

      const params = [
        title,          // $1
        description,    // $2
        price,          // $3
        category,       // $4
        location,       // $5
        imageValue,     // $6 (may be undefined)
        req.params.id,  // $7
      ];

      const { rows } = await pool.query(
        `UPDATE postings
           SET title       = COALESCE(NULLIF($1, ''), title),
               description = COALESCE(NULLIF($2, ''), description),
               price       = COALESCE(NULLIF($3, '')::numeric, price),
               category    = COALESCE(NULLIF($4, ''), category),
               location    = COALESCE(NULLIF($5, ''), location),
               image       = COALESCE($6, image)
         WHERE id = $7
         RETURNING *`,
        params
      );

      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("Admin update error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Image-only endpoint (JSON base64 or multipart)
router.post(
  ["/posts/:id/image", "/listings/:id/image", "/postdetails/:id/image"],
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const imageValue = extractImageData(req);
      if (!imageValue) return res.status(400).json({ error: "No image provided" });

      const { rows } = await pool.query(
        `UPDATE postings SET image = $1 WHERE id = $2 RETURNING *`,
        [imageValue, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("Admin image-only update error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Delete
router.delete(["/posts/:id", "/listings/:id", "/postdetails/:id"], requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM postings WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    console.error("Admin delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- One-shot migration: uploads/* -> DB data-URLs ----------
const RAW_BASES = [
  ...(process.env.GITHUB_UPLOADS_BASE
    ? process.env.GITHUB_UPLOADS_BASE.split(",").map(s => s.trim()).filter(Boolean)
    : []),
  "https://raw.githubusercontent.com/LordLucas2851/LaxBay/main/laxbayserver/uploads",
  "https://raw.githubusercontent.com/LordLucas2851/LaxBay/main/uploads",
];

router.post("/migrate-uploads", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, image FROM postings WHERE image LIKE 'uploads/%' ORDER BY id ASC LIMIT 500`
    );

    const migrated = [];
    const missed = [];

    for (const row of rows) {
      const fname = row.image.replace(/^uploads\//, "");
      let buf = null;
      const tried = [];

      for (const base of RAW_BASES) {
        const url = `${base}/${encodeURIComponent(fname)}`;
        tried.push(url);
        try {
          const r = await axios.get(url, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "laxbay-server" },
          });
          buf = Buffer.from(r.data);
          break;
        } catch {
          // next base
        }
      }

      if (!buf) {
        missed.push({ id: row.id, file: fname, tried });
        continue;
      }

      const ext = (fname.split(".").pop() || "").toLowerCase();
      const mime =
        ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
        ext === "png" ? "image/png" :
        ext === "webp" ? "image/webp" : "application/octet-stream";

      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      await pool.query(`UPDATE postings SET image = $1 WHERE id = $2`, [dataUrl, row.id]);
      migrated.push(row.id);
    }

    res.json({ migrated_count: migrated.length, migrated, missed_count: missed.length, missed });
  } catch (err) {
    console.error("migrate-uploads error:", err);
    res.status(500).json({ error: "Migration failed", detail: err.message });
  }
});

export default router;
