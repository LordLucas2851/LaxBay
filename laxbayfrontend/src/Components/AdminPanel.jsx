import { useEffect, useState } from "react";
import apiClient from "./apiClient";  // adjust path if needed
import { useNavigate } from "react-router-dom";

export default function AdminPanel() {
  const [listings, setListings] = useState([]);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const navigate = useNavigate();

  // Use Render in prod, localhost during dev
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";

  const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true, // IMPORTANT: send cookies to Render
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await apiClient.get("/store/admin/listings");
        setListings(res.data);
      } catch (err) {
        console.error("Failed to fetch listings:", err);
        if (alive) setFetchError(err?.message || "Failed to fetch listings");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []); // run once

  const handleDelete = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await apiClient.delete(`/store/admin/posts/${postId}`);
      setListings(listings.filter((post) => post.id !== postId));
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete post.");
    }
  };

  const toggleExpand = (postId) => {
    setExpandedPostId((id) => (id === postId ? null : postId));
  };

  // Build image URLs from paths the API returns
  const imageUrl = (raw) => {
    if (!raw) return "";
    const normalized = String(raw).replace(/\\/g, "/");
    if (/^https?:\/\//i.test(normalized)) return normalized;
    const apiOrigin = API_BASE.replace(/\/api\/?$/, "");
    return `${apiOrigin}/${normalized.replace(/^\/+/, "")}`;
  };

  const role = sessionStorage.getItem("role");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Panel - All Listings</h1>

      {role !== "admin" && (
        <div className="text-red-600 font-bold p-4 border rounded mb-6">
          Access Denied — you are not an admin.
        </div>
      )}

      {loading && <div className="p-4">Loading listings…</div>}
      {fetchError && (
        <div className="p-4 mb-6 bg-yellow-50 border border-yellow-300 rounded text-yellow-800">
          {fetchError}
        </div>
      )}

      {!loading && !fetchError && listings.length === 0 && (
        <div className="p-4 text-gray-600">No listings found.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((post) => (
          <div
            key={post.id}
            onClick={() => toggleExpand(post.id)}
            className="border p-4 rounded shadow bg-white hover:shadow-lg transition-transform transform hover:scale-105 cursor-pointer"
          >
            <img
              src={`${import.meta.env.VITE_API_BASE_URL}/${post.image?.replace(/\\/g, "/")}`}
              alt={post.title}
              className="w-full h-40 object-cover rounded"
            />
            <h3 className="text-xl font-bold mt-2">{post.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{post.location}</p>

            {expandedPostId === post.id && (
              <>
                <p className="text-sm mb-2">{post.description}</p>
                <p className="text-md font-bold mb-2">${post.price}</p>
              </>
            )}

            <div className="flex justify-between mt-4 space-x-2">
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/edit/${post.id}`); }}
                className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                className="w-full py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
