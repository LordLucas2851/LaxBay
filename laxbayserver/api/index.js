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

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (allowedOrigins.includes(origin) || !origin) {
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

app.use('/uploads', express.static('uploads'));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, 
  })
);

app.use("/store/register", registerRouter);
app.use("/store/login", loginRouter);
app.use("/store/create", postingRouter);
app.use("/store/user", userPostRouter);
app.use("/store/chat", chatBotRouter);
app.use("/store/admin", adminRouter);
app.use("/store/search", searchRouter);
app.use("/store", listingRouter);
app.use("/user", userRouter);

app.get("/", (req, res) => {
  try {
    res.send("Hello from Express Server");
  } catch (error) {
    console.error("Query error:", error);
    res.send("Sorry, error");
  }
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err.message });
});

app.listen(3000, () => console.log("Server running on port 3000"));