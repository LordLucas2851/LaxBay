// api/Routes/ChatBotRoute.js
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "./PoolConnection.js";

const router = express.Router();

/* ===== Config ===== */
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://lax-bay.vercel.app";
const MAX_LISTINGS = Number(process.env.CHAT_MAX_LISTINGS || 12);
const MAX_DESC_CHARS = Number(process.env.CHAT_DESC_CHARS || 160);
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-004";

/* ===== Small helpers ===== */
function normBody(body = {}) {
  const prompt = (typeof body.prompt === "string" && body.prompt.trim())
    ? body.prompt.trim()
    : (typeof body.message === "string" ? body.message.trim() : "");
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system = typeof body.system === "string" ? body.system : "";
  return { prompt, messages, system };
}

function snip(s, n) {
  if (!s) return "";
  const one = String(s).replace(/\s+/g, " ").trim();
  return one.length <= n ? one : one.slice(0, n - 1) + "…";
}

// Very simple filter extraction (good enough to start)
function parseFilters(text = "") {
  const t = String(text).toLowerCase();

  // price range like: under 100, below 50, between 50 and 200, 50-200, over 300
  let minPrice = null, maxPrice = null;
  const between = t.match(/\bbetween\s+(\d+)\s+(?:and|-)\s+(\d+)\b/);
  if (between) { minPrice = Number(between[1]); maxPrice = Number(between[2]); }
  const range = t.match(/\b(\d+)\s*-\s*(\d+)\b/);
  if (!between && range) { minPrice = Number(range[1]); maxPrice = Number(range[2]); }
  const under = t.match(/\b(under|below|less than)\s+(\d+)\b/);
  if (!between && !range && under) { maxPrice = Number(under[2]); }
  const over = t.match(/\b(over|above|more than)\s+(\d+)\b/);
  if (!between && over) { minPrice = Number(over[2]); }

  // crude location: "in <word(s)>" (up to comma/period)
  let location = null;
  const loc = t.match(/\bin\s+([a-z\s]+?)(?:[.,;]|$)/);
  if (loc) location = loc[1].trim();

  // category: look for common nouns after "category" or "type"
  let category = null;
  const cat = t.match(/\b(category|type)\s+(?:is\s+)?([a-z\s]+)/);
  if (cat) category = cat[2].trim();

  return {
    minPrice: isFinite(minPrice) ? minPrice : null,
    maxPrice: isFinite(maxPrice) ? maxPrice : null,
    location,
    category
  };
}

function termsForKeyword(text) {
  const stop = new Set(["the","a","an","and","or","of","for","to","is","are","in","on","with","my","your","our","their","at","by","from","about","what","how","do","i","you"]);
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w && !stop.has(w))
    .slice(0, 6);
}

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

function buildPrompt({ messages = [], prompt = "", system = "" }, listingsContext = "") {
  const lines = [];
  const sysDefault =
    "You are LaxBay's helpful assistant. Be concise, friendly, and accurate. " +
    "When asked about available items, prefer recommending from the Listings Context by id/title and include the URL if helpful. " +
    "If asked for something not available, say so and suggest closest matches.";

  lines.push(`System: ${system || sysDefault}`);
  if (listingsContext) {
    lines.push("\nListings Context (relevant & latest):\n" + listingsContext + "\n");
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

function getTextModel() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Missing GOOGLE_API_KEY env var");
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: modelName });
}

async function embedText(s) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Missing GOOGLE_API_KEY env var");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const result = await model.embedContent(s);
  const vec = result?.embedding?.values;
  if (!vec || !Array.isArray(vec)) throw new Error("Embedding failed");
  return vec;
}

/* ===== Embedding maintenance ===== */

// Build text to embed from a posting row
function postingToEmbedDoc(p) {
  return [
    p.title || "",
    p.category ? `Category: ${p.category}` : "",
    p.location ? `Location: ${p.location}` : "",
    p.description || ""
  ].filter(Boolean).join("\n");
}

// Reindex embeddings for specific posting ids (array)
async function reindexForIds(ids = []) {
  if (!ids.length) return 0;
  const { rows } = await pool.query(
    `SELECT id, title, description, category, location
       FROM postings
      WHERE id = ANY($1::bigint[])`,
    [ids]
  );
  let count = 0;
  for (const p of rows) {
    const doc = postingToEmbedDoc(p);
    const vec = await embedText(doc);
    await pool.query(
      `INSERT INTO posting_embeddings (posting_id, embedding, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (posting_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()`,
      [p.id, vec]
    );
    count++;
  }
  return count;
}

// Reindex embeddings for all postings (up to a cap)
async function reindexAll(limit = 2000) {
  const { rows } = await pool.query(
    `SELECT id, title, description, category, location
       FROM postings
      ORDER BY id DESC
      LIMIT $1`,
    [limit]
  );
  let count = 0;
  for (const p of rows) {
    const doc = postingToEmbedDoc(p);
    const vec = await embedText(doc);
    await pool.query(
      `INSERT INTO posting_embeddings (posting_id, embedding, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (posting_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()`,
      [p.id, vec]
    );
    count++;
  }
  return count;
}

/* ===== Retrieval ===== */

