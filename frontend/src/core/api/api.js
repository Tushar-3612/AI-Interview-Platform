import axios from "axios";
import { getAuthToken, clearAuthData } from "../../features/student/hooks/useStudentProfile.js";

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

// Response Interceptor: Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      clearAuthData();

      // Do not forcibly redirect anonymous users away from the public NPTEL
      // test page. Auth data is still cleared and the error is still rejected
      // so the caller's own try/catch (client-side fallback evaluation) fires.
      const isPublicNptelTest =
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/nptel-assignment/test");

      if (
        !isPublicNptelTest &&
        typeof window !== "undefined" &&
        window.location.pathname !== "/" &&
        window.location.pathname !== "/signup"
      ) {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
