import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Environment variable for backend base URL
const API = import.meta.env.VITE_API_URL;

export default function SearchEngine() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [filters, setFilters] = useState({ location: "", minPrice: "", maxPrice: "", category: "" });
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
        setPreviewPosts(response.data.sort(() => 0.5 - Math.random()).slice(0, 5));
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
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Search Listings</h2>
      <input
        className="w-full p-2 border mb-4 rounded"
        type="text"
        placeholder="Search lacrosse gear..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            className="w-full p-2 border rounded"
            type="text"
            placeholder="Location"
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <input
            className="w-full p-2 border rounded"
            type="number"
            placeholder="Min Price"
            value={filters.minPrice}
            onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <input
            className="w-full p-2 border rounded"
            type="number"
            placeholder="Max Price"
            value={filters.maxPrice}
            onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <select
            className="w-full p-2 border rounded"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="">Select Category</option>
            <option value="Sticks">Sticks</option>
            <option value="Gloves">Gloves</option>
            <option value="Helmets">Helmets</option>
            <option value="Cleats">Cleats</option>
            <option value="Apparel">Apparel</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {results.length > 0 ? (
          results.map((post) => (
            <div
              key={post.id}
              className="border p-4 rounded shadow cursor-pointer"
              onClick={() => handlePostClick(post.id)}
            >
              <img
                src={`${API}/${post.image.replace(/\\/g, "/")}`}
                alt={post.title}
                className="w-full h-40 object-cover rounded"
              />
              <h3 className="text-xl font-bold mt-2">{post.title}</h3>
              <p className="text-sm">{post.description}</p>
              <p className="font-semibold">${post.price}</p>
              <p className="text-xs text-gray-500">Posted by {post.username} in {post.location}</p>
            </div>
          ))
        ) : isLoading ? (
          <p>Loading results...</p>
        ) : (
          <p>No results found.</p>
        )}
      </div>

      {results.length === 0 && !isLoading && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Featured Listings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {previewPosts.map((post) => (
              <div
                key={post.id}
                className="border p-4 rounded shadow cursor-pointer"
                onClick={() => handlePostClick(post.id)}
              >
                <img
                  src={`${API}/${post.image.replace(/\\/g, "/")}`}
                  alt={post.title}
                  className="w-full h-40 object-cover rounded"
                />
                <h3 className="text-xl font-bold mt-2">{post.title}</h3>
                <p className="text-sm">{post.description}</p>
                <p className="font-semibold">${post.price}</p>
                <p className="text-xs text-gray-500">Posted by {post.username} in {post.location}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}