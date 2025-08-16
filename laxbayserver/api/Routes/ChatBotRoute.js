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

// Very simple filter extraction
function parseFilters(text = "") {
  const t = String(text).toLowerCase();
  let minPrice = null, maxPrice = null;

  const between = t.match(/\bbetween\s+(\d+)\s+(?:and|-)\s+(\d+)\b/);
  if (between) { minPrice = Number(between[1]); maxPrice = Number(between[2]); }

  const range = t.match(/\b(\d+)\s*-\s*(\d+)\b/);
  if (!between && range) { minPrice = Number(range[1]); maxPrice = Number(range[2]); }

  const under = t.match(/\b(under|below|less than)\s+(\d+)\b/);
  if (!between && !range && under) { maxPrice = Number(under[2]); }

  const over = t.match(/\b(over|above|more than)\s+(\d+)\b/);
  if (!between && over) { minPrice = Number(over[2]); }

  let location = null;
  const loc = t.match(/\bin\s+([a-z\s]+?)(?:[.,;]|$)/);
  if (loc) location = loc[1].trim();

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
  // ❌ No raw URLs in the context (so the model doesn’t print links)
  const lines = rows.map(r => {
    const price = (r.price != null && r.price !== "") ? `$${r.price}` : "";
    const loc = r.location ? ` • ${r.location}` : "";
    const cat = r.category ? ` • ${r.category}` : "";
    const desc = snip(r.description || "", MAX_DESC_CHARS);
    return `• [${r.id}] ${r.title} ${price}${loc}${cat}\n  ${desc}`;
  });
  return lines.join("\n");
}

function buildPrompt({ messages = [], prompt = "", system = "" }, listingsContext = "") {
  const lines = [];
  const sysDefault =
    "You are LaxBay's helpful assistant. Be concise, friendly, and accurate. " +
    "When recommending items, refer to them by id and title only. " +
    "Do NOT include raw URLs in your answer; the app will render buttons for navigation.";

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
  if (!Array.isArray(vec) || !vec.every(n => Number.isFinite(n))) {
    throw new Error("Embedding failed");
  }
  return vec;
}

/* ===== Retrieval filters ===== */

function filtersToWhere(filters) {
  const parts = [];
  const params = [];
  if (filters.minPrice != null) { parts.push(`price >= ?`); params.push(filters.minPrice); }
  if (filters.maxPrice != null) { parts.push(`price <= ?`); params.push(filters.maxPrice); }
  if (filters.location)         { parts.push(`LOWER(location) LIKE LOWER(?)`); params.push(`%${filters.location}%`); }
  if (filters.category)         { parts.push(`LOWER(category) LIKE LOWER(?)`); params.push(`%${filters.category}%`); }

  return { whereParts: parts, params };
}

/* ===== Retrieval queries ===== */

async function keywordListings(prompt, filters) {
  const terms = termsForKeyword(prompt);
  const { whereParts, params } = filtersToWhere(filters);

  const likeClauses = [];
  for (const _ of terms) {
    likeClauses.push(`(title ILIKE ? OR description ILIKE ?)`);
    // Push twice per term; we’ll substitute later
  }

  // Build SQL with positional placeholders we’ll convert to $1..$N
  let baseWhere = whereParts.join(" AND ");
  if (likeClauses.length) {
    baseWhere = baseWhere ? `${baseWhere} AND ${likeClauses.join(" AND ")}` : likeClauses.join(" AND ");
  }
  const whereSql = baseWhere ? `WHERE ${baseWhere}` : "";

  // Params: filters first, then term patterns (two per term)
  const allParams = [...params];
  for (const t of terms) {
    const pat = `%${t}%`;
    allParams.push(pat, pat);
  }
  allParams.push(MAX_LISTINGS);

  // Convert ? placeholders to $1..$N
  let idx = 0;
  const sql = `
    SELECT id, title, description, price, category, location
      FROM postings
      ${whereSql}
     ORDER BY id DESC
     LIMIT ?
  `.replace(/\?/g, () => `$${++idx}`);

  const { rows } = await pool.query(sql, allParams);
  return rows;
}

async function vectorListings(prompt, filters) {
  // 1) Get embedding as numbers
  let vec;
  try {
    vec = await embedText(prompt); // array of numbers
  } catch {
    return [];
  }

  // 2) First param is the vector literal string, cast as ::vector in SQL
  const vecLiteral = `[${vec.join(",")}]`; // pgvector literal: [n1,n2,...]
  const args = [vecLiteral]; // $1

  // 3) Build WHERE with placeholders that start AFTER $1
  const { whereParts, params: filterParams } = filtersToWhere(filters);
  let where = "";
  if (whereParts.length) {
    // Convert the generic ? placeholders to $2..$N
    let next = 2;
    const parts = whereParts.map(() => `$${next++}`);
    // Rebuild the WHERE with original expressions mapped to those placeholders
    // We need to rebuild each clause in order, substituting the right placeholder.
    next = 2;
    const rebuilt = whereParts.map(expr => expr.replace("?", `$${next++}`));
    where = "WHERE " + rebuilt.join(" AND ");
    args.push(...filterParams); // these occupy $2..$N
  }

  // 4) LIMIT placeholder comes last
  const limitIndex = args.length + 1;
  args.push(MAX_LISTINGS);

  const sql = `
    SELECT p.id, p.title, p.description, p.price, p.category, p.location,
           1 - (pe.embedding <=> $1::vector) AS similarity
      FROM posting_embeddings pe
      JOIN postings p ON p.id = pe.posting_id
      ${where}
     ORDER BY pe.embedding <=> $1::vector ASC
     LIMIT $${limitIndex};
  `;

  const { rows } = await pool.query(sql, args);
  return rows;
}

function mergeResults(keywordRows = [], vectorRows = []) {
  const map = new Map();
  for (const r of keywordRows) {
    map.set(r.id, { ...r, score: 0.5 });
  }
  for (const r of vectorRows) {
    const prev = map.get(r.id);
    const vs = typeof r.similarity === "number" ? r.similarity : 0.0;
    if (prev) {
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

    const usedItems = rows.map(r => ({
      id: r.id,
      title: r.title,
      price: r.price,
      location: r.location,
      url: `${SITE_ORIGIN}/postdetails/${r.id}`, // UI will render a button for this
    }));

    res.json({ text: out, usedItems, filters });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "chat error", detail: err.message });
  }
});

// Streaming SSE (one payload + done)
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

    const usedItems = rows.map(r => ({
      id: r.id,
      title: r.title,
      price: r.price,
      location: r.location,
      url: `${SITE_ORIGIN}/postdetails/${r.id}`,
    }));

    res.write(`data: ${JSON.stringify({ text: out, usedItems, filters })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("chat stream error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

export default router;
