import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../Services/UserService";

export default function Register() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [address, setAddress]     = useState("");
  const [city, setCity]           = useState("");
  const [zipCode, setZipCode]     = useState("");
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();

    if (!firstName || !lastName || !email || !username || !password || !passwordConfirmation || !address || !city || !zipCode) {
      alert("Please fill in all fields.");
      return;
    }
    const emailNorm = String(email).trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNorm)) {
      alert("Please enter a valid email.");
      return;
    }

    if (password !== passwordConfirmation) {
      alert("Passwords do not match.");
      return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      alert("Password must be at least 8 characters long and include one uppercase letter, one number, and one special character.");
      return;
    }

    const zipCodeRegex = /^\d{5}$/;
    if (!zipCodeRegex.test(zipCode)) {
      alert("Zip Code must be 5 digits.");
      return;
    }

    if (username.length < 3 || username.length > 20) {
      alert("Username must be between 3 and 20 characters.");
      return;
    }

    const userData = {
      firstName,
      lastName,
      email: emailNorm,
      username: username.trim(),
      password,
      address,
      city,
      zipCode,
    };

    try {
      const res = await registerUser(userData);
      if (res.status === 201) {
        alert("Registration successful!");
        sessionStorage.setItem("user", JSON.stringify(res.data.user));
        navigate("/login");
      } else {
        alert(res.data?.error || "Registration failed.");
      }
    } catch (error) {
      const msg = error?.response?.data?.error || error.message || "An error occurred during registration.";
      console.error("Register failed:", error?.response?.data || error);
      alert(msg);
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen pt-6 sm:justify-center sm:pt-0 bg-gray-50">
      <div className="w-full px-6 py-8 mt-6 bg-white shadow-md sm:max-w-md sm:rounded-lg">
        <h2 className="text-2xl font-bold text-center mb-4">Register</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">First Name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium">Last Name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg" autoComplete="email" />
          </div>
          <div>
            <label className="block text-sm font-medium">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg" autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-sm font-medium">Confirm Password</label>
            <input type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} className="w-full px-4 py-2 border rounded-lg" autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-sm font-medium">Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium">City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium">Zip Code</label>
            <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg">Register</button>
        </form>
      </div>
    </div>
  );
}
