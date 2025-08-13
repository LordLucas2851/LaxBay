import { useState, useRef } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ChatBot() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const btnRef = useRef(null);

  const callGPTStream = async () => {
    const prompt = question.trim();
    if (!prompt) {
      setErrMsg("Please enter a question.");
      return;
    }
    setErrMsg("");
    setResponse("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/store/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: prompt }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      // Some platforms may buffer if response isn't explicitly a stream
      if (!res.body) {
        // Fall back to non-stream path
        const fallback = await fetch(`${API_BASE_URL}/store/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: prompt }),
        });
        const data = await fallback.json();
        setResponse(data.response || "No response.");
        setQuestion("");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) setResponse((prev) => prev + chunk);
      }

      setQuestion("");
    } catch (e) {
      console.error("Chat stream error:", e);
      setErrMsg(e.message || "Sorry, I couldn't generate a response.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      btnRef.current?.click();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white shadow-lg rounded-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">Chat with LaxBay</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Assistant</label>
        <textarea
          value={response}
          readOnly
          className="w-full h-44 p-4 text-base border-2 border-gray-200 rounded-md bg-gray-50 focus:outline-none"
        />
      </div>

      {errMsg && (
        <div className="mb-4 text-red-600 text-sm border border-red-200 bg-red-50 rounded p-2">
          {errMsg}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Your question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about listings, gear, or the site… (Shift+Enter for newline)"
          className="w-full h-28 p-4 text-base border-2 border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      <div className="flex justify-center">
        <button
          ref={btnRef}
          onClick={callGPTStream}
          disabled={loading}
          className={`px-6 py-2 rounded-lg text-white shadow ${
            loading ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {loading ? "Thinking…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
