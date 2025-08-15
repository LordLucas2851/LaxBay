// frontend/src/pages/ListingPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../apiClient";

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
        const res = await apiClient.get("/store/listings");
        if (alive) setListings(res.data);
      } catch (err) {
        console.error("Failed to fetch listings:", err);
        if (alive) setFetchError(err?.message || "Failed to fetch listings");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggleExpand = (postId) => {
    setExpandedPostId((id) => (id === postId ? null : postId));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Listings</h1>

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
              src={post.image}
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
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/postdetails/${post.id}`);
                }}
                className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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
