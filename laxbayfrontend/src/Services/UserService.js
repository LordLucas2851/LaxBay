import axios from "axios";

// Use environment variable for API base URL
const API = import.meta.env.VITE_API_URL;

/**
 * Register a new user.
 * This function posts user data to the backend using the configured API base URL.
 *
 * @param {Object} userData - The user data to send
 * @returns {Promise}
 */
export const registerUser = (userData) => {
  return axios.post(`${API}/store/register`, userData);
};