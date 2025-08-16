// api/Routes/LoginRoute.js
import express from "express";
import bcrypt from "bcrypt";
import pool from "./PoolConnection.js";

const loginRouter = express.Router();

loginRouter.post("/", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Please fill in all fields" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE lower(email) = lower($1)",
      [String(email).trim().toLowerCase()]
    );
    if (!rows.length) return res.status(400).json({ error: "Invalid email or password" });
    const user = rows[0];

    const ok = user.password_hash
      ? await bcrypt.compare(password, user.password_hash)
      : (user.password && user.password === password); // TEMP compatibility

    if (!ok) return res.status(400).json({ error: "Invalid email or password" });

    // minimal session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role || "user";

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        username: user.username,
        city: user.city,
        zipCode: user.zip_code,
        role: req.session.role
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

export default loginRouter;
