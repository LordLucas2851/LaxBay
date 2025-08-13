import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { info, careers, tone } from "./info.js";

const chatBotRouter = express.Router();

// Prefer GEMINI_API_KEY; fall back to API_KEY for compatibility
const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

let genAI = null;
if (!API_KEY) {
  console.warn("[ChatBotRoute] No API key set. Set GEMINI_API_KEY (preferred) or API_KEY.");
} else {
  genAI = new GoogleGenerativeAI(API_KEY);
}

const SYSTEM_PROMPT = [info, careers, tone, "Be concise."].join("\n\n");

// Build a model instance
const getModel = (name) =>
  genAI.getGenerativeModel({ model: name, systemInstruction: SYSTEM_PROMPT });

// Extract suggested retry seconds from Google error (RetryInfo.retryDelay like "36s")
function parseRetrySeconds(err) {
  const info = err?.errorDetails?.find?.((d) => d["@type"]?.includes("RetryInfo"));
  const m = info?.retryDelay ? String(info.retryDelay).match(/^(\d+)s$/) : null;
  return m ? Number(m[1]) : null;
}

chatBotRouter.get("/ping", (_req, res) => res.json({ ok: true }));

// ---------- Non-streaming (kept for compatibility) ----------
chatBotRouter.post("/", async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: "AI not configured." });

    const message = (req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "Message is required." });

    // ✅ Try cheaper/higher-quota models first, then pro
    const tryModels = [
      "gemini-1.5-flash-8b-latest",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
    ];

    for (let i = 0; i < tryModels.length; i++) {
      try {
        const model = getModel(tryModels[i]);
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: message }] }],
        });
        const text = result?.response?.text?.() || "";
        return res.json({ response: text || "I couldn't generate a response." });
      } catch (err) {
        if (err?.status === 429) {
          const delay = parseRetrySeconds(err) ?? 30;
          return res
            .status(429)
            .json({ error: "Rate limit reached. Please try again soon.", retryAfter: delay });
        }
        if (i === tryModels.length - 1) throw err; // last model failed
      }
    }
  } catch (err) {
    console.error("[Chat non-stream] error:", err);
    return res.status(500).json({ error: "An error occurred while generating AI response" });
  }
});

// ---------- Streaming (chunked text/plain) ----------
chatBotRouter.post("/stream", async (req, res) => {
  if (!genAI) return res.status(500).end("AI not configured.");

  const message = (req.body?.message || "").trim();
  if (!message) return res.status(400).end("Message is required.");

  // Stream-friendly headers
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  req.socket?.setKeepAlive?.(true);
  req.socket?.setTimeout?.(0);

  // ✅ Try cheaper/higher-quota models first, then pro
  const tryModels = [
    "gemini-1.5-flash-8b-latest",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro-latest",
  ];

  for (let i = 0; i < tryModels.length; i++) {
    try {
      const model = getModel(tryModels[i]);
      const result = await model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: message }] }],
      });

      for await (const chunk of result.stream) {
        const delta = typeof chunk?.text === "function" ? chunk.text() : "";
        if (delta) res.write(delta);
      }
      return res.end(); // success
    } catch (err) {
      if (err?.status === 429) {
        const delay = parseRetrySeconds(err) ?? 30;
        try {
          res.write(`\n\n[Rate limit hit on ${tryModels[i]}. Try again in ~${delay}s.]`);
        } catch {}
        return res.end();
      }
      if (i === tryModels.length - 1) {
        console.error("[Chat stream] error (final):", err);
        try {
          res.write("\n\n[Error streaming response]");
        } catch {}
        return res.end();
      }
      // else: continue to next model in the chain
    }
  }
});

export default chatBotRouter;
