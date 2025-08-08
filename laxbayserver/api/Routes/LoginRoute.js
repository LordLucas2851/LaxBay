import express from "express";
import pool from "./PoolConnection.js";

const loginRouter = express.Router();

loginRouter.post("/", async (req, res) => {
  console.log("Login attempt: ", req.body);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Please fill in all fields" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    req.session.username = user.username;

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
        role: user.role
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

export default loginRouter;