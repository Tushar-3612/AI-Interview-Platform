import { useState, useEffect, useCallback, useRef } from "react";
import api from "../utils/api";
import { normalizeProfileData } from "../utils/profileNormalizer";

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
  projects: [],
  experience: [],
  education: [],
  certifications: [],
  achievements: [],
  publications: [],
  research: [],
  leadership: [],
  volunteering: [],
  languages: [],
  interests: [],
  codingProfiles: [],
  links: [],
  summary: null,
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
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(() => {
    const authUser = getAuthUser();
    const stored = localStorage.getItem(PROFILE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return normalizeProfileData({ ...defaultProfile, ...authUser, ...parsed });
  });

  const latestRequestIdRef = useRef(0);

  // Sync with MongoDB on load (authoritative backend state)
  useEffect(() => {
    let isMounted = true;
    const syncProfile = async () => {
      const token = getAuthToken();
      if (!token) {
        if (isMounted) setIsLoading(false);
        return;
      }
      const currentRequestId = ++latestRequestIdRef.current;
      try {
        const { data } = await api.get("/api/student/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data && isMounted && currentRequestId === latestRequestIdRef.current) {
          const normalized = normalizeProfileData(data);
          setProfile((prev) => ({
            ...prev,
            ...normalized,
          }));
        }
      } catch (err) {
        console.warn("MongoDB profile sync failed, preserving local state.", err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    syncProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const refetchProfile = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return null;
    const currentRequestId = ++latestRequestIdRef.current;
    try {
      const { data } = await api.get("/api/student/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data && currentRequestId === latestRequestIdRef.current) {
        const normalized = normalizeProfileData(data);
        setProfile((prev) => ({
          ...prev,
          ...normalized,
        }));
        return normalized;
      }
    } catch (err) {
      console.warn("MongoDB profile refetch failed:", err.message);
      throw err;
    }
    return null;
  }, []);

  useEffect(() => {
    if (profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }
  }, [profile]);

  const updateProfile = useCallback((updates) => {
    setProfile((prev) => {
      const merged = { ...prev, ...updates };
      return normalizeProfileData(merged);
    });
  }, []);

  const saveProfile = useCallback(async (updates = {}) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const merged = { ...profile, ...updates };
      const { data } = await api.put("/api/student/profile", merged, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data && (data.user || data.data)) {
        const normalized = normalizeProfileData(data.user || data.data);
        setProfile((prev) => ({ ...prev, ...normalized }));
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
    isLoading,
    updateProfile,
    saveProfile,
    refetchProfile,
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
