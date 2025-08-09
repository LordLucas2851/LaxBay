import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { DataContext } from "../App";

// Use environment variable for API base URL
const API = import.meta.env.VITE_API_URL;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setLogStatus } = useContext(DataContext);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();

    if (!email || !password) {
      alert("Please fill in all fields");
      return;
    }

    try {
      // POST to backend using API base URL and include credentials
      const response = await axios.post(`${API}/store/login`, { email, password }, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      // Save session info
      sessionStorage.setItem("logged", "true");
      sessionStorage.setItem("city", response.data.user.city);
      sessionStorage.setItem("role", response.data.user.role);

      setLogStatus(true);

      alert("Login successful!");
      navigate("/");
    } catch (error) {
      console.error("Error:", error);
      alert(error.response?.data?.error || "Login failed. Please try again.");
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
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
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
