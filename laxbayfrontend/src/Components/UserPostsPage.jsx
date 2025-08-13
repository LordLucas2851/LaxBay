import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// ✅ Correct env var: includes /api
const API = import.meta.env.VITE_API_BASE_URL;

// Build proper image URLs (strip /api to hit /uploads)
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  const normalized = String(imagePath).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const origin = (API || "").replace(/\/api\/?$/, "");
  return `${origin}/${normalized.replace(/^\/+/, "")}`;
};

function UserPostsPage() {
  const [posts, setPosts] = useState([]);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserPosts = async () => {
    setError("");
    try {
      const res = await axios.get(`${API}/store/user`, { withCredentials: true });
      // Backend now returns 200 [] when no posts (see server fix below)
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching user posts:", err);
      // If unauthorized, nudge to login; otherwise show a friendly message
      if (err?.response?.status === 401) {
        setError("Please log in to view your posts.");
      } else {
        setError("Failed to load your posts. Please try again.");
      }
      setPosts([]);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await axios.delete(`${API}/store/user/${postId}`, { withCredentials: true });
      setPosts((ps) => ps.filter((p) => p.id !== postId));
    } catch (err) {
      console.error("Error deleting post:", err);
      alert(err?.response?.data?.error || "Failed to delete post.");
    }
  };

  const toggleExpand = (postId) => {
    setExpandedPostId((id) => (id === postId ? null : postId));
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-4xl font-bold text-center mb-6">My Posts</h2>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 text-center">
          {error}
        </div>
      )}

      {posts.length === 0 && !error ? (
        <p className="text-center">No posts found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => toggleExpand(post.id)}
              className="border rounded-lg p-4 shadow-lg hover:shadow-xl transition-transform transform hover:scale-105 cursor-pointer"
            >
              <h3 className="text-2xl font-semibold text-center mb-1">
                {post.title ?? post.name}
              </h3>
              <p className="text-base text-gray-500 text-center mb-2">
                {post.category}
              </p>

              {post.image && (
                <div className="mb-4 flex justify-center">
                  <img
                    src={getImageUrl(post.image)}
                    alt="Post"
                    className="w-32 h-32 object-cover rounded border"
                  />
                </div>
              )}

              {expandedPostId === post.id && (
                <div className="text-center">
                  <p className="text-lg text-gray-700 font-medium mb-4 px-2">
                    {post.description}
                  </p>
                  <p className="text-base text-gray-800 mb-1">
                    <strong className="text-gray-900">Price:</strong>{" "}
                    <span className="font-semibold">${post.price}</span>
                  </p>
                  <p className="text-base text-gray-800 mb-2">
                    <strong className="text-gray-900">Location:</strong>{" "}
                    {post.location}
                  </p>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(post.id);
                  }}
                  className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/edit/${post.id}`);
                  }}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UserPostsPage;
