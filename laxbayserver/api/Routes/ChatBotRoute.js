// api/Routes/ChatBotRoute.js
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

function buildPrompt(messages = [], prompt = "", system = "") {
  const lines = [];
  if (system) lines.push(`System: ${system}`);
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
  if (!key) {
    throw new Error("Missing GOOGLE_API_KEY env var");
  }
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: modelName });
}

// Simple health/ping for this router
router.get("/", (_req, res) => {
  res.json({ ok: true, model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
});

// Non-streaming chat: POST /api/store/chat
router.post("/", async (req, res) => {
  try {
    const { messages = [], prompt = "", system = "" } = req.body || {};
    const text = buildPrompt(messages, prompt, system);
    const model = getModel();
    const result = await model.generateContent(text);
    const out = result?.response?.text?.() || "";
    res.json({ text: out });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "chat error", detail: err.message });
  }
});

// Streaming (SSE-shaped) chat: POST /api/store/chat/stream
// Sends one event with {text}, then a final {done:true}
router.post("/stream", async (req, res) => {
  // Prepare SSE headers
  res.set({
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
  });
  // Some environments require this to flush headers early
  if (res.flushHeaders) res.flushHeaders();

  try {
    const { messages = [], prompt = "", system = "" } = req.body || {};
    const text = buildPrompt(messages, prompt, system);
    const model = getModel();

    // For maximum compatibility, do a single completion and emit once.
    // (You can switch to generateContentStream later if your frontend expects token-level chunks.)
    const result = await model.generateContent(text);
    const out = result?.response?.text?.() || "";

    // One payload event
    res.write(`data: ${JSON.stringify({ text: out })}\n\n`);
    // Final event
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("chat stream error:", err);
    // Emit error as event, then end
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

export default router;
