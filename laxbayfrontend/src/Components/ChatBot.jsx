import { useState, useRef } from "react";

// ✅ Use the standardized env var
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ChatBot() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const btnRef = useRef(null);

  const callGPT = async () => {
    const trimmed = question.trim();
    if (!trimmed) {
      setErrMsg("Please enter a question.");
      return;
    }
    setErrMsg("");
    setLoading(true);
    setResponse("");

    try {
      const res = await fetch(`${API_BASE_URL}/store/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // keep sessions/cookies flowing
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setResponse(data.response || "No response received.");
      setQuestion("");
    } catch (e) {
      console.error("Chat error:", e);
      setErrMsg(e.message || "Sorry, I couldn't generate a response.");
    } finally {
      setLoading(false);
    }
  };

  // Enter = submit, Shift+Enter = newline
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      btnRef.current?.click();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Chat with LaxBay</h1>

      {/* Response area */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Assistant</label>
        <textarea
          value={response}
          readOnly
          className="w-full h-44 p-4 text-base border rounded-md bg-gray-50 focus:outline-none"
        />
      </div>

      {/* Error */}
      {errMsg && (
        <div className="mb-4 text-red-600 text-sm border border-red-200 bg-red-50 rounded p-2">
          {errMsg}
        </div>
      )}

      {/* Prompt input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Your question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about listings, gear, or the site… (Shift+Enter for newline)"
          className="w-full h-28 p-4 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      <div className="flex justify-center">
        <button
          ref={btnRef}
          onClick={callGPT}
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
