// api/db/pool.js
import pg from "pg";

// Uses DATABASE_URL from your environment variables
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Needed for Neon SSL connection
  }
});
