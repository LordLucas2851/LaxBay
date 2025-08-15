// api/index.js
import express from "express";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Routers
import registerRouter from "./Routes/RegisterRoute.js";
import loginRouter from "./Routes/LoginRoute.js";
import postingRouter from "./Routes/PostingRoute.js";
import userPostRouter from "./Routes/UserPostsRoute.js";
import chatBotRouter from "./Routes/ChatBotRoute.js";
import adminRouter from "./Routes/AdminRoute.js";
import searchRouter from "./Routes/SearchRoute.js";
import listingRouter from "./Routes/ListingRoute.js";
import userRouter from "./Routes/UserRoute.js";

// Single DB pool (your existing one)
import pool from "./Routes/PoolConnection.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

// ---------- Static /uploads (absolute path) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// uploads directory is ../uploads relative to this file
const UPLOAD_DIR = path.join(__dirname, "../uploads");

// make sure the folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// serve files at https://<host>/uploads/<filename>
app.use("/uploads", express.static(UPLOAD_DIR));

// ---------- CORS ----------
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

// ---------- Body parsing ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Sessions (Postgres-backed) ----------
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
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ---------- Health checks ----------
app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", db: "ok", uptime: process.uptime() });
  } catch (e) {
    res.status(200).json({ status: "degraded", db: "error", error: e.message });
  }
});

app.get("/api/healthz", (_req, res) => res.status(200).json({ status: "ok" }));

// ---------- Main API routes ----------
app.use("/api/store/register", registerRouter);
app.use("/api/store/login", loginRouter);
app.use("/api/store/create", postingRouter);   // POST /api/store/create/
app.use("/api/store/user", userPostRouter);    // GET/PUT /api/store/user/posts/:id
app.use("/api/store/admin", adminRouter);      // GET/DELETE /api/store/admin/listings(/:id)
app.use("/api/store/search", searchRouter);    // GET /api/store/search
app.use("/api/store", listingRouter);          // GET /api/store/listings(/:id, postdetails/:id)
app.use("/api/user", userRouter);

// Simple greeting
app.get("/api", (_req, res) => {
  res.send("Hello from Express Server");
});

// ---------- Debug helpers ----------
app.get("/api/_debug/db-info", async (_req, res) => {
  try {
    const info = await pool.query(`
      SELECT current_database() AS db,
             current_user AS db_user,
             current_schema() AS schema,
             version() AS version
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
      FROM public.postings
      ORDER BY id DESC
      LIMIT 5;
    `);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- 404 logger (keep last) ----------
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Not found" });
});

export default app;
