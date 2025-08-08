import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

export default function PostDetails() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const fetchPostDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:3000/store/postdetails/${postId}`);
        setPost(response.data);

        const username = response.data.username;
        const emailRes = await axios.get(`http://localhost:3000/user/email/${username}`);
        setEmail(emailRes.data.email);
      } catch (err) {
        console.error("Error fetching post details:", err);
      }
    };

    fetchPostDetails();
  }, [postId]);

  if (!post) return <p>Loading...</p>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">{post.title}</h2>
      <img
        src={`http://localhost:3000/${post.image.replace(/\\/g, "/")}`}
        alt={post.title}
        className="w-full max-h-[400px] object-contain m-0 p-0 shadow-none border-none rounded-none bg-transparent"
        />

      <p className="mt-4 text-lg">{post.description}</p>
      <p className="font-semibold text-xl mt-4">${post.price}</p>
      <p className="text-xs text-gray-500">Posted by {post.username} in {post.location}</p>
      <p className="mt-4">Contact Email: <a href={`mailto:${email}`} className="text-blue-500">{email}</a></p>
    </div>
  );
}