import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { info, careers, tone } from "./info.js";

const chatBotRouter = express.Router();

// Prefer GEMINI_API_KEY; fall back to API_KEY for compatibility
const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!API_KEY) {
  console.warn(
    "[ChatBotRoute] No API key found. Set GEMINI_API_KEY (preferred) or API_KEY in Render environment."
  );
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Optional ping for troubleshooting
chatBotRouter.get("/ping", (req, res) => {
  console.log("Chat ping received");
  res.json({ ok: true });
});

chatBotRouter.post("/", async (req, res) => {
  try {
    if (!genAI) {
      return res.status(500).json({ error: "AI not configured (missing API key)." });
    }

    const message = (req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    // You can also inline systemInstruction in getGenerativeModel options
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      systemInstruction: [
        info,
        careers,
        tone,
        // (Optional) add small guardrails:
        "Be concise. If the question is unrelated to LaxBay or lacrosse, give a brief helpful reply.",
      ].join("\n\n"),
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: message }] }],
    });

    const text = result?.response?.text?.() || "";
    return res.json({ response: text || "I couldn't generate a response." });
  } catch (err) {
    console.error("AI generation error:", err);
    return res
      .status(500)
      .json({ error: "An error occurred while generating AI response" });
  }
});

export default chatBotRouter;
