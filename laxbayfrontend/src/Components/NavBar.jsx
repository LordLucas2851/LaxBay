import { useContext } from "react";
import { Link } from "react-router-dom";
import { DataContext } from "../App";
import logo from "../Components/LaxBay.png";
import {
  Home as HomeIcon,
  Mail,
  MessageCircle,
  LayoutGrid,
  ShieldCheck,
  LogIn,
  LogOut,
  UserPlus,
} from "lucide-react";

/**
 * Navigation bar that adapts its links based on the user’s login state.
 * The styling has been updated to use a deep blue background and lighter
 * hover colours for a more polished, professional appearance.  We also
 * rename icons to avoid naming conflicts with HTML elements.
 */
export default function NavBar() {
  const { logStatus, setLogStatus } = useContext(DataContext);

  function logout() {
    sessionStorage.clear();
    setLogStatus(false);
  }

  const userRole = sessionStorage.getItem("role");

  return (
    <nav className="flex justify-between items-center px-8 py-5 bg-blue-900 text-white shadow-lg text-lg font-semibold rounded-b-xl">
      <div className="flex items-center space-x-10">
        <img src={logo} alt="LaxBay Logo" className="h-10 w-auto mr-6" />

        <Link to="/" className="flex items-center gap-2 hover:text-blue-300 transition">
          <HomeIcon size={20} /> Home
        </Link>
        <Link to="/contactus" className="flex items-center gap-2 hover:text-blue-300 transition">
          <Mail size={20} /> Contact Us
        </Link>
        <Link to="/chat" className="flex items-center gap-2 hover:text-blue-300 transition">
          <MessageCircle size={20} /> ChatBot
        </Link>
        {logStatus && (
          <>
            <Link to="/user" className="flex items-center gap-2 hover:text-blue-300 transition">
              <LayoutGrid size={20} /> My Posts
            </Link>
            {userRole === "admin" && (
              <Link to="/admin" className="flex items-center gap-2 text-red-400 font-bold hover:underline">
                <ShieldCheck size={20} /> Admin Panel
              </Link>
            )}
          </>
        )}
      </div>

      <div>
        {logStatus ? (
          <div className="flex items-center gap-5">
            <span className="text-base text-gray-300">You are logged in</span>
            <button onClick={logout} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl transition">
              <LogOut size={18} /> Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-5">
            <Link to="/login" className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl transition">
              <LogIn size={18} /> Login
            </Link>
            <Link to="/register" className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl transition">
              <UserPlus size={18} /> Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
