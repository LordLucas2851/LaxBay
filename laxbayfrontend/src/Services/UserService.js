import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL;

export async function registerUser(userData) {
  return await axios.post(`${API}/store/register`, userData, {
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
  });
}
