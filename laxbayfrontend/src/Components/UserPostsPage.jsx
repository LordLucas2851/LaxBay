// src/Components/UserPostsPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// Must be set in Vercel: VITE_API_BASE_URL = https://laxbay.onrender.com/api
const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// Inline helper: supports DB data-URLs, absolute URLs, and legacy /uploads/*
const imgSrc = (raw) => {
  if (!raw) return "";
  const s = String(raw).replace(/\\/g, "/");
  if (/^data:image\//i.test(s)) return s;               // data URL from DB
  if (/^https?:\/\//i.test(s)) return s;                // absolute URL
  const origin = API.replace(/\/api\/?$/, "");          // backend origin only
  return `${origin}/${s.replace(/^\/+/, "")}`;          // legacy /uploads/*
};

export default function UserPostsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        // Lists the signed-in user's posts; returns [] if none
        const res = await axios.get(`${API}/store/user/posts`, { withCredentials: true });
        if (!alive) return;
        setPosts(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!alive) return;
        const status = e?.response?.status;
        if (status === 401) setErrMsg("Please sign in to view your posts.");
        else setErrMsg(e?.response?.data?.error || "Failed to load your posts.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="p-6">Loading your posts…</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">My Posts</h1>

      {errMsg && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {errMsg}
        </div>
      )}

      {!errMsg && posts.length === 0 && (
        <div className="text-gray-600 border rounded p-4">
          You haven’t posted anything yet.
          <button
            onClick={() => navigate("/create")}
            className="ml-3 inline-block px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Create your first post
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {posts.map((p) => (
          <div key={p.id} className="border rounded shadow bg-white">
            <img
              src={imgSrc(p.image)}
              alt={p.title}
              className="w-full h-40 object-cover rounded-t"
              onError={(e) => { e.currentTarget.src = ""; }}
            />
            <div className="p-4">
              <h3 className="font-semibold text-lg">{p.title}</h3>
              <p className="text-sm text-gray-600">{p.location}</p>
              <p className="text-sm mt-2 line-clamp-2">{p.description}</p>
              <div className="flex justify-between items-center mt-3">
                <span className="font-bold">${p.price}</span>
                <div className="space-x-2">
                  <button
                    onClick={() => navigate(`/edit/${p.id}`)}
                    className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => navigate(`/post/${p.id}`)}
                    className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
