// api/index.js
import express from "express";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

import registerRouter from "./Routes/RegisterRoute.js";
import loginRouter from "./Routes/LoginRoute.js";
import postingRouter from "./Routes/PostingRoute.js";
import userPostRouter from "./Routes/UserPostsRoute.js";
import chatBotRouter from "./Routes/ChatBotRoute.js";
import adminRouter from "./Routes/AdminRoute.js";
import searchRouter from "./Routes/SearchRoute.js";
import listingRouter from "./Routes/ListingRoute.js";
import userRouter from "./Routes/UserRoute.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

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

// ---- Health check routes ----

// Simple DB pool (optional DB check)
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Lightweight health check
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

// API-prefixed health check
app.get("/api/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ---- Main API routes ----
app.use("/api/store/register", registerRouter);
app.use("/api/store/login", loginRouter);
app.use("/api/store/create", postingRouter);
app.use("/api/store/user", userPostRouter);
app.use("/api/store/chat", chatBotRouter);
app.use("/api/store/admin", adminRouter);
app.use("/api/store/search", searchRouter);
app.use("/api/store", listingRouter);
app.use("/api/user", userRouter);

// Healthcheck for humans
app.get("/api", (req, res) => {
  res.send("Hello from Express Server");
});

// Debug route list
app.get("/api/_debug/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route && m.route.path) {
      routes.push({ path: m.route.path, methods: m.route.methods });
    } else if (m.name === "router" && m.handle.stack) {
      m.handle.stack.forEach((h) => {
        if (h.route) {
          routes.push({ path: h.route.path, methods: h.route.methods });
        }
      });
    }
  });
  res.json(routes);
});

// 404 logger
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Not found" });
});

export default app;
