import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// ✅ Correct environment variable
const API = import.meta.env.VITE_API_BASE_URL;

// ✅ Helper to build proper image URLs
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  const normalized = imagePath.replace(/\\/g, "/");
  return `https://laxbay.onrender.com/${normalized}`;
};

export default function SearchEngine() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [filters, setFilters] = useState({
    location: "",
    minPrice: "",
    maxPrice: "",
    category: "",
  });
  const [previewPosts, setPreviewPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${API}/store/search`, {
          params: { query, ...filters },
        });
        setResults(response.data);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchPreviewPosts = async () => {
      try {
        const response = await axios.get(`${API}/store/search`, {
          params: { query: "", ...filters },
        });
        setPreviewPosts(
          response.data.sort(() => 0.5 - Math.random()).slice(0, 6)
        );
      } catch (err) {
        console.error("Error fetching preview posts:", err);
      }
    };

    fetchResults();
    fetchPreviewPosts();
  }, [query, filters]);

  const handlePostClick = (postId) => {
    navigate(`/postdetails/${postId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Browse Gear</h2>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <input
            className="border border-gray-300 rounded-md px-4 py-2 w-full"
            type="text"
            placeholder="Search lacrosse gear..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            className="border border-gray-300 rounded-md px-4 py-2 w-full"
            type="text"
            placeholder="Location"
            value={filters.location}
            onChange={(e) =>
              setFilters({ ...filters, location: e.target.value })
            }
          />
          <input
            className="border border-gray-300 rounded-md px-4 py-2 w-full"
            type="number"
            placeholder="Min Price"
            value={filters.minPrice}
            onChange={(e) =>
              setFilters({ ...filters, minPrice: e.target.value })
            }
          />
          <input
            className="border border-gray-300 rounded-md px-4 py-2 w-full"
            type="number"
            placeholder="Max Price"
            value={filters.maxPrice}
            onChange={(e) =>
              setFilters({ ...filters, maxPrice: e.target.value })
            }
          />
          <select
            className="border border-gray-300 rounded-md px-4 py-2 w-full"
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
          >
            <option value="">All Categories</option>
            <option value="Sticks">Sticks</option>
            <option value="Gloves">Gloves</option>
            <option value="Helmets">Helmets</option>
            <option value="Cleats">Cleats</option>
            <option value="Apparel">Apparel</option>
          </select>
        </div>
      </div>

      {results.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {results.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition cursor-pointer overflow-hidden"
              onClick={() => handlePostClick(post.id)}
            >
              <img
                src={getImageUrl(post.image)}
                alt={post.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-bold mb-1">{post.title}</h3>
                <p className="text-sm text-gray-600 mb-2">{post.description}</p>
                <p className="font-semibold text-indigo-600 mb-1">${post.price}</p>
                <p className="text-xs text-gray-500">
                  {post.username} • {post.location}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : isLoading ? (
        <p>Loading results...</p>
      ) : (
        <p>No results found.</p>
      )}

      {results.length === 0 && !isLoading && (
        <div>
          <h3 className="text-2xl font-semibold mb-4">Featured Listings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {previewPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition cursor-pointer overflow-hidden"
                onClick={() => handlePostClick(post.id)}
              >
                <img
                  src={getImageUrl(post.image)}
                  alt={post.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h3 className="text-xl font-bold mb-1">{post.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{post.description}</p>
                  <p className="font-semibold text-indigo-600 mb-1">${post.price}</p>
                  <p className="text-xs text-gray-500">
                    {post.username} • {post.location}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
