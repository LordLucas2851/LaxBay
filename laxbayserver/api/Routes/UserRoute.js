import express from "express";
import pool from "./PoolConnection.js";

const userRouter = express.Router();

userRouter.get("/email/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query("SELECT email FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ email: result.rows[0].email });
  } catch (error) {
    console.error("Error fetching user email:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default userRouter;