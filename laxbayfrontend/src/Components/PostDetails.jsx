import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

// ✅ Use the standardized env var that includes /api
const API = import.meta.env.VITE_API_BASE_URL;

// Build proper image URL: strip trailing /api and prepend /uploads (if needed)
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  const normalized = String(imagePath).replace(/\\/g, "/");
  // If backend already returned a full URL, use it
  if (/^https?:\/\//i.test(normalized)) return normalized;
  // Remove trailing /api from API base to get origin
  const origin = (API || "").replace(/\/api\/?$/, "");
  return `${origin}/${normalized.replace(/^\/+/, "")}`;
};

export default function PostDetails() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  // Defensive: compute detail URLs once
  const urls = useMemo(() => {
    return {
      details: `${API}/store/postdetails/${postId}`,
      emailFor: (username) => `${API}/user/email/${encodeURIComponent(username)}`,
    };
  }, [postId]);

  useEffect(() => {
    let alive = true;

    const fetchPostDetails = async () => {
      setError("");
      try {
        const response = await axios.get(urls.details, { withCredentials: true });
        if (!alive) return;

        setPost(response.data);

        // Fetch seller email (depends on your UserRoute)
        if (response.data?.username) {
          try {
            const emailRes = await axios.get(urls.emailFor(response.data.username), {
              withCredentials: true,
            });
            if (alive) setEmail(emailRes.data?.email || "");
          } catch (e) {
            console.warn("Email lookup failed:", e?.response?.status || e.message);
          }
        }
      } catch (err) {
        console.error("Error fetching post details:", err);
        if (alive) {
          setError(
            err?.response?.status === 404
              ? "That post was not found."
              : "Failed to load post details. Please try again."
          );
        }
      }
    };

    fetchPostDetails();
    return () => {
      alive = false;
    };
  }, [urls]);

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-red-600">
        {error}
      </div>
    );
  }

  if (!post) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">{post.title}</h2>

      <img
        src={getImageUrl(post.image)}
        alt={post.title}
        className="w-full max-h-[400px] object-contain bg-white"
      />

      <p className="mt-4 text-lg">{post.description}</p>
      <p className="font-semibold text-xl mt-4">${post.price}</p>
      <p className="text-xs text-gray-500">
        Posted by {post.username} in {post.location}
      </p>

      {email && (
        <p className="mt-4">
          Contact Email:{" "}
          <a href={`mailto:${email}`} className="text-blue-600 underline">
            {email}
          </a>
        </p>
      )}
    </div>
  );
}
