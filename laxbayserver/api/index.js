// index.js (ESM)
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

dotenv.config();

const app = express();

// Required for secure cookies behind Vercel/any proxy
app.set("trust proxy", 1);

// --- CORS ---
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://lax-bay.vercel.app", // your frontend on Vercel
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS policy: Not allowed origin"), false);
    },
    credentials: true, // allow cookies
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// NOTE: Vercel's filesystem is ephemeral. This will serve files that exist
// in the deployment, but uploaded files won't persist across deployments.
// Keep for now if you already reference /uploads/... in image URLs.
app.use("/uploads", express.static("uploads"));

// --- Sessions (persisted; required on Vercel) ---
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL, // Neon/PG connection string
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET, // set in Vercel env
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,       // Vercel is HTTPS
      sameSite: "none",   // cross‑site cookies (frontend ↔ backend)
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  })
);

// ---------------- API ROUTES (now all under /api) ----------------
app.use("/api/store/register", registerRouter);
app.use("/api/store/login", loginRouter);
app.use("/api/store/create", postingRouter);
app.use("/api/store/user", userPostRouter);
app.use("/api/store/chat", chatBotRouter);
app.use("/api/store/admin", adminRouter);
app.use("/api/store/search", searchRouter);
app.use("/api/store", listingRouter);
app.use("/api/user", userRouter);

// Healthcheck
app.get("/api", (req, res) => {
  res.send("Hello from Express Server");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err.message });
});

// IMPORTANT: Do NOT app.listen on Vercel. Export the app instead.
export default app;
