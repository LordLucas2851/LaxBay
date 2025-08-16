import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "./PoolConnection.js";

const router = express.Router();

/* ===== Config ===== */
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://lax-bay.vercel.app";
const MAX_LISTINGS = Number(process.env.CHAT_MAX_LISTINGS || 12);
const MAX_DESC_CHARS = Number(process.env.CHAT_DESC_CHARS || 160);
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-004";
const MAX_RELATED_LINKS = Number(process.env.CHAT_MAX_RELATED || 6); // how many buttons to show

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

  // Only capture category when explicitly stated as "category ..."
  let category = null;
  const cat = t.match(/\bcategory\s+(?:is\s+)?([a-z\s]+)/);
  if (cat) category = cat[1].trim();

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

/** Build the natural-language context the model sees (no numeric IDs shown). */
function listingsToContext(rows = []) {
  if (!rows.length) return "No matching listings found right now.";
  const lines = rows.map(r => {
    const price = (r.price != null && r.price !== "") ? `$${r.price}` : "";
    const loc = r.location ? ` • ${r.location}` : "";
    const cat = r.category ? ` • ${r.category}` : "";
    const desc = snip(r.description || "", MAX_DESC_CHARS);
    return `• ${r.title} ${price}${loc}${cat}\n  ${desc}`;
  });
  return lines.join("\n");
}

/** System prompt—no longer instructs by ID (titles only). */
function buildPrompt({ messages = [], prompt = "", system = "" }, listingsContext = "") {
  const lines = [];
  const sysDefault =
    "You are LaxBay's helpful assistant. Be concise, friendly, and accurate. " +
    "When recommending items, refer to them by title (no numeric IDs). " +
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

/* ===== Retrieval: keyword (OR terms) ===== */
async function keywordListings(prompt, filters) {
  const terms = termsForKeyword(prompt);
  const parts = [];
  const params = [];
  let i = 1;

  if (filters.minPrice != null) { parts.push(`p.price >= $${i++}`); params.push(filters.minPrice); }
  if (filters.maxPrice != null) { parts.push(`p.price <= $${i++}`); params.push(filters.maxPrice); }
  if (filters.location)         { parts.push(`LOWER(p.location) LIKE LOWER($${i++})`); params.push(`%${filters.location}%`); }
  if (filters.category)         { parts.push(`LOWER(p.category) LIKE LOWER($${i++})`); params.push(`%${filters.category}%`); }

  const termClauses = [];
  for (const t of terms) {
    termClauses.push(`(p.title ILIKE $${i} OR p.description ILIKE $${i})`);
    params.push(`%${t}%`);
    i++;
  }

  const where =
    parts.length && termClauses.length
      ? `WHERE ${parts.join(" AND ")} AND (${termClauses.join(" OR ")})`
      : parts.length
        ? `WHERE ${parts.join(" AND ")}`
        : termClauses.length
          ? `WHERE ${termClauses.join(" OR ")}`
          : "";

  params.push(MAX_LISTINGS);
  const sql = `
    SELECT p.id, p.title, p.description, p.price, p.category, p.location
      FROM postings p
      ${where}
     ORDER BY p.id DESC
     LIMIT $${params.length};
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

/* ===== Retrieval: vector (LEFT JOIN keeps rows without embeddings) ===== */
async function vectorListings(prompt, filters) {
  let vec;
  try {
    vec = await embedText(prompt);
  } catch {
    return [];
  }

  const vecLiteral = `[${vec.join(",")}]`;
  const args = [vecLiteral]; // $1 is the vector
  const parts = [];
  let i = 2;

  if (filters.minPrice != null) { parts.push(`p.price >= $${i++}`); args.push(filters.minPrice); }
  if (filters.maxPrice != null) { parts.push(`p.price <= $${i++}`); args.push(filters.maxPrice); }
  if (filters.location)         { parts.push(`LOWER(p.location) LIKE LOWER($${i++})`); args.push(`%${filters.location}%`); }
  if (filters.category)         { parts.push(`LOWER(p.category) LIKE LOWER($${i++})`); args.push(`%${filters.category}%`); }

  const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";

  const limitIndex = args.length + 1;
  args.push(MAX_LISTINGS);

  const sql = `
    SELECT
      p.id, p.title, p.description, p.price, p.category, p.location,
      CASE WHEN pe.embedding IS NULL
           THEN NULL
           ELSE 1 - (pe.embedding <=> $1::vector)
      END AS similarity
    FROM postings p
    LEFT JOIN posting_embeddings pe ON pe.posting_id = p.id
    ${where}
    ORDER BY (pe.embedding IS NULL), pe.embedding <=> $1::vector ASC NULLS LAST
    LIMIT $${limitIndex};
  `;
  const { rows } = await pool.query(sql, args);
  return rows;
}

/** Merge + score; higher is better. */
function mergeResults(keywordRows = [], vectorRows = []) {
  const map = new Map();
  for (const r of keywordRows) map.set(r.id, { ...r, score: 0.5 });

  for (const r of vectorRows) {
    const prev = map.get(r.id);
    const vs = typeof r.similarity === "number" ? r.similarity : 0.0;
    if (prev) {
      prev.score = Math.max(prev.score, 0.5 + (vs * 0.5));
    } else {
      map.set(r.id, { ...r, score: 0.5 + (vs * 0.5) });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, MAX_LISTINGS);
}

/** Pick only the most relevant items for the bottom links. */
function selectRelated(rows, max = MAX_RELATED_LINKS) {
  // keep top rows with decent confidence; guarantee at least 1 if available
  const MIN_SCORE = 0.58;
  const strong = rows.filter(r => (r.score ?? 0) >= MIN_SCORE);
  const chosen = (strong.length ? strong : rows).slice(0, max);
  return chosen;
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

    // Only send the most relevant items to the frontend for buttons
    const related = selectRelated(rows);
    const usedItems = related.map(r => ({
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

    const related = selectRelated(rows);
    const usedItems = related.map(r => ({
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
