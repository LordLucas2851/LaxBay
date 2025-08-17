export const CATEGORIES = [
  "Heads","Shafts","Complete Sticks","Helmets","Gloves","Pads",
  "Cleats","Bags","Apparel","Goalie","Mesh/Strings","Accessories"
];

export function validateListingBody({ title, description, price, category, location }) {
  // presence
  if (![title, description, price, category, location].every(v => v !== undefined && v !== null && String(v).trim() !== "")) {
    return "All fields must be provided";
  }
  // price
  const p = Number(price);
  if (!Number.isFinite(p) || p < 0 || p > 100000) return "Invalid price";
  // category
  if (!CATEGORIES.includes(category)) return "Invalid category";
  // lengths
  if (String(title).length > 120) return "Title too long";
  if (String(description).length > 5000) return "Description too long";
  if (String(location).length > 120) return "Location too long";
  return null;
}

export function validateOptionalPriceAndCategory({ price, category }) {
  if (category !== undefined && category !== "" && !CATEGORIES.includes(category)) {
    return "Invalid category";
  }
  if (price !== undefined && price !== "") {
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0 || p > 100000) return "Invalid price";
  }
  return null;
}
