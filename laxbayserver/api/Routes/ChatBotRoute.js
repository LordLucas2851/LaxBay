import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { info, careers, tone } from "./info.js";

const chatBotRouter = express.Router();

// Prefer GEMINI_API_KEY; fall back to API_KEY
const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

let genAI = null;
if (!API_KEY) {
  console.warn("[ChatBotRoute] No API key set. Set GEMINI_API_KEY (preferred) or API_KEY.");
} else {
  genAI = new GoogleGenerativeAI(API_KEY);
}

chatBotRouter.get("/ping", (_req, res) => res.json({ ok: true }));

// --- Non-streaming fallback (keep this) ---
chatBotRouter.post("/", async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: "AI not configured." });

    const message = (req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "Message is required." });

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      systemInstruction: [info, careers, tone, "Be concise."].join("\n\n"),
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: message }] }],
    });

    const text = result?.response?.text?.() || "";
    return res.json({ response: text || "I couldn't generate a response." });
  } catch (err) {
    console.error("[Chat non-stream] error:", err);
    return res.status(500).json({ error: "An error occurred while generating AI response" });
  }
});

// --- Streaming (text/plain, chunked) ---
chatBotRouter.post("/stream", async (req, res) => {
  // Guard rails & setup
  if (!genAI) {
    res.status(500);
    return res.end("AI not configured.");
  }

  const message = (req.body?.message || "").trim();
  if (!message) {
    res.status(400);
    return res.end("Message is required.");
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      systemInstruction: [info, careers, tone, "Be concise."].join("\n\n"),
    });

    const result = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: message }] }],
    });

    // Important: streaming-friendly headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no"); // for some proxies
    // Flush headers so clients start reading immediately
    res.flushHeaders?.();

    // Some platforms close idle sockets; this helps in dev
    req.socket?.setKeepAlive?.(true);
    req.socket?.setTimeout?.(0);

    try {
      for await (const chunk of result.stream) {
        // The SDK exposes a helper on each streamed chunk:
        const delta = typeof chunk?.text === "function" ? chunk.text() : "";
        if (delta) {
          res.write(delta);
        }
      }
    } catch (inner) {
      console.error("[Chat stream] loop error:", inner);
      try { res.write("\n\n[STREAM_ERROR]"); } catch {}
    } finally {
      res.end();
    }
  } catch (err) {
    console.error("[Chat stream] setup error:", err);
    try { res.write("\n\n[STREAM_ERROR]"); } catch {}
    res.end();
  }
});

export default chatBotRouter;
