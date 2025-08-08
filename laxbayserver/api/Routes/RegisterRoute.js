import express from "express";
import pool from "./PoolConnection.js";

const registerRouter = express.Router();

registerRouter.post("/", async (req, res) => {
  const { firstName, lastName, email, username, password, address, city, zipCode } = req.body;

  if (!firstName || !lastName || !email || !username || !password || !address || !city || !zipCode) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const emailCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists." });
    }

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, username, password, address, city, zip_code) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, first_name, last_name, email, username, address, city, zip_code`,
      [firstName, lastName, email, username, password, address, city, zipCode]
    );

    res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

export default registerRouter;