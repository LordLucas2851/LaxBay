import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

// ✅ Correct base (must be set in Vercel): https://laxbay.onrender.com/api
const API = import.meta.env.VITE_API_BASE_URL;

// Build /uploads URL by stripping /api from base
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  const normalized = String(imagePath).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const origin = (API || "").replace(/\/api\/?$/, "");
  return `${origin}/${normalized.replace(/^\/+/, "")}`;
};

export default function EditPost() {
  const { postId } = useParams();        // route should be /edit/:postId
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [currentImage, setCurrentImage] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [errMsg, setErrMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Load your own post details from user route
        const res = await axios.get(`${API}/store/user/post/${postId}`, {
          withCredentials: true
        });
        if (!alive) return;
        const p = res.data || {};
        setTitle(p.title ?? p.name ?? "");
        setDescription(p.description ?? "");
        setPrice(String(p.price ?? ""));
        setCategory(p.category ?? "");
        setLocation(p.location ?? "");
        setCurrentImage(p.image ?? "");
      } catch (e) {
        console.error("Error fetching post data:", e);
        if (alive) setErrMsg(e?.response?.data?.error || "Failed to fetch post data.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [postId]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const validateForm = () => {
    const errs = {};
    if (title.trim().split(/\s+/).length < 3) errs.title = "Title must contain at least 3 words.";
    if (description.trim().split(/\s+/).length < 20) errs.description = "Description must contain at least 20 words.";
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) errs.price = "Price must be a valid number greater than 0.";
    if (!category) errs.category = "Category is required.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrMsg("");

    const formErrors = validateForm();
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("description", description);
      fd.append("price", price);
      fd.append("category", category);
      fd.append("location", location || sessionStorage.getItem("city") || "");
      if (image) fd.append("image", image); // send file only if selected

      // ✅ User update endpoint (your backend already has this)
      const res = await axios.put(`${API}/store/user/update/${postId}`, fd, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Update ok:", res.data);
      alert("Post updated successfully!");
      navigate(-1);
    } catch (e) {
      console.error("Error updating post:", e);
      setErrMsg(e?.response?.data?.error || e.message || "Failed to update post.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Edit Listing</h2>

      {errMsg && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {errMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full border p-2 rounded" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        {errors.title && <span className="text-red-600">{errors.title}</span>}

        <textarea className="w-full border p-2 rounded" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        {errors.description && <span className="text-red-600">{errors.description}</span>}

        <input className="w-full border p-2 rounded" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price ($)" />
        {errors.price && <span className="text-red-600">{errors.price}</span>}

        <input className="w-full border p-2 rounded" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
        {errors.category && <span className="text-red-600">{errors.category}</span>}

        <input className="w-full border p-2 rounded" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />

        <div>
          <label className="block text-sm font-medium mb-1">Current Image</label>
          {currentImage ? (
            <img src={getImageUrl(currentImage)} alt="Current" className="w-40 h-40 object-cover rounded border" />
          ) : (
            <div className="text-gray-500 text-sm">No image</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Replace Image (optional)</label>
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {imagePreview && <img src={imagePreview} alt="Preview" className="w-40 h-40 object-cover mt-2 rounded border" />}
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`w-full text-white py-2 rounded ${saving ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {saving ? "Saving…" : "Update Post"}
        </button>
      </form>
    </div>
  );
}
