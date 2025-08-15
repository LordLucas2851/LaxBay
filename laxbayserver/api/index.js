// api/index.js
import express from "express";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";
import connectPgSimple from "connect-pg-simple";

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

// DB (shared pool + optional init)
import { pool } from "./db/pool.js";
import { ensureSearchPath } from "./db/init.js";

dotenv.config();

const app = express();

// Behind proxy (Render) so secure cookies work
app.set("trust proxy", 1);

// CORS
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

// Body + static
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// Sessions (Postgres-backed)
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
app.get("/healthz", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      db: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(200).json({
      status: "degraded",
      db: "error",
      error: e.message,
      uptime: process.uptime(),
    });
  }
});

app.get("/api/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Ensure search_path (non-fatal if it fails)
await ensureSearchPath().catch((e) =>
  console.error("ensureSearchPath error:", e)
);

// ---------- Main API routes ----------
app.use("/api/store/register", registerRouter);
app.use("/api/store/login", loginRouter);
app.use("/api/store/create", postingRouter);
app.use("/api/store/user", userPostRouter);
app.use("/api/store/chat", chatBotRouter);
app.use("/api/store/admin", adminRouter);
app.use("/api/store/search", searchRouter);
app.use("/api/store", listingRouter);
app.use("/api/user", userRouter);

// Simple greeting
app.get("/api", (req, res) => {
  res.send("Hello from Express Server");
});

// ---------- Debug endpoints ----------
app.get("/api/_debug/db-info", async (req, res) => {
  try {
    const db = await pool.query(`
      SELECT current_database() AS db,
             current_user     AS db_user,
             current_schema() AS schema,
             version()        AS version;
    `);
    const tables = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
      LIMIT 200;
    `);
    res.json({ info: db.rows[0], tables: tables.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/_debug/postings-sample", async (req, res) => {
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

// 404 logger (keep last)
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Not found" });
});

// Export only. server.js will listen.
export default app;
