import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../apiClient";

// Normalize backend base and build robust image srcs
const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const imgSrc = (raw) => {
  if (!raw) return "";
  const s = String(raw).replace(/\\/g, "/");
  if (/^data:image\//i.test(s)) return s;            // data URL in DB
  if (/^https?:\/\//i.test(s)) return s;             // absolute URL (S3/R2/CDN)
  const origin = API.replace(/\/api\/?$/, "");       // backend origin
  return `${origin}/${s.replace(/^\/+/, "")}`;       // legacy /uploads/*
};

export default function ListingPage() {
  const [listings, setListings] = useState([]);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await apiClient.get("/store/listings", { withCredentials: true });
        if (alive) setListings(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch listings:", err);
        if (alive) setFetchError(err?.response?.data?.error || err?.message || "Failed to load listings.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggleExpand = (postId) => {
    setExpandedPostId((id) => (id === postId ? null : postId));
  };

  if (loading) return <div className="p-6">Loading listings…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Listings</h1>

      {fetchError && (
        <div className="p-4 mb-6 bg-yellow-50 border border-yellow-300 rounded text-yellow-800">
          {fetchError}
        </div>
      )}

      {!fetchError && listings.length === 0 && (
        <div className="p-4 text-gray-600">No listings found.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((post) => (
          <div
            key={post.id}
            onClick={() => toggleExpand(post.id)}
            className="border p-4 rounded shadow bg-white hover:shadow-lg transition-transform hover:scale-[1.01] cursor-pointer"
          >
            {imgSrc(post.image) ? (
              <img
                src={imgSrc(post.image)}
                alt={post.title}
                className="w-full h-40 object-cover rounded"
                onError={(e) => { e.currentTarget.src = ""; }}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-40 bg-gray-100 grid place-items-center rounded text-gray-400">
                No image
              </div>
            )}

            <h3 className="text-xl font-bold mt-2 line-clamp-2">{post.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{post.location}</p>

            {expandedPostId === post.id && (
              <>
                <p className="text-sm mb-2">{post.description}</p>
                <p className="text-md font-bold mb-2">
                  {post.price != null ? `$${Number(post.price)}` : ""}
                </p>
              </>
            )}

            <div className="flex justify-between mt-4 space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/postdetails/${post.id}`);
                }}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
