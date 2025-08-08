import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="p-10 max-w-4xl mx-auto bg-white shadow-2xl rounded-2xl text-center mt-10">
      <h1 className="text-5xl font-extrabold mb-6 text-gray-800">Welcome to LaxBay</h1>
      <p className="text-xl text-gray-600 mb-8">
        The ultimate marketplace for lacrosse players. Find high-quality gear, score great deals, or list your own equipment with ease.
      </p>

      <div className="flex justify-center gap-6 flex-wrap mb-10">
        <button
          onClick={() => navigate("/listings")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl text-lg font-medium transition duration-200 ease-in-out shadow-md hover:shadow-lg"
        >
          Explore Gear
        </button>

        <button
          onClick={() => navigate("/create-post")}
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-2xl text-lg font-medium transition duration-200 ease-in-out shadow-md hover:shadow-lg"
        >
          List Your Gear
        </button>
      </div>

      <p className="text-md text-gray-500">
        Trusted by players, coaches, and teams across the country. Join the community and elevate your game.
      </p>
    </div>
  );
}