function filtersToWhere(filters) {
  const parts = [];
  const params = [];
  let i = 1;

  if (filters.minPrice != null) { parts.push(`price >= $${i++}`); params.push(filters.minPrice); }
  if (filters.maxPrice != null) { parts.push(`price <= $${i++}`); params.push(filters.maxPrice); }
  if (filters.location) { parts.push(`LOWER(location) LIKE LOWER($${i++})`); params.push(`%${filters.location}%`); }
  if (filters.category) { parts.push(`LOWER(category) LIKE LOWER($${i++})`); params.push(`%${filters.category}%`); }

  return { where: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

// Keyword + filters (ILIKE)
async function keywordListings(prompt, filters) {
  const terms = termsForKeyword(prompt);
  const { where, params } = filtersToWhere(filters);
  let sql = `SELECT id, title, description, price, category, location
               FROM postings`;
  const likeClauses = [];

  let i = params.length + 1;
  for (const t of terms) {
    likeClauses.push(`(title ILIKE $${i} OR description ILIKE $${i})`);
    params.push(`%${t}%`);
    i++;
  }
  const filterAndLike =
    (where ? where + (likeClauses.length ? " AND " : "") : (likeClauses.length ? "WHERE " : "")) +
    likeClauses.join(" AND ");

  sql += ` ${filterAndLike} ORDER BY id DESC LIMIT $${i}`;
  params.push(MAX_LISTINGS);
  const { rows } = await pool.query(sql, params);
  return rows;
}

// Vector similarity + filters
async function vectorListings(prompt, filters) {
  let vec;
  try {
    vec = await embedText(prompt);
  } catch (e) {
    // embedding not available -> return []
    return [];
  }

  // Build filters on postings
  const { where, params } = filtersToWhere(filters);

  // Join with posting_embeddings using cosine distance
  const sql = `
    SELECT p.id, p.title, p.description, p.price, p.category, p.location,
           1 - (pe.embedding <=> $1) AS similarity
      FROM posting_embeddings pe
      JOIN postings p ON p.id = pe.posting_id
      ${where}
     ORDER BY pe.embedding <=> $1 ASC
     LIMIT $2
  `;
  const args = [vec, MAX_LISTINGS, ...params]; // params are only used in WHERE; order matters
  const { rows } = await pool.query(sql, args);
  return rows;
}

// Merge, score, de-dupe
function mergeResults(keywordRows = [], vectorRows = []) {
  const map = new Map();
  for (const r of keywordRows) {
    map.set(r.id, { ...r, score: 0.5 }); // base score
  }
  for (const r of vectorRows) {
    const prev = map.get(r.id);
    const vs = typeof r.similarity === "number" ? r.similarity : 0.0;
    if (prev) {
      // combine
      prev.score = Math.max(prev.score, 0.5 + vs * 0.5);
      map.set(r.id, prev);
    } else {
      map.set(r.id, { ...r, score: 0.5 + vs * 0.5 });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, MAX_LISTINGS);
}

/* ===== Routes ===== */

// Health
router.get("/", (_req, res) => {
  res.json({ ok: true, model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
});

// Non-stream
router.post("/", async (req, res) => {
  try {
    const body = normBody(req.body);
    const filters = parseFilters(body.prompt);

    const [kw, vec] = await Promise.all([
      keywordListings(body.prompt, filters),
      vectorListings(body.prompt, filters),
    ]);
    const rows = mergeResults(kw, vec);
    const context = listingsToContext(rows);
    const text = buildPrompt(body, context);

    const model = getTextModel();
    const result = await model.generateContent(text);
    const out = result?.response?.text?.() || "";

    res.json({ text: out, usedListings: rows.map(r => r.id), filters });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "chat error", detail: err.message });
  }
});

// Streaming SSE (single payload then done)
router.post("/stream", async (req, res) => {
  res.set({
    "Cache-Control": "no-cache, no-transform",
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
  });
  if (res.flushHeaders) res.flushHeaders();

  try {
    const body = normBody(req.body);
    const filters = parseFilters(body.prompt);

    const [kw, vec] = await Promise.all([
      keywordListings(body.prompt, filters),
      vectorListings(body.prompt, filters),
    ]);
    const rows = mergeResults(kw, vec);
    const context = listingsToContext(rows);
    const text = buildPrompt(body, context);

    const model = getTextModel();
    const result = await model.generateContent(text);
    const out = result?.response?.text?.() || "";

    res.write(`data: ${JSON.stringify({ text: out, usedListings: rows.map(r => r.id), filters })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("chat stream error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/* ===== Admin utilities ===== */

// Reindex all postings (up to limit)
router.post("/admin/reindex-all", async (_req, res) => {
  try {
    const count = await reindexAll(2000);
    res.json({ ok: true, reindexed: count });
  } catch (e) {
    res.status(500).json({ error: "reindex failed", detail: e.message });
  }
});

// Reindex specific ids: { ids: [1,2,3] }
router.post("/admin/reindex", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    const count = await reindexForIds(ids);
    res.json({ ok: true, reindexed: count });
  } catch (e) {
    res.status(500).json({ error: "reindex failed", detail: e.message });
  }
});

export default router;
