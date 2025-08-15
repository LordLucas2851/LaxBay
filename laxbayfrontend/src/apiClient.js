// frontend/src/apiClient.js
import axios from "axios";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, ""); 
// must be e.g. "https://laxbay.onrender.com/api"

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,        // keep cookies/session
  timeout: 15000,               // helpful on Render cold starts
});

// Surface server-provided error messages in console & UI
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const path   = err?.config?.url;
    const msg    = err?.response?.data?.error || err?.message || "Request failed";
    // Log once clearly
    console.error(`[API ${status || "ERR"}] ${path} -> ${msg}`, err?.response?.data || "");
    // Re-throw with a clean message for callers
    err.message = msg;
    return Promise.reject(err);
  }
);

export default apiClient;

// Optional helpers (import where needed):
export const apiOrigin = API_BASE_URL.replace(/\/api$/, "");
export const buildImageUrl = (raw) => {
  if (!raw) return "";
  const normalized = String(raw).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `${apiOrigin}/${normalized.replace(/^\/+/, "")}`; // serves /uploads/*
};
