// api/Routes/ChatBotRoute.js
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "./PoolConnection.js";

const router = express.Router();

/* ---------- config ---------- */

const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://lax-bay.vercel.app";
const MAX_LISTINGS = Number(process.env.CHAT_MAX_LISTINGS || 12);
const MAX_DESC_CHARS = Number(process.env.CHAT_DESC_CHARS || 160);

/* ---------- helpers ---------- */

// Normalize request body. Accepts {prompt} or {message}, optional {messages, system}.
function normBody(body = {}) {
  const prompt = (typeof body.prompt === "string" && body.prompt.trim())
    ? body.prompt.trim()
    : (typeof body.message === "string" ? body.message.trim() : "");
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system = typeof body.system === "string" ? body.system : "";
  return { prompt, messages, system };
}

// Split prompt into crude keywords for ILIKE search.
function extractTerms(text) {
  const stop = new Set(["the","a","an","and","or","of","for","to","is","are","in","on","with","my","your","our","their","at","by","from","about","what","how","do","i","you"]);
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w && !stop.has(w))
    .slice(0, 6);
}

// Truncate a string to N chars (clean, single line).
function snip(s, n) {
  if (!s) return "";
  const one = String(s).replace(/\s+/g, " ").trim();
  return one.length <= n ? one : one.slice(0, n - 1) + "…";
}

// Query your "postings" table for relevant rows.
async function fetchRelevantListings(prompt) {
  const terms = extractTerms(prompt);
  if (terms.length === 0) {
    // No obvious keywords → show latest
    const { rows } = await pool.query(
      `SELECT id, title, description, price, category, location
         FROM postings
        ORDER BY id DESC
        LIMIT $1`,
      [MAX_LISTINGS]
    );
    return rows;
  }

  // Build ILIKE conditions: (title ILIKE %term% OR description ILIKE %term%)
  const wheres = [];
  const params = [];
  let idx = 1;

  for (const t of terms) {
    const like = `%${t}%`;
    wheres.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
    params.push(like);
    idx++;
  }
  params.push(MAX_LISTINGS);

  const { rows } = await pool.query(
    `SELECT id, title, description, price, category, location
       FROM postings
      WHERE ${wheres.join(" AND ")}
      ORDER BY id DESC
      LIMIT $${idx}`,
    params
  );

  // If nothing matched, fall back to latest N
  if (rows.length === 0) {
    const latest = await pool.query(
      `SELECT id, title, description, price, category, location
         FROM postings
        ORDER BY id DESC
        LIMIT $1`,
      [MAX_LISTINGS]
    );
    return latest.rows;
  }

  return rows;
}

// Build the inventory context block shown to the model.
function listingsToContext(rows = []) {
  if (!rows.length) return "No matching listings found right now.";
  const lines = rows.map(r => {
    const url = `${SITE_ORIGIN}/post/${r.id}`;
    const price = (r.price != null && r.price !== "") ? `$${r.price}` : "";
    const loc = r.location ? ` • ${r.location}` : "";
    const cat = r.category ? ` • ${r.category}` : "";
    const desc = snip(r.description || "", MAX_DESC_CHARS);
    return `• [${r.id}] ${r.title} ${price}${loc}${cat}\n  ${url}\n  ${desc}`;
  });
  return lines.join("\n");
}

// Assemble the final prompt for the model.
function buildPrompt({ messages = [], prompt = "", system = "" }, listingsContext = "") {
  const lines = [];
  const sysDefault =
    "You are LaxBay's helpful assistant. Be concise, friendly, and accurate. " +
    "If the user asks about items for sale, prefer recommending from the Listings Context. " +
    "When referencing an item, include its id and the URL if helpful.";

  lines.push(`System: ${system || sysDefault}`);

  if (listingsContext) {
    lines.push("\nListings Context (latest &/or relevant):\n" + listingsContext + "\n");
  }

  if (Array.isArray(messages)) {
    for (const m of messages) {
      const role = (m?.role || "user").trim();
      const content = typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
      lines.push(`${role[0].toUpperCase() + role.slice(1)}: ${content}`);
    }
  }
  if (prompt) lines.push(`User: ${prompt}`);
  lines.push("Assistant:");
  return lines.join("\n");
}

function getModel() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Missing GOOGLE_API_KEY env var");
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: modelName });
}

/* ---------- routes ---------- */

// Health
router.get("/", (_req, res) => {
  res.json({ ok: true, model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
});

// Non-streaming: POST /api/store/chat
router.post("/", async (req, res) => {
  try {
    const body = normBody(req.body);
    const rows = await fetchRelevantListings(body.prompt);
    const context = listingsToContext(rows);
    const text = buildPrompt(body, context);

    const model = getModel();
    const result = await model.generateContent(text);
    const out = result?.response?.text?.() || "";

    res.json({ text: out, usedListings: rows.map(r => r.id) });
  } catch (err) {
    console.error("chat error:", err);
    const status = String(err?.message || "").includes("GOOGLE_API_KEY") ? 500 : 500;
    res.status(status).json({ error: "chat error", detail: err.message });
  }
});

// Streaming SSE: POST /api/store/chat/stream
router.post("/stream", async (req, res) => {
  // SSE headers
  res.set({
    "Cache-Control": "no-cache, no-transform",
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
  });
  if (res.flushHeaders) res.flushHeaders();

  try {
    const body = normBody(req.body);
    const rows = await fetchRelevantListings(body.prompt);
    const context = listingsToContext(rows);
    const text = buildPrompt(body, context);

    const model = getModel();
    const result = await model.generateContent(text);
    const out = result?.response?.text?.() || "";

    // Send one payload containing the answer + which listing ids were considered.
    res.write(`data: ${JSON.stringify({ text: out, usedListings: rows.map(r => r.id) })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("chat stream error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

export default router;
