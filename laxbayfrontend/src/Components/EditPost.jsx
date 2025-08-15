// frontend/src/pages/EditPost.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

// Must be set in Vercel env: VITE_API_BASE_URL = https://laxbay.onrender.com/api
const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// Build /uploads URL by stripping /api from base
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  const normalized = String(imagePath).replace(/\\/g, "/");
  if (/^data:image\//i.test(normalized)) return normalized;  // DB data-URL
  if (/^https?:\/\//i.test(normalized)) return normalized;   // absolute URL
  const origin = (API || "").replace(/\/api\/?$/, "");
  return `${origin}/${normalized.replace(/^\/+/, "")}`;      // /uploads/*
};

export default function EditPost() {
  const { postId } = useParams(); // route should be /edit/:postId
  const navigate = useNavigate();

  // Current editable values (prefilled)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [currentImage, setCurrentImage] = useState("");

  // Image selection
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // UI flags
  const [errors, setErrors] = useState({});
  const [errMsg, setErrMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imgSaving, setImgSaving] = useState(false);

  // Original values to detect what actually changed
  const originalRef = useRef({
    title: "",
    description: "",
    price: "",
    category: "",
    location: "",
    image: "",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // GET /api/store/user/posts/:id
        const res = await axios.get(`${API}/store/user/posts/${postId}`, {
          withCredentials: true,
        });
        if (!alive) return;
        const p = res.data || {};
        const t = p.title ?? p.name ?? "";
        const d = p.description ?? "";
        const pr = p.price != null ? String(p.price) : "";
        const c = p.category ?? "";
        const loc = p.location ?? "";
        const img = p.image ?? "";

        // Prefill inputs
        setTitle(t);
        setDescription(d);
        setPrice(pr);
        setCategory(c);
        setLocation(loc);
        setCurrentImage(img);

        // Remember originals
        originalRef.current = {
          title: t,
          description: d,
          price: pr,
          category: c,
          location: loc,
          image: img,
        };
      } catch (e) {
        console.error("Error fetching post data:", e);
        setErrMsg(e?.response?.data?.error || "Failed to fetch post data.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [postId]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  // Detect which fields actually changed
  const diffPayload = () => {
    const out = {};
    const o = originalRef.current;

    if (title !== o.title) out.title = title;
    if (description !== o.description) out.description = description;
    if (price !== o.price) out.price = price;
    if (category !== o.category) out.category = category;
    if ((location || "") !== (o.location || "")) {
      out.location = location || sessionStorage.getItem("city") || "";
    }
    if (image) out.image = image; // file chosen

    return out;
  };

  // Only validate fields we’re sending (changed)
  const validateForm = (payload) => {
    const errs = {};
    if ("title" in payload) {
      const words = String(payload.title).trim().split(/\s+/).filter(Boolean);
      if (payload.title && words.length < 3) errs.title = "Title must have at least 3 words.";
    }
    if ("description" in payload) {
      const words = String(payload.description).trim().split(/\s+/).filter(Boolean);
      if (payload.description && words.length < 20) errs.description = "Description must have at least 20 words.";
    }
    if ("price" in payload) {
      const p = Number(payload.price);
      if (payload.price && (!Number.isFinite(p) || p <= 0)) {
        errs.price = "Price must be a valid number greater than 0.";
      }
    }
    if ("category" in payload) {
      if (payload.category && !String(payload.category).trim()) {
        errs.category = "Category cannot be blank.";
      }
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrMsg("");
    setErrors({});

    const changes = diffPayload();

    // If no fields changed, nudge the user
    if (Object.keys(changes).length === 0) {
      setErrMsg("No changes to save.");
      return;
    }

    // Validate only changed fields
    const formErrors = validateForm(changes);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    // Build request: JSON if no file, FormData if file
    let config = { withCredentials: true };
    let body;

    if (changes.image) {
      const fd = new FormData();
      // Only append changed fields
      if ("title" in changes) fd.append("title", changes.title);
      if ("description" in changes) fd.append("description", changes.description);
      if ("price" in changes) fd.append("price", changes.price);
      if ("category" in changes) fd.append("category", changes.category);
      if ("location" in changes) fd.append("location", changes.location);
      fd.append("image", changes.image);
      body = fd;
      config.headers = { "Content-Type": "multipart/form-data" };
    } else {
      body = changes; // JSON
      config.headers = { "Content-Type": "application/json" };
    }

    setSaving(true);
    try {
      // PUT /api/store/user/posts/:id  (backend ignores empty & keeps originals)
      const res = await axios.put(`${API}/store/user/posts/${postId}`, body, config);
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

  // Quick image-only update using the dedicated endpoint
  const handleQuickImageUpdate = async () => {
    if (!image) {
      setErrMsg("Choose an image first.");
      return;
    }
    setErrMsg("");
    setImgSaving(true);
    try {
      const fd = new FormData();
      fd.append("image", image);
      const res = await axios.post(`${API}/store/user/posts/${postId}/image`, fd, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCurrentImage(res.data?.image || currentImage);
      alert("Image updated!");
      setImage(null);
      setImagePreview(null);
      // Update original image reference so further diffs are correct
      originalRef.current.image = res.data?.image || originalRef.current.image;
    } catch (e) {
      console.error("Quick image update failed:", e);
      setErrMsg(e?.response?.data?.error || e.message || "Failed to update image.");
    } finally {
      setImgSaving(false);
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
        <label className="block text-sm font-medium">Title</label>
        <input
          className="w-full border p-2 rounded"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        {errors.title && <span className="text-red-600">{errors.title}</span>}

        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="w-full border p-2 rounded"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
        />
        {errors.description && <span className="text-red-600">{errors.description}</span>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Price ($)</label>
            <input
              className="w-full border p-2 rounded"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
            />
            {errors.price && <span className="text-red-600">{errors.price}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium">Category</label>
            <input
              className="w-full border p-2 rounded"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
            />
            {errors.category && <span className="text-red-600">{errors.category}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium">Location</label>
            <input
              className="w-full border p-2 rounded"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
            />
          </div>
        </div>

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
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="w-40 h-40 object-cover mt-2 rounded border" />
          )}

          <button
            type="button"
            onClick={handleQuickImageUpdate}
            disabled={!image || imgSaving}
            className={`mt-2 px-4 py-2 rounded ${imgSaving ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}
          >
            {imgSaving ? "Updating image…" : "Quick replace image"}
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`w-full text-white py-2 rounded ${saving ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
