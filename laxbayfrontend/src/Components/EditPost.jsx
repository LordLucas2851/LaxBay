import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

// ✅ Correct env var: includes /api
const API = import.meta.env.VITE_API_BASE_URL;

// Build correct image URLs: remove trailing /api so /uploads works
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  const normalized = String(imagePath).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const origin = (API || "").replace(/\/api\/?$/, "");
  return `${origin}/${normalized.replace(/^\/+/, "")}`;
};

const EditPost = () => {
  const { postId } = useParams();
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
        // Try admin first; fall back to user route if 404
        let res;
        try {
          res = await axios.get(`${API}/store/admin/posts/${postId}`, { withCredentials: true });
        } catch (e) {
          if (e?.response?.status === 404) {
            res = await axios.get(`${API}/store/user/post/${postId}`, { withCredentials: true });
          } else {
            throw e;
          }
        }
        if (!alive) return;

        const data = res.data || {};
        setTitle(data.title ?? data.name ?? "");
        setDescription(data.description ?? "");
        setPrice(String(data.price ?? ""));
        setCategory(data.category ?? "");
        setLocation(data.location ?? "");
        setCurrentImage(data.image ?? "");
        setImagePreview(null);
      } catch (err) {
        console.error("Error fetching post data:", err);
        if (alive) setErrMsg(err?.response?.data?.error || "Failed to fetch post data.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [postId]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    setImage(file || null);
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
      // Try admin JSON update first
      try {
        await axios.put(
          `${API}/store/admin/posts/${postId}`,
          {
            title,
            description,
            price: Number(price),
            category,
            location: location || sessionStorage.getItem("city") || "",
          },
          { withCredentials: true }
        );

        // If new image chosen, upload it to the admin image endpoint
        if (image) {
          const fd = new FormData();
          fd.append("image", image);
          await axios.put(`${API}/store/admin/posts/${postId}/image`, fd, {
            withCredentials: true,
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      } catch (err) {
        // If admin routes don't exist, fall back to user multipart update
        if (err?.response?.status === 404) {
          const fd = new FormData();
          fd.append("title", title);
          fd.append("description", description);
          fd.append("price", price);
          fd.append("category", category);
          fd.append("location", location || sessionStorage.getItem("city") || "");
          if (image) fd.append("image", image);
          else if (currentImage) fd.append("image", currentImage);

          await axios.put(`${API}/store/user/update/${postId}`, fd, {
            withCredentials: true,
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          throw err;
        }
      }

      alert("Post updated successfully!");
      navigate(-1);
    } catch (error) {
      console.error("Error updating post:", error);
      setErrMsg(error?.response?.data?.error || error?.message || "Failed to update post.");
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

        <input
          type="text"
          name="category"
          placeholder="Category"
          className="w-full border p-2 rounded"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        />

        <input
          type="text"
          name="location"
          placeholder="Location"
          className="w-full border p-2 rounded"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <div>
          <label className="block text-lg font-semibold mb-1">Current Image</label>
          {currentImage && !imagePreview ? (
            <img
              src={getImageUrl(currentImage)}
              alt="Current Post"
              className="w-40 h-40 object-cover rounded border"
            />
          ) : (
            <div className="text-gray-500 text-sm">No image</div>
          )}
        </div>

        <div>
          <label className="block text-lg font-semibold mb-1">Replace Image (optional)</label>
          <input type="file" name="image" accept="image/*" className="w-full border p-2 rounded" onChange={handleImageChange} />
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
};

export default EditPost;
