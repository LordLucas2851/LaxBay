import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { DataContext } from "../App";

// Normalize API base (no trailing slash)
const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setLogStatus } = useContext(DataContext);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();

    const emailNorm = String(email).trim().toLowerCase();
    if (!emailNorm || !password) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const response = await axios.post(
        `${API}/store/login`,
        { email: emailNorm, password },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );

      // Persist lightweight session info for UI
      sessionStorage.setItem("logged", "true");
      sessionStorage.setItem("city", response.data.user.city || "");
      sessionStorage.setItem("role", response.data.user.role || "user");

      setLogStatus(true);
      alert("Login successful!");
      navigate("/");
    } catch (error) {
      const msg = error?.response?.data?.error || error.message || "Login failed. Please try again.";
      console.error("Login failed:", error?.response?.data || error);
      alert(msg);
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen pt-6 sm:justify-center sm:pt-0 bg-gray-50">
      <div className="w-full px-6 py-8 mt-6 bg-white shadow-md sm:max-w-md sm:rounded-lg">
        <h2 className="text-2xl font-bold text-center mb-4">Login</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
