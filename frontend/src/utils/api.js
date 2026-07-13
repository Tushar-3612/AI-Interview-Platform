import axios from "axios";

/**
 * Axios instance configured for the backend API.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
