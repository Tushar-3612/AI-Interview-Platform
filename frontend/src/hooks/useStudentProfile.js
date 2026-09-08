import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

const PROFILE_KEY = "student-profile";

const defaultProfile = {
  phone: "",
  portfolio: "",
  github: "",
  linkedin: "",
  profilePicture: null,
  preferredRole: "",
  preferredCompany: "",
  preferredLocation: "",
  skills: [],
  categorizedSkills: {},
  resumeFileName: "",
  resumeUploadedAt: null,
  interviewStatus: "not_started",
  attemptsUsed: 0,
  maxAttempts: 1,
};

/**
 * Student profile state — persisted in MongoDB & localStorage.
 * Merges auth user data with database profile fields.
 */
export function useStudentProfile() {
  const [profile, setProfile] = useState(() => {
    const authUser = getAuthUser();
    const stored = localStorage.getItem(PROFILE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return { ...defaultProfile, ...authUser, ...parsed };
  });

  // Sync with MongoDB on load
  useEffect(() => {
    const syncProfile = async () => {
      const token = getAuthToken();
      if (!token) return;
      try {
        const { data } = await api.get("/api/student/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data) {
          setProfile((prev) => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.warn("MongoDB profile sync failed, using localStorage fallback.", err.message);
      }
    };
    syncProfile();
  }, []);

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  const updateProfile = useCallback((updates) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveProfile = useCallback(async (updates = {}) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const merged = { ...profile, ...updates };
      const { data } = await api.put("/api/student/profile", merged, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data && data.user) {
        setProfile((prev) => ({ ...prev, ...data.user }));
      }
      return true;
    } catch (err) {
      console.error("Failed to sync profile to database:", err.message);
      throw err;
    }
  }, [profile]);

  const addSkill = useCallback((skill) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.includes(trimmed)
        ? prev.skills
        : [...prev.skills, trimmed],
    }));
  }, []);

  const removeSkill = useCallback((skill) => {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  }, []);

  const getProfileForInterview = useCallback(() => ({
    name: profile.name || "",
    email: profile.email || "",
    phone: profile.phone || "",
    portfolio: profile.portfolio || "",
    github: profile.github || "",
    linkedin: profile.linkedin || "",
    resumeFileName: profile.resumeFileName || "",
  }), [profile]);

  const completionPercent = calculateCompletion(profile);

  return {
    profile,
    updateProfile,
    saveProfile,
    addSkill,
    removeSkill,
    getProfileForInterview,
    completionPercent,
  };
}

export function isTokenExpired(token) {
  if (!token || typeof token !== "string") return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now() + 10000;
  } catch (e) {
    return true;
  }
}

export function clearAuthData() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  } catch (e) {
    // ignore
  }
}

export function getAuthUser() {
  const token = getAuthToken();
  if (!token) return {};

  const raw =
    localStorage.getItem("user") || sessionStorage.getItem("user");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getAuthToken() {
  let token = localStorage.getItem("token");
  if (token) {
    if (isTokenExpired(token)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      token = null;
    } else {
      return token;
    }
  }

  token = sessionStorage.getItem("token");
  if (token) {
    if (isTokenExpired(token)) {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      return null;
    }
    return token;
  }

  return null;
}

function calculateCompletion(profile) {
  const fields = [
    profile.name,
    profile.email,
    profile.phone,
    profile.department,
    profile.year,
    profile.profilePicture,
    profile.resumeFileName,
    profile.portfolio || profile.github || profile.linkedin,
    profile.skills?.length > 0,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}
