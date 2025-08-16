// api/Routes/RegisterRoute.js
import express from "express";
import bcrypt from "bcrypt";
import pool from "./PoolConnection.js";

const registerRouter = express.Router();

function cleanEmail(e=""){ return e.trim().toLowerCase(); }
function cleanUsername(u=""){ return u.trim(); }

registerRouter.post("/", async (req, res) => {
  const { firstName, lastName, email, username, password, address, city, zipCode } = req.body || {};

  // basic validation
  if (![firstName, lastName, email, username, password, address, city, zipCode].every(Boolean)) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const e = cleanEmail(email);
  const u = cleanUsername(username);

  try {
    // check collisions case-insensitively
    const dupe = await pool.query(
      "SELECT 1 FROM users WHERE lower(email)=lower($1) OR lower(username)=lower($2) LIMIT 1",
      [e, u]
    );
    if (dupe.rowCount) return res.status(400).json({ error: "Email or username already exists." });

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, username, password_hash, address, city, zip_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, first_name, last_name, email, username, address, city, zip_code`,
      [firstName, lastName, e, u, hash, address, city, zipCode]
    );

    res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

export default registerRouter;
