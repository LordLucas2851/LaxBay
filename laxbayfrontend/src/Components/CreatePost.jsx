import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Normalize backend base URL (no trailing slash)
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

const CANON_CATEGORIES = [
  "Heads","Shafts","Complete Sticks","Helmets","Gloves","Pads",
  "Cleats","Bags","Apparel","Goalie","Mesh/Strings","Accessories"
];

// Optional mapping if you ever show friendlier labels
const CATEGORY_MAP = {
  heads: "Heads",
  shafts: "Shafts",
  "complete sticks": "Complete Sticks",
  helmets: "Helmets",
  gloves: "Gloves",
  pads: "Pads",
  cleats: "Cleats",
  bags: "Bags",
  apparel: "Apparel",
  goalie: "Goalie",
  mesh: "Mesh/Strings",
  strings: "Mesh/Strings",
  accessories: "Accessories",
  sticks: "Complete Sticks", // your old option → canonical
};

const CreatePost = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [errors, setErrors] = useState({});

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Client-side validation aligned with backend (don’t be stricter than server)
  const validateForm = () => {
    const errs = {};
    if (!title.trim()) errs.title = "Title is required.";
    if (!description.trim()) errs.description = "Description is required.";
    if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) {
      errs.price = "Price must be a positive number.";
    }
    if (!category) errs.category = "Category is required.";
    // Image is optional on the server; keep required in UI if you prefer
    if (!image) errs.image = "Image is required.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateForm();
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    // Map category to canonical value the server accepts
    const catKey = String(category).toLowerCase().trim();
    const canonicalCategory = CATEGORY_MAP[catKey] || category;

    if (!CANON_CATEGORIES.includes(canonicalCategory)) {
      setErrors({ category: "Please select a valid category." });
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("price", String(price).trim());
    formData.append("category", canonicalCategory);
    formData.append("location", sessionStorage.getItem("city") || "");

    if (image) formData.append("image", image);

    try {
      const resp = await axios.post(`${API_BASE_URL}/store/create`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      console.log(resp.data);
      alert("Post created successfully!");
      navigate("/");
    } catch (error) {
      const serverMsg = error?.response?.data?.error || error.message || "Error creating post.";
      console.error("Error creating post:", error?.response?.data || error);
      alert(serverMsg);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Create a Listing</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="title"
          placeholder="Title"
          className="w-full border p-2 rounded"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        {errors.title && <span className="text-red-600">{errors.title}</span>}

        <textarea
          name="description"
          placeholder="Description"
          className="w-full border p-2 rounded"
          rows="4"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        {errors.description && <span className="text-red-600">{errors.description}</span>}

        <input
          type="number"
          name="price"
          placeholder="Price ($)"
          className="w-full border p-2 rounded"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        {errors.price && <span className="text-red-600">{errors.price}</span>}

        <select
          name="category"
          className="w-full border p-2 rounded"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          <option value="">Select Category</option>
          {/* Use canonical values to avoid 400s */}
          <option value="Heads">Heads</option>
          <option value="Shafts">Shafts</option>
          <option value="Complete Sticks">Complete Sticks</option>
          <option value="Helmets">Helmets</option>
          <option value="Gloves">Gloves</option>
          <option value="Pads">Pads</option>
          <option value="Cleats">Cleats</option>
          <option value="Bags">Bags</option>
          <option value="Apparel">Apparel</option>
          <option value="Goalie">Goalie</option>
          <option value="Mesh/Strings">Mesh/Strings</option>
          <option value="Accessories">Accessories</option>
        </select>
        {errors.category && <span className="text-red-600">{errors.category}</span>}

        <input
          type="file"
          name="image"
          accept="image/png,image/jpeg,image/webp"
          className="w-full border p-2 rounded"
          onChange={handleImageChange}
          required
        />
        {imagePreview && (
          <img src={imagePreview} alt="Preview" className="w-full mt-2 rounded" />
        )}
        {errors.image && <span className="text-red-600">{errors.image}</span>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Submit Post
        </button>
      </form>
    </div>
  );
};

export default CreatePost;
