import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function GetResponse(message) {
  const response = await fetch(`${API_BASE_URL}/store/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
    credentials: "include", 
  });

  if (response.ok) {
    const data = await response.json();
    return data.response;
  } else {
    console.error("Error fetching AI response:", response.statusText);
    return "Sorry, I couldn't generate a response at the moment.";
  }
}

export default function ChatBot() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");

  function handleEnter(e) {
    if (e.code === "Enter") {
      callGPT();
    }
  }

  async function callGPT() {
    setResponse("");
    const ans = await GetResponse(question);
    setResponse(ans);
    setQuestion("");
  }

  return (
    <div className="p-8 max-w-6xl mx-auto bg-white shadow-lg rounded-lg text-center">
      <h1 className="text-4xl font-bold mb-6">Chat with LaxBay</h1>

      <div className="mb-6">
        <textarea
          value={response}
          readOnly
          className="w-full h-40 p-4 text-lg border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600 overflow-y-auto resize-none"
        />
      </div>

      <div className="mb-6">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleEnter}
          placeholder="Ask me anything!"
          className="w-full h-20 p-4 text-lg border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600 resize-none"
        />
      </div>

      <div className="flex justify-center">
        <button
          onClick={callGPT}
          className="bg-emerald-600 text-white text-lg py-2 px-6 rounded-lg shadow-md hover:bg-emerald-700 transition-all"
        >
          Submit
        </button>
      </div>
    </div>
  );
}