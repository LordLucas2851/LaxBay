import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { info, careers, tone } from "./info.js";  

const chatBotRouter = express.Router();
const genAI = new GoogleGenerativeAI(process.env.API_KEY);  

chatBotRouter.post("/", async (req, res) => {
  const message = req.body.message;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
      systemInstruction: {
        parts: [
          { text: info },
          { text: careers },
          { text: tone },
        ],
      },
    });

    const response = result.response;
    const text = response.text();  
    res.json({ response: text });
  } catch (error) {
    console.error("AI generation error:", error);
    res.status(500).json({ error: "An error occurred while generating AI response" });
  }
});

export default chatBotRouter;