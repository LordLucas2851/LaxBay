// api/index.js
import express from "express";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import axios from "axios"; // used for GitHub fallback on legacy /uploads/*

/* Routers */
import registerRouter from "./Routes/RegisterRoute.js";
import loginRouter from "./Routes/LoginRoute.js";
import postingRouter from "./Routes/PostingRoute.js";
import userPostRouter from "./Routes/UserPostsRoute.js";
import chatBotRouter from "./Routes/ChatBotRoute.js";
import adminRouter from "./Routes/AdminRoute.js";
import searchRouter from "./Routes/SearchRoute.js";
import listingRouter from "./Routes/ListingRoute.js";
import userRouter from "./Routes/UserRoute.js";

/* DB pool */
import pool from "./Routes/PoolConnection.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

/* ---------- Paths & legacy /uploads support ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// keep a local uploads dir for any legacy files (dev/local use)
// (Option B stores images in DB; this is just for old rows that still have "uploads/<file>")
const UPLOAD_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Legacy /uploads fallback:
 * 1) Try file on disk  (../uploads/<file>)
 * 2) Try GitHub raw (set GITHUB_UPLOADS_BASE env; default points to your repo)
 * 3) Return a 1x1 transparent PNG so UI doesn’t break
 */
const RAW_BASE_DEFAULT =
  "https://raw.githubusercontent.com/LordLucas2851/LaxBay/main/uploads";
const RAW_BASE = process.env.GITHUB_UPLOADS_BASE || RAW_BASE_DEFAULT;

app.get("/uploads/:file", async (req, res) => {
  try {
    const fname = req.params.file;

    // (1) local disk
    const onDisk = path.join(UPLOAD_DIR, fname);
    if (fs.existsSync(onDisk)) {
      return res.sendFile(onDisk);
    }

    // (2) GitHub raw fallback
    const url = `${RAW_BASE}/${encodeURIComponent(fname)}`;
    const gh = await axios.get(url, { responseType: "arraybuffer" });

    // basic content-type inference
    const ext = (fname.split(".").pop() || "").toLowerCase();
    const mime =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      "application/octet-stream";

    res.setHeader("Content-Type", mime);
    return res.status(200).send(Buffer.from(gh.data));
  } catch (e) {
    console.warn("[uploads:fallback-miss]", req.params.file, e?.response?.status || e?.message);
    // (3) transparent 1x1 PNG placeholder
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAk8B4O2b2ZcAAAAASUVORK5CYII=",
      "base64"
    );
    res.setHeader("Content-Type", "image/png");
    return res.status(200).send(png1x1);
  }
});

// also serve any local files placed under ../uploads (covers dev & new local writes)
app.use("/uploads", express.static(UPLOAD_DIR));

/* ---------- CORS ---------- */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://lax-bay.vercel.app",
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS policy: Not allowed origin"), false);
    },
    credentials: true,
  })
);

/* ---------- Body parsing (bigger for base64 images) ---------- */
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

/* ---------- Sessions (PG) ---------- */
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

/* ---------- Health ---------- */
app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", db: "ok", uptime: process.uptime() });
  } catch (e) {
    res.status(200).json({ status: "degraded", db: "error", error: e.message });
  }
});
app.get("/api/healthz", (_req, res) => res.status(200).json({ status: "ok" }));

/* ---------- API routes ---------- */
app.use("/api/store/register", registerRouter);
app.use("/api/store/login", loginRouter);
app.use("/api/store/create", postingRouter);
app.use("/api/store/user", userPostRouter);
app.use("/api/store/admin", adminRouter);
app.use("/api/store/search", searchRouter);
app.use("/api/store", listingRouter);
app.use("/api/user", userRouter);

/* ---------- Greeting & Debug ---------- */
app.get("/api", (_req, res) => res.send("Hello from Express Server"));

app.get("/api/_debug/db-info", async (_req, res) => {
  try {
    const info = await pool.query(`
      SELECT current_database() AS db, current_user AS db_user, current_schema() AS schema, version() AS version
    `);
    const tables = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type='BASE TABLE'
      ORDER BY table_schema, table_name
      LIMIT 200
    `);
    res.json({ info: info.rows[0], tables: tables.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/_debug/postings-sample", async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, username, title, created_at
      FROM postings
      ORDER BY id DESC
      LIMIT 5
    `);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- 404 logger (keep last) ---------- */
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Not found" });
});

export default app;
