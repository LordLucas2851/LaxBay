// index.js (for Render deployment)
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

// Behind Render/Proxy so cookies marked secure can be set correctly
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

// Tip: if your Neon DATABASE_URL requires SSL on Render, ensure the env
// includes `?sslmode=require` or configure a pg Pool with ssl instead.
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
      secure: process.env.NODE_ENV === "production", // secure only in prod
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// Routes
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

// ⛔️ Do NOT call app.listen here. server.js will handle it.
export default app;
