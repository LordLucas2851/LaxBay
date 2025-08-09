import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Use environment variable for API base URL
const API = import.meta.env.VITE_API_URL;

function UserPostsPage() {
  const [posts, setPosts] = useState([]);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserPosts();
  }, []);

  const fetchUserPosts = async () => {
    try {
      const response = await axios.get(`${API}/store/user`, {
        withCredentials: true,
      });
      setPosts(response.data);
    } catch (error) {
      console.error("Error fetching user posts:", error);
    }
  };

  const handleDelete = async (postId) => {
    try {
      await axios.delete(`${API}/store/user/${postId}`, {
        withCredentials: true,
      });
      setPosts(posts.filter((post) => post.id !== postId));
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post.");
    }
  };

  const toggleExpand = (postId) => {
    setExpandedPostId(expandedPostId === postId ? null : postId);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-4xl font-bold text-center mb-6">My Posts</h2>
      {posts.length === 0 ? (
        <p className="text-center">No posts found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => toggleExpand(post.id)}
              className="border rounded-lg p-4 shadow-lg hover:shadow-xl transition-transform transform hover:scale-105 cursor-pointer"
            >
              {/* Post Title */}
              <h3 className="text-2xl font-semibold text-center mb-1">{post.title}</h3>
              {/* Post Category */}
              <p className="text-base text-gray-500 text-center mb-2">{post.category}</p>
              {/* Post Image */}
              {post.image && (
                <div className="mb-4">
                  <img
                    src={`${API}/${post.image.replace(/\\/g, "/")}`}
                    alt="Post Image"
                    className="w-32 h-32 object-cover"
                  />
                </div>
              )}
              {/* Expanded content */}
              {expandedPostId === post.id && (
                <div className="text-center">
                  {/* Description */}
                  <p className="text-lg text-gray-700 font-medium mb-4 px-2">
                    {post.description}
                  </p>
                  {/* Price */}
                  <p className="text-base text-gray-800 mb-1">
                    <strong className="text-gray-900">Price:</strong> <span className="font-semibold">${post.price}</span>
                  </p>
                  {/* Location */}
                  <p className="text-base text-gray-800 mb-2">
                    <strong className="text-gray-900">Location:</strong> {post.location}
                  </p>
                </div>
              )}
              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(post.id);
                }}
                className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors mt-4"
              >
                Delete
              </button>
              <button
                onClick={() => navigate(`/edit/${post.id}`)}
                className="bg-blue-500 text-white px-2 py-1 rounded"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UserPostsPage;