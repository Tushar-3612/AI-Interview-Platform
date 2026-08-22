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

export function getAuthUser() {
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
  return localStorage.getItem("token") || sessionStorage.getItem("token");
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
