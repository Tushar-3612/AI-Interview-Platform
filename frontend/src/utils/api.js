import axios from "axios";
import { getAuthToken, clearAuthData } from "../hooks/useStudentProfile";

/**
 * Axios instance configured for the backend API.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach fresh Bearer token automatically if not already set or invalid
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    config.headers = config.headers || {};
    const existingAuth = config.headers.Authorization;

    if (
      token &&
      (!existingAuth ||
        existingAuth.includes("undefined") ||
        existingAuth.includes("null") ||
        existingAuth.trim() === "Bearer")
    ) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized safely without false redirects for logged in users
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const activeToken = getAuthToken();
      // Only redirect and purge storage if the token is genuinely missing or expired
      if (!activeToken) {
        clearAuthData();
        if (
          typeof window !== "undefined" &&
          window.location.pathname !== "/" &&
          window.location.pathname !== "/signup"
        ) {
          window.location.href = "/";
        }
      } else {
        console.warn("[API] Suppressed false 401 redirect because valid auth token is active.", error.config?.url);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
