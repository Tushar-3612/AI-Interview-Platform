import { useState, useEffect, useCallback } from "react";

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
  resumeFileName: "",
  resumeUploadedAt: null,
  interviewStatus: "not_started",
  attemptsUsed: 0,
  maxAttempts: 1,
};

/**
 * Student profile state — persisted in localStorage.
 * Merges auth user data with extended profile fields.
 */
export function useStudentProfile() {
  const [profile, setProfile] = useState(() => {
    const authUser = getAuthUser();
    const stored = localStorage.getItem(PROFILE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return { ...defaultProfile, ...authUser, ...parsed };
  });

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  const updateProfile = useCallback((updates) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

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
