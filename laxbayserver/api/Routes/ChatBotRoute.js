// api/Routes/ChatBotRoute.js
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

function normBody(body = {}) {
  // accept either "prompt" or "message"
  const prompt = typeof body.prompt === "string" && body.prompt.trim()
    ? body.prompt.trim()
    : (typeof body.message === "string" ? body.message.trim() : "");
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system = typeof body.system === "string" ? body.system : "";
  return { prompt, messages, system };
}

function buildPrompt(messages = [], prompt = "", system = "") {
  const lines = [];
  if (system) lines.push(`System: ${system}`);
  for (const m of messages) {
    const role = (m?.role || "user").trim();
    const content = typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
    lines.push(`${role[0].toUpperCase() + role.slice(1)}: ${content}`);
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

// Health/ping
router.get("/", (_req, res) => {
  res.json({ ok: true, model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
});

// -------- Non-streaming: POST /api/store/chat --------
router.post("/", async (req, res) => {
  try {
    const { prompt, messages, system } = normBody(req.body);
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

// -------- Streaming (SSE): POST /api/store/chat/stream --------
router.post("/stream", async (req, res) => {
  // SSE headers
  res.set({
    "Cache-Control": "no-cache, no-transform",
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
  });
  if (res.flushHeaders) res.flushHeaders();

  try {
    const { prompt, messages, system } = normBody(req.body);
    const text = buildPrompt(messages, prompt, system);
    const model = getModel();

    // One-shot completion (simple compatibility)
    const result = await model.generateContent(text);
    const out = result?.response?.text?.() || "";

    res.write(`data: ${JSON.stringify({ text: out })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("chat stream error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

export default router;
