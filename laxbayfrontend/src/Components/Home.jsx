import { useNavigate } from "react-router-dom";

/**
 * Home page displaying a hero section with call‑to‑action buttons.  Updated
 * styling introduces softer colours and refined typography to give the page a
 * more polished feel while keeping the layout centred and responsive.
 */
export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="p-10 max-w-4xl mx-auto bg-white shadow-xl rounded-2xl text-center mt-16">
      <h1 className="text-5xl font-extrabold mb-6 text-gray-800">Welcome to LaxBay</h1>
      <p className="text-xl text-gray-600 mb-8">
        The ultimate marketplace for lacrosse players. Find high‑quality gear, score great deals, or list your own equipment with ease.
      </p>

      <div className="flex justify-center gap-6 flex-wrap mb-10">
        <button
          onClick={() => navigate("/listings")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl text-lg font-medium transition duration-200 ease-in-out shadow-md hover:shadow-lg"
        >
          Explore Gear
        </button>

        <button
          onClick={() => navigate("/create-post")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl text-lg font-medium transition duration-200 ease-in-out shadow-md hover:shadow-lg"
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
