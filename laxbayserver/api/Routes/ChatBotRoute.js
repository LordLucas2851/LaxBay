import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { info, careers, tone } from "./info.js";

const chatBotRouter = express.Router();

// Prefer GEMINI_API_KEY; fall back to API_KEY for compatibility
const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!API_KEY) {
  console.warn(
    "[ChatBotRoute] No API key found. Set GEMINI_API_KEY (preferred) or API_KEY."
  );
}
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// ---------- Simple health check ----------
chatBotRouter.get("/ping", (_req, res) => res.json({ ok: true }));

// ---------- Non-streaming (kept for compatibility) ----------
chatBotRouter.post("/", async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: "AI not configured." });
    const message = (req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "Message is required." });

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      systemInstruction: [info, careers, tone].join("\n\n"),
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: message }] }],
    });

    const text = result?.response?.text?.() || "";
    res.json({ response: text || "I couldn't generate a response." });
  } catch (err) {
    console.error("AI generation error:", err);
    res.status(500).json({ error: "An error occurred while generating AI response" });
  }
});

// ---------- Streaming endpoint ----------
chatBotRouter.post("/stream", async (req, res) => {
  try {
    if (!genAI) return res.status(500).end("AI not configured.");
    const message = (req.body?.message || "").trim();
    if (!message) return res.status(400).end("Message is required.");

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      systemInstruction: [info, careers, tone, "Be concise."].join("\n\n"),
    });

    // Important: use streaming API
    const result = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: message }] }],
    });

    // Chunked text stream (simple text/plain; client reads with fetch stream)
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    // For proxies (Render) to keep connection open
    res.setHeader("Cache-Control", "no-cache");

    for await (const chunk of result.stream) {
      const delta = chunk?.text?.() || "";
      if (delta) res.write(delta);
    }
    res.end();
  } catch (err) {
    console.error("AI streaming error:", err);
    // Send what we can; client will show error if needed
    try { res.write("\n\n[Error streaming response]"); } catch {}
    res.end();
  }
});

export default chatBotRouter;
