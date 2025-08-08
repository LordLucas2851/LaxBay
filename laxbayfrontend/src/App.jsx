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

export const DataContext = createContext("");

export default function App() {
  const [logStatus, setLogStatus] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("logged") === "true") {
      setLogStatus(true);
    }
  }, []);

  return (
    <div className='w-[100vw] h-[100vh] bg-amber-100'>
      <BrowserRouter>
        <DataContext.Provider value={{ logStatus, setLogStatus }}>
          <NavBar />
          <div className='text-center text-3xl'>
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