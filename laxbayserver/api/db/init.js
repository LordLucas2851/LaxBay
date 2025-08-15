// api/db/init.js
import { pool } from "./pool.js";

// Optional utility to ensure we are on the right schema
export async function ensureSearchPath() {
  try {
    await pool.query(`SET search_path TO public, "$user";`);
    console.log("✅ Search path set to public");
  } catch (err) {
    console.error("❌ Failed to set search_path:", err);
  }
}
