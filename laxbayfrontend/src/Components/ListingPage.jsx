// frontend/src/pages/Listings.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// Must be set in Vercel: VITE_API_BASE_URL = https://laxbay.onrender.com/api
const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// Inline helper: data-URLs, absolute URLs, and legacy /uploads/*
const imgSrc = (raw) => {
  if (!raw) return "";
  const s = String(raw).replace(/\\/g, "/");
  if (/^data:image\//i.test(s)) return s;               // DB data URL
  if (/^https?:\/\//i.test(s)) return s;                // absolute
  const origin = API.replace(/\/api\/?$/, "");          // backend origin
  return `${origin}/${s.replace(/^\/+/, "")}`;          // legacy /uploads/*
};

export default function Listings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        // Works with your backend aliases: /store/listings | /store/postings | /store/posts
        const res = await axios.get(`${API}/store/listings`, { withCredentials: true });
        if (!alive) return;
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!alive) return;
        setErrMsg(e?.response?.data?.error || "Failed to load listings.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="p-6">Loading listings…</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Latest Listings</h1>

      {errMsg && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {errMsg}
        </div>
      )}

      {!errMsg && items.length === 0 && (
        <div className="text-gray-600 border rounded p-4">
          No listings yet. Check back soon!
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {items.map((p) => (
          <div
            key={p.id}
            className="border rounded shadow bg-white hover:shadow-lg transition-transform transform hover:scale-[1.01] cursor-pointer"
            onClick={() => navigate(`/post/${p.id}`)}
          >
            <img
              src={imgSrc(p.image)}
              alt={p.title}
              className="w-full h-44 object-cover rounded-t"
              onError={(e) => { e.currentTarget.src = ""; }}
              loading="lazy"
            />
            <div className="p-4">
              <h3 className="font-semibold text-lg line-clamp-1">{p.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2 mt-1">{p.description}</p>
              <div className="flex justify-between items-center mt-3">
                <span className="font-bold">${p.price}</span>
                <span className="text-sm text-gray-500">{p.location}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
