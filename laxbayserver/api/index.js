import express from "express";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";
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

// List of allowed origins for CORS.  Include localhost ports for development and your deployed frontend.
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://lax-bay.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) or if origin is in the whitelist
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy: Not allowed origin"), false);
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use("/uploads", express.static("uploads"));

// Configure session cookies.  Use secure cookies and proper sameSite in production
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

// Mount routers
app.use("/store/register", registerRouter);
app.use("/store/login", loginRouter);
app.use("/store/create", postingRouter);
app.use("/store/user", userPostRouter);
app.use("/store/chat", chatBotRouter);
app.use("/store/admin", adminRouter);
app.use("/store/search", searchRouter);
app.use("/store", listingRouter);
app.use("/user", userRouter);

// Healthcheck
app.get("/", (req, res) => {
  try {
    res.send("Hello from Express Server");
  } catch (error) {
    console.error("Query error:", error);
    res.send("Sorry, error");
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err.message });
});

// Listen on the port provided by the hosting platform or default to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));