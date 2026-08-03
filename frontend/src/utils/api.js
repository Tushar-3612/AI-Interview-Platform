import axios from "axios";

/**
 * Axios instance configured for the backend API.
 * - baseURL: reads from VITE_API_URL env var (falls back to Vite proxy)
 * - Request interceptor: auto-attaches JWT Bearer token
 * - Response interceptor: handles 401 (token expired → auto-logout)
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: {
    "Content-Type": "application/json",
  },
});

/* ── Request Interceptor ────────────────────────────────────────────── */
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Response Interceptor ───────────────────────────────────────────── */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear storage and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("student-profile");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      // Only redirect if not already on the login page
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
