import axios from "axios";

export const registerUser = (userData) => {
  return axios.post("http://localhost:3000/store/register", userData);
};