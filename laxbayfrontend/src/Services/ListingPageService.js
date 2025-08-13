import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL;

const fetchRecommendedListings = async (searchTerm) => {
  try {
    const response = await axios.get(`${API}/store?search=${searchTerm}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching listings:", error);
    throw new Error("Failed to fetch listings");
  }
};

export default { fetchRecommendedListings };
