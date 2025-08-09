import axios from "axios";

// Base API URL from environment variables
const API = import.meta.env.VITE_API_URL;

/**
 * Fetch listings based on a search term.
 * Uses the API environment variable rather than a hard‑coded localhost URL.
 *
 * @param {string} searchTerm
 * @returns {Promise<any[]>}
 */
const fetchRecommendedListings = async (searchTerm) => {
  try {
    // The backend mounts listing routes at `/store`, so include query directly
    const response = await axios.get(`${API}/store?search=${searchTerm}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching listings:", error);
    throw new Error("Failed to fetch listings");
  }
};

export default { fetchRecommendedListings };