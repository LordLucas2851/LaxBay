import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../apiClient";

const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// data-URL / absolute URL / legacy /uploads/*
const imgSrc = (raw) => {
  if (!raw) return "";
  const s = String(raw).replace(/\\/g, "/");
  if (/^data:image\//i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  const origin = API.replace(/\/api\/?$/, "");
  return `${origin}/${s.replace(/^\/+/, "")}`;
};

export default function UserPostPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const navigate = useNavigate();

  async function fetchMine() {
    setLoading(true);
    setErrMsg("");
    try {
      const res = await apiClient.get("/store/user/posts", { withCredentials: true });
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) setErrMsg("Please sign in to view your posts.");
      else setErrMsg(e?.response?.data?.error || "Failed to load your posts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMine(); }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/store/user/posts/${id}`, { withCredentials: true });
      setPosts((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to delete.");
    }
  }

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
            onClick={() => navigate("/create-post")}
            className="ml-3 inline-block px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Create your first post
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {posts.map((p) => (
          <div key={p.id} className="border rounded shadow bg-white">
            {imgSrc(p.image) ? (
              <img
                src={imgSrc(p.image)}
                alt={p.title}
                className="w-full h-40 object-cover rounded-t"
                onError={(e) => { e.currentTarget.src = ""; }}
              />
            ) : (
              <div className="w-full h-40 bg-gray-100 grid place-items-center rounded-t text-gray-400">
                No image
              </div>
            )}

            <div className="p-4">
              <h3 className="font-semibold text-lg line-clamp-2">{p.title}</h3>
              <p className="text-sm text-gray-600">{p.location}</p>
              <p className="text-sm mt-2 line-clamp-2">{p.description}</p>

              <div className="flex justify-between items-center mt-3">
                <span className="font-bold">
                  {p.price != null ? `$${Number(p.price)}` : ""}
                </span>
                <div className="space-x-2">
                  <button
                    onClick={() => navigate(`/edit/${p.id}`)}
                    className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => navigate(`/postdetails/${p.id}`)}
                    className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete
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
