import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export default function ChatBot() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [suggestions, setSuggestions] = useState([]); // [{id,title,price,location,url}]
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const btnRef = useRef(null);
  const navigate = useNavigate();

  const callGPTStream = async () => {
    const prompt = question.trim();
    if (!prompt) {
      setErrMsg("Please enter a question.");
      return;
    }
    setErrMsg("");
    setResponse("");
    setSuggestions([]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/store/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      if (!res.body) {
        // Fallback to non-stream
        const fallback = await fetch(`${API_BASE_URL}/store/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ prompt }),
        });
        const data = await fallback.json();
        setResponse(data?.text || "No response.");
        setSuggestions(Array.isArray(data?.usedItems) ? data.usedItems : []);
        setQuestion("");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const evt = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!evt.startsWith("data:")) continue;

          const jsonStr = evt.slice(5).trim();
          try {
            const payload = JSON.parse(jsonStr);
            if (payload.error) {
              setErrMsg(payload.error);
              continue;
            }
            if (typeof payload.text === "string") {
              setResponse((prev) => prev + payload.text);
            }
            if (Array.isArray(payload.usedItems)) {
              setSuggestions(payload.usedItems);
            }
          } catch {
            // ignore parse errors
          }
        }
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

      <div className="flex justify-center mb-6">
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

      {/* Suggested items (buttons) */}
      {suggestions.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-3">Related listings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestions.map((it) => (
              <button
                key={it.id}
                onClick={() => navigate(`/postdetails/${it.id}`)} {/* fixed typo */}
                className="w-full text-left p-3 rounded border hover:shadow bg-white"
                title={it.title}
              >
                <div className="font-medium line-clamp-1">{it.title || `Item #${it.id}`}</div>
                <div className="text-sm text-gray-600">
                  {it.location ? `${it.location} • ` : ""}
                  {it.price != null && it.price !== "" ? `$${it.price}` : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
      )
