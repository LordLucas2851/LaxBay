import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "./PoolConnection.js";

const router = express.Router();

/* ===== Config ===== */
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://lax-bay.vercel.app";
const MAX_LISTINGS = Number(process.env.CHAT_MAX_LISTINGS || 12);
const MAX_DESC_CHARS = Number(process.env.CHAT_DESC_CHARS || 160);
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-004";

/* ===== Helpers ===== */
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
    minPrice: Number.isFinite(minPrice) ? minPrice : null,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
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

/* ===== SQL where builder (with index offset) ===== */
function buildWhere(filters, startIndex = 1, tableAlias = "") {
  const a = tableAlias ? `${tableAlias}.` : "";
  const parts = [];
  const params = [];
  let i = startIndex;

  if (filters.minPrice != null) { parts.push(`${a}price >= $${i++}`); params.push(filters.minPrice); }
  if (filters.maxPrice != null) { parts.push(`${a}price <= $${i++}`); params.push(filters.maxPrice); }
  if (filters.location)         { parts.push(`LOWER(${a}location) LIKE LOWER($${i++})`); params.push(`%${filters.location}%`); }
  if (filters.category)         { parts.push(`LOWER(${a}category) LIKE LOWER($${i++})`); params.push(`%${filters.category}%`); }

  return { whereSql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params, nextIndex: i };
}

/* ===== Retrieval queries ===== */
async function keywordListings(prompt, filters) {
  const terms = termsForKeyword(prompt);

  // 1) Build filter WHERE ($1..$N)
  const { whereSql, params, nextIndex } = buildWhere(filters, 1, "p");

  // 2) Append term clauses continuing the index
  const likeClauses = [];
  let i = nextIndex;
  for (const t of terms) {
    likeClauses.push(`(p.title ILIKE $${i} OR p.description ILIKE $${i})`);
    params.push(`%${t}%`);
    i++;
  }

  const whereCombined =
    whereSql
      ? (likeClauses.length ? `${whereSql} AND ${likeClauses.join(" AND ")}` : whereSql)
      : (likeClauses.length ? `WHERE ${likeClauses.join(" AND ")}` : "");

  // 3) LIMIT placeholder
  const limitIndex = params.length + 1;
  params.push(MAX_LISTINGS);

  const sql = `
    SELECT p.id, p.title, p.description, p.price, p.category, p.location
      FROM postings p
      ${whereCombined}
     ORDER BY p.id DESC
     LIMIT $${limitIndex};
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function vectorListings(prompt, filters) {
  let vec;
  try {
    vec = await embedText(prompt);
  } catch {
    return [];
  }

  // $1 is always the vector
  const vecLiteral = `[${vec.join(",")}]`;
  const args = [vecLiteral];

  // Filters start at $2 and qualify columns with alias p
  const { whereSql, params } = buildWhere(filters, 2, "p");
  args.push(...params);

  // LIMIT is last
  const limitIndex = args.length + 1;
  args.push(MAX_LISTINGS);

  const sql = `
    SELECT p.id, p.title, p.description, p.price, p.category, p.location,
           1 - (pe.embedding <=> $1::vector) AS similarity
      FROM posting_embeddings pe
      JOIN postings p ON p.id = pe.posting_id
      ${whereSql}
     ORDER BY pe.embedding <=> $1::vector ASC
     LIMIT $${limitIndex};
  `;
  const { rows } = await pool.query(sql, args);
  return rows;
}

function mergeResults(keywordRows = [], vectorRows = []) {
  const map = new Map();
  for (const r of keywordRows) map.set(r.id, { ...r, score: 0.5 });

  for (const r of vectorRows) {
    const prev = map.get(r.id);
    const vs = typeof r.similarity === "number" ? r.similarity : 0.0;
    if (prev) {
      prev.score = Math.max(prev.score, 0.5 + vs * 0.5);
    } else {
      map.set(r.id, { ...r, score: 0.5 + vs * 0.5 });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, MAX_LISTINGS);
}

/* ===== Routes ===== */
router.get("/", (_req, res) => {
  res.json({ ok: true, model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
});

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
      url: `${SITE_ORIGIN}/postdetails/${r.id}`,
    }));

    res.json({ text: out, usedItems, filters });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "chat error", detail: err.message });
  }
});

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
