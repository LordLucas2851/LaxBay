import express from "express";
import multer from "multer";
import pool from "./PoolConnection.js";
import { validateListingBody } from "./validators.js";

const router = express.Router();

// 5MB, memory buffer (fine for now; we'll move to S3 next step)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function extractImageData(req) {
  // Accept base64 data URL in JSON OR a multipart file
  const data = req.body?.imageData || req.body?.image;
  if (data && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(String(data))) {
    return String(data);
  }

  if (req.file?.buffer) {
    // Only allow images
    const mime = req.file.mimetype || "";
    if (!/^image\/(png|jpe?g|webp)$/i.test(mime)) {
      return { error: "Only PNG, JPEG, or WEBP images are allowed" };
    }
    const b64 = req.file.buffer.toString("base64");
    return `data:${mime};base64,${b64}`;
  }

  // Optional image: return null explicitly (DB column can be null)
  return null;
}

// Helper: require auth
function requireAuth(req, res) {
  const username = req.session?.username;
  if (!username) {
    res.status(401).json({ error: "User not authenticated" });
    return null;
  }
  return username;
}

// POST /api/store/create
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const username = requireAuth(req, res);
    if (!username) return;

    // Normalize inputs (trim)
    const title       = String(req.body?.title ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    const price       = req.body?.price;      // keep as-is for validator
    const category    = String(req.body?.category ?? "").trim();
    const location    = String(req.body?.location ?? "").trim();

    // Validate required fields, price numeric range, category whitelist, lengths
    const err = validateListingBody({ title, description, price, category, location });
    if (err) return res.status(400).json({ error: err });

    // Image processing (optional)
    const img = extractImageData(req);
    if (img && typeof img === "object" && img.error) {
      return res.status(400).json({ error: img.error });
    }
    const imageValue = typeof img === "string" ? img : null;

    // Insert (CAST price to numeric in SQL)
    const { rows } = await pool.query(
      `INSERT INTO postings
         (username, title, description, price, category, location, image)
       VALUES ($1, $2, $3, $4::numeric, $5, $6, $7)
       RETURNING *`,
      [username, title, description, price, category, location, imageValue]
    );

    return res.status(201).json({ message: "Post created successfully", post: rows[0] });
  } catch (error) {
    console.error("Post creation error:", error);
    return res.status(500).json({ error: "Server error. Please try again later." });
  }
});

export default router;
