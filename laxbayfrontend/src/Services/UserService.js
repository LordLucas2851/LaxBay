import axios from "axios";

const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
if (!API) console.warn("VITE_API_BASE_URL is missing");

// Always send cookies to backend (cross-site sessions)
const client = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export async function registerUser(userData) {
  return await client.post(`/store/register`, userData);
}
