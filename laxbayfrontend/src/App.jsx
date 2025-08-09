import './App.css';
import { useState, createContext, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NavBar from './Components/NavBar';
import Home from "./Components/Home";
import ContactUs from "./Components/Contact";
import Login from "./Components/Login";
import Register from "./Components/Register";
import ListingPage from "./Components/ListingPage";
import CreatePost from "./Components/CreatePost";
import UserPostsPage from "./Components/UserPostsPage";
import ChatBot from "./Components/ChatBot";
import EditPost from "./Components/EditPost";
import AdminPanel from "./Components/AdminPanel";
import PostDetails from "./Components/PostDetails";

// Create a context to expose login status throughout the app
export const DataContext = createContext("");

/**
 * The root application component configures global routing, state management and
 * layout.  To give the app a more professional look and feel we lighten the
 * overall page background and rely on full‑width sections rather than a fixed
 * viewport height.  This change makes the pages flow naturally as content
 * grows and prevents unpleasant scroll bars on shorter screens.
 */
export default function App() {
  const [logStatus, setLogStatus] = useState(false);

  // Restore login state on mount if the user previously authenticated
  useEffect(() => {
    if (sessionStorage.getItem("logged") === "true") {
      setLogStatus(true);
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-gray-100">
      <BrowserRouter>
        <DataContext.Provider value={{ logStatus, setLogStatus }}>
          <NavBar />
          <div className="text-center text-3xl">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/contactus" element={<ContactUs />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/listings" element={<ListingPage />} />
              <Route path="/create-post" element={<CreatePost />} />
              <Route path="/user" element={<UserPostsPage />} />
              <Route path="/chat" element={<ChatBot />} />
              <Route path="/edit/:postId" element={<EditPost />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/postdetails/:postId" element={<PostDetails />} />
            </Routes>
          </div>
        </DataContext.Provider>
      </BrowserRouter>
    </div>
  );
}
