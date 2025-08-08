import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

const EditPost = () => {
  const { postId } = useParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentImage, setCurrentImage] = useState(""); 
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const response = await axios.get(`http://localhost:3000/store/user/post/${postId}`, {
          withCredentials: true,
        });

        if (response.data) {
          setTitle(response.data.title || "");
          setDescription(response.data.description || "");
          setPrice(response.data.price || "");
          setCategory(response.data.category || "");
          setLocation(response.data.location || "");
          setCurrentImage(response.data.image || "");
          setImagePreview(""); 
        }
      } catch (error) {
        console.error("Error fetching post data:", error);
        alert("Failed to fetch post data.");
      }
    };

    if (postId) {
      fetchPost();
    }
  }, [postId]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    setImagePreview(URL.createObjectURL(file)); 
  };

  const validateForm = () => {
    const errors = {};
    if (title.split(" ").length < 3) {
      errors.title = "Title must contain at least 3 words.";
    }
    if (description.split(" ").length < 20) {
      errors.description = "Description must contain at least 20 words.";
    }
    if (!price || isNaN(price) || price <= 0) {
      errors.price = "Price must be a valid number greater than 0.";
    }
    if (!category) {
      errors.category = "Category is required.";
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("category", category);
    formData.append("location", sessionStorage.getItem("city") || ""); 

    if (image) {
      formData.append("image", image); 
    } else {
      formData.append("image", currentImage); 
    }

    try {
      const response = await axios.put(`http://localhost:3000/store/user/update/${postId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      console.log(response.data);
      alert("Post updated successfully!");
      navigate(-1);
    } catch (error) {
      console.error("Error updating post:", error.response ? error.response.data : error.message);
      alert("Error updating post: " + (error.response ? error.response.data.error : error.message));
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Edit Listing</h2>
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
        ></textarea>
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
          <option value="Sticks">Sticks</option>
          <option value="Gloves">Gloves</option>
          <option value="Helmets">Helmets</option>
          <option value="Cleats">Cleats</option>
          <option value="Apparel">Apparel</option>
        </select>
        {errors.category && <span className="text-red-600">{errors.category}</span>}

        <div>
          <label className="block text-lg font-semibold mb-1">Current Image</label>
          {currentImage && !imagePreview && (
            <img
              src={`http://localhost:3000/${currentImage.replace(/\\/g, "/")}`}
              alt="Current Post Image"
              className="w-32 h-32 object-cover mb-4"
            />
          )}
        </div>

        <input
          type="file"
          name="image"
          accept="image/*"
          className="w-full border p-2 rounded"
          onChange={handleImageChange}
        />
        {imagePreview && (
          <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover mt-2" />
        )}
        {errors.image && <span className="text-red-600">{errors.image}</span>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Update Post
        </button>
      </form>
    </div>
  );
};

export default EditPost;