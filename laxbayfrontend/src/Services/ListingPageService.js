import axios from "axios";

const fetchRecommendedListings = async (searchTerm) => {
  try {
    const response = await axios.get(`http://localhost:3000/store/listings?search=${searchTerm}`);
    return response.data; 
  } catch (error) {
    console.error("Error fetching listings:", error);
    throw new Error("Failed to fetch listings");
  }
};

export default { fetchRecommendedListings };