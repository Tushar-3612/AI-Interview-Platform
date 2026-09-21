import { useState, useRef, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  User,
  Mail,
  Phone,
  Building2,
  GraduationCap,
  Globe,
  FileText,
  Upload,
  Download,
  Eye,
  Plus,
  X,
  Camera,
  Award,
  Briefcase,
  Building,
  MapPin,
  Sparkles,
  ExternalLink,
  Edit3,
  Share2,
  CheckCircle2,
  Flame,
  Target,
  Zap,
  BookOpen,
  Code2,
  Layers,
  Database,
  Cloud,
  Wrench,
  Brain,
  HelpCircle,
  FolderGit2,
  BookMarked,
  Languages,
  Link2,
  Calendar,
  ChevronRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import Button from "../../components/ui/Button";
import { GithubIcon, LinkedinIcon } from "../../components/ui/BrandIcons";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import useCachedApi, { clearApiCache } from "../../hooks/useCachedApi";
import { normalizeProfileData } from "../../utils/profileNormalizer";
import EditProfileModal from "../../components/student/EditProfileModal";

export default function Profile() {
  const context = useOutletContext() || {};
  const {
    profile = {},
    isLoading = false,
    updateProfile = () => {},
    saveProfile = async () => {},
    refetchProfile = async () => {},
    addSkill = () => {},
    removeSkill = () => {},
    completionPercent = 0,
  } = context;

  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const [skillInput, setSkillInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadStage, setUploadStage] = useState(1);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalTab, setEditModalTab] = useState("personal");

  // Placement overview data for achievements & interview activity
  const { data: placementData } = useCachedApi({
    url: "/api/placement/overview",
    key: "placement:overview",
    ttlMs: 60 * 1000,
  });

  const placementAchievements = placementData?.achievements;
  const unlockedCount = placementAchievements?.unlocked?.length || 0;
  const totalCount = unlockedCount + (placementAchievements?.locked?.length || 0);

  const readinessScore = placementData?.readiness?.overallScore ?? profile?.readinessAnalysis?.score ?? profile?.resumeAnalysis?.readinessAnalysis?.score ?? profile?.atsScore ?? null;
  const currentStreak = placementData?.streaks?.currentStreak ?? 0;

  const displayCompletion = useMemo(() => {
    if (typeof completionPercent === "number" && !isNaN(completionPercent) && completionPercent > 0) {
      return completionPercent;
    }
    const fields = [
      profile?.name,
      profile?.email,
      profile?.phone,
      profile?.department,
      profile?.year,
      profile?.profilePicture,
      profile?.resumeFileName,
      profile?.portfolio || profile?.github || profile?.linkedin,
      (profile?.skills || [])?.length > 0,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100) || 0;
  }, [completionPercent, profile]);

  const openEditModal = (tab = "personal") => {
    setEditModalTab(tab);
    setEditModalOpen(true);
  };

  const handleSaveModal = async (formData) => {
    updateProfile(formData);
    try {
      await saveProfile(formData);
      toast.success("Profile updated successfully!");
    } catch {
      toast.error("Failed to sync profile changes to database");
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateProfile({ profilePicture: reader.result });
      saveProfile({ profilePicture: reader.result })
        .then(() => toast.success("Profile picture updated!"))
        .catch(() => toast.error("Failed to save avatar image"));
    };
    reader.readAsDataURL(file);
  };

  const handleResumeUpload = async (e) => {
    if (isUploadingResume) return; // Prevent duplicate uploads

    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isPdfOrDocx = file.type === "application/pdf" || lowerName.endsWith(".pdf") || lowerName.endsWith(".docx") || file.type.includes("wordprocessingml");

    if (!isPdfOrDocx) {
      toast.error("Please select a valid PDF or DOCX resume file");
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Resume file size must be under 10MB");
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    setIsUploadingResume(true);
    setSaving(true);
    setUploadStage(1);

    try {
      const token = getAuthToken();
      
      // Step 1: Upload and trigger backend parsing + MongoDB persistence
      setUploadStage(2);
      const { data } = await api.post("/api/student/resume/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      setUploadStage(3);

      // Clear old active interview session IDs so new interview uses fresh resume
      try {
        localStorage.removeItem("active_real_interview_session_id");
        localStorage.removeItem("active_individual_project_session_id");
        localStorage.removeItem("active_individual_technical_session_id");
      } catch (err) {
        // ignore
      }

      // Invalidate API caches so placement overview & related queries refetch fresh
      clearApiCache();

      // Step 2: Fresh authoritative profile fetch directly from MongoDB
      setUploadStage(4);
      if (typeof refetchProfile === "function") {
        await refetchProfile();
      } else if (data) {
        const normalized = normalizeProfileData(data.user || data.data || data);
        updateProfile(normalized);
      }

      if (data?.warnings && data.warnings.length > 0) {
        toast.success(`Resume analyzed with note: ${data.warnings[0]}`, { duration: 5000 });
      } else {
        toast.success("Resume uploaded and analyzed successfully!");
      }
    } catch (err) {
      console.error("Resume upload error:", err);
      const serverMsg = err.response?.data?.message;
      toast.error(
        serverMsg && !serverMsg.includes("Cast to") && !serverMsg.includes("Mongo")
          ? serverMsg
          : "Resume analysis failed. Your previous resume data is still safe. Please try again."
      );
    } finally {
      setIsUploadingResume(false);
      setSaving(false);
      setUploadStage(1);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }
    }
  };

  const handleDownloadResume = async () => {
    if (!profile.resumeFileName) {
      toast.error("No resume uploaded yet");
      return;
    }
    try {
      const token = getAuthToken();
      const response = await fetch("/api/student/resume/download", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Resume download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = profile.resumeFileName || "Resume.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast.error("Could not download resume file");
    }
  };

  const handleViewResume = async () => {
    if (!profile.resumeFileName) {
      toast.error("No resume uploaded yet");
      return;
    }
    try {
      const token = getAuthToken();
      const response = await fetch("/api/student/resume/view", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Resume view failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      toast.error("Could not open resume preview");
    }
  };

  const handleShareProfile = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Profile link copied to clipboard!");
    } else {
      toast.success("Profile ready to share");
    }
  };

  const missingItems = useMemo(() => {
    const items = [];
    if (!profile.linkedin) items.push({ label: "+ Add LinkedIn", tab: "links" });
    if (!profile.github) items.push({ label: "+ Add GitHub", tab: "links" });
    if (!profile.portfolio) items.push({ label: "+ Add Portfolio", tab: "links" });
    if (!profile.preferredRole) items.push({ label: "+ Add Preferred Role", tab: "career" });
    if (!profile.preferredLocation) items.push({ label: "+ Add Preferred Location", tab: "career" });
    if (!profile.resumeFileName) items.push({ label: "+ Upload Resume", action: "resume" });
    return items;
  }, [profile]);

  const skillCategories = [
    { key: "programming_languages", label: "Programming Languages", icon: Code2, color: "#3b82f6" },
    { key: "web_technologies", label: "Web Technologies", icon: Globe, color: "#f59e0b" },
    { key: "frameworks", label: "Frameworks", icon: Layers, color: "#06b6d4" },
    { key: "databases", label: "Databases", icon: Database, color: "#10b981" },
    { key: "cloud", label: "Cloud Platforms", icon: Cloud, color: "#38bdf8" },
    { key: "tools", label: "Tools & Technologies", icon: Wrench, color: "#64748b" },
    { key: "data_science", label: "Data Science & AI / ML", icon: Brain, color: "#8b5cf6" },
    { key: "other", label: "Other Technical Skills", icon: HelpCircle, color: "#a855f7" },
  ];

  const totalSkillsCount = (profile.skills || []).length;
  const projectsList = Array.isArray(profile.projects) ? profile.projects : [];
  const experienceList = Array.isArray(profile.experience) ? profile.experience : [];
  const educationList = Array.isArray(profile.education) ? profile.education : [];
  const certificationsList = Array.isArray(profile.certifications) ? profile.certifications : [];
  const achievementsList = Array.isArray(profile.achievements) ? profile.achievements : [];
  const publicationsList = Array.isArray(profile.publications) ? profile.publications : [];
  const researchList = Array.isArray(profile.research) ? profile.research : [];
  const leadershipList = Array.isArray(profile.leadership) ? profile.leadership : [];
  const volunteeringList = Array.isArray(profile.volunteering) ? profile.volunteering : [];
  const languagesList = Array.isArray(profile.languages) ? profile.languages : [];
  const interestsList = Array.isArray(profile.interests) ? profile.interests : [];
  const codingProfilesList = Array.isArray(profile.codingProfiles) ? profile.codingProfiles : [];
  const linksList = Array.isArray(profile.links) ? profile.links : [];

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="min-h-screen pb-16 transition-colors" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

        {/* ── 1. PROFILE HEADER CARD ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border p-6 sm:p-8 relative overflow-hidden transition-colors"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
              <div className="relative group shrink-0">
                {profile.profilePicture ? (
                  <img
                    src={profile.profilePicture}
                    alt={profile.name || "Candidate Avatar"}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 shadow-sm"
                    style={{ borderColor: "var(--border)" }}
                  />
                ) : (
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-3xl font-extrabold text-white shadow-sm border-2 border-black/5"
                    style={{
                      background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    }}
                  >
                    {profile.name?.[0]?.toUpperCase() || "C"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Change avatar image"
                  className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5 cursor-pointer backdrop-blur-[2px]"
                >
                  <Camera className="w-4 h-4" />
                  <span>Change</span>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                    {profile.name || "Candidate Profile"}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Sparkles className="w-3 h-3" />
                    Verified Student
                  </span>
                </div>

                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  {profile.headline ||
                    `${profile.department || "Engineering"} Student | ${
                      profile.preferredRole || "Software Developer"
                    }`}
                </p>

                <div className="flex items-center gap-3 text-xs flex-wrap pt-1" style={{ color: "var(--text-muted)" }}>
                  {profile.department && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 opacity-70" />
                      {profile.department}
                    </span>
                  )}
                  {profile.year && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 opacity-70" />
                      {profile.year}
                    </span>
                  )}
                  {profile.preferredLocation && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 opacity-70" />
                      {profile.preferredLocation}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  {profile.github ? (
                    <a
                      href={profile.github.startsWith("http") ? profile.github : `https://${profile.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition hover:border-blue-400/50"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 3%, var(--card-bg))",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <GithubIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>GitHub</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border border-dashed hover:border-blue-500 hover:text-blue-500 transition cursor-pointer"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add GitHub</span>
                    </button>
                  )}

                  {profile.linkedin ? (
                    <a
                      href={profile.linkedin.startsWith("http") ? profile.linkedin : `https://${profile.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition hover:border-blue-400/50"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 3%, var(--card-bg))",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <LinkedinIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>LinkedIn</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border border-dashed hover:border-blue-500 hover:text-blue-500 transition cursor-pointer"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add LinkedIn</span>
                    </button>
                  )}

                  {profile.portfolio ? (
                    <a
                      href={profile.portfolio.startsWith("http") ? profile.portfolio : `https://${profile.portfolio}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition hover:border-emerald-400/50"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 3%, var(--card-bg))",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Portfolio</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border border-dashed hover:border-blue-500 hover:text-blue-500 transition cursor-pointer"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Portfolio</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Button
                variant="outline"
                onClick={() => openEditModal("personal")}
                className="px-4 py-2 text-xs font-bold"
                disabled={isUploadingResume}
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5 inline" />
                Edit Profile
              </Button>

              <Button
                onClick={() => !isUploadingResume && resumeInputRef.current?.click()}
                className="px-4 py-2 text-xs font-bold"
                loading={isUploadingResume || saving}
                disabled={isUploadingResume || saving}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5 inline" />
                {profile.resumeFileName ? "Replace Resume" : "Upload Resume"}
              </Button>

              <button
                type="button"
                onClick={handleShareProfile}
                title="Share Profile"
                className="p-2.5 rounded-xl border hover:opacity-80 transition cursor-pointer"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--card-bg)",
                }}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── 2. PROFILE COMPLETION (PROFILE STRENGTH) ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border p-5 transition-colors"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    Profile Strength
                  </span>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    {displayCompletion}% Complete
                  </span>
                </div>
              </div>

              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: "color-mix(in srgb, var(--text-primary) 8%, var(--card-bg))" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${displayCompletion}%`,
                    background:
                      displayCompletion >= 80
                        ? "linear-gradient(90deg, #3b82f6, #10b981)"
                        : "linear-gradient(90deg, #f59e0b, #3b82f6)",
                  }}
                />
              </div>

              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Complete your profile to improve your AI-driven recommendations.
              </p>
            </div>

            {missingItems.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1 md:pt-0">
                {missingItems.slice(0, 4).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isUploadingResume}
                    onClick={() => {
                      if (item.action === "resume") {
                        if (!isUploadingResume) resumeInputRef.current?.click();
                      } else {
                        openEditModal(item.tab);
                      }
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-300 hover:bg-blue-500/15 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── 3. MAIN GRID (2 COLUMNS) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN (2 of 3 width on desktop) ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── 1. PERSONAL INFORMATION CARD ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Personal Information
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Core candidate credentials and contact details
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openEditModal("personal")}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border hover:opacity-80 transition flex items-center gap-1.5 cursor-pointer"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                    background: "var(--card-bg)",
                  }}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className="p-3.5 rounded-xl border transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
                    Full Name
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <User className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="truncate">{profile.name || "Not specified"}</span>
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
                    Email Address
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="truncate">{profile.email || "Not specified"}</span>
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
                    Phone Number
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="truncate">{profile.phone || "Not added"}</span>
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
                    Department / Branch
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <Building2 className="w-4 h-4 text-purple-500 shrink-0" />
                    <span className="truncate">{profile.department || "Not specified"}</span>
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border transition-colors sm:col-span-2"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
                    Academic Year
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <GraduationCap className="w-4 h-4 text-cyan-500 shrink-0" />
                    <span>{profile.year || "Not specified"}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── 2. RESUME SUMMARY SECTION ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    Resume Summary
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Professional overview extracted from your resume
                  </p>
                </div>
              </div>

              {profile.summary ? (
                <div
                  className="p-4 rounded-xl border text-xs leading-relaxed transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {profile.summary}
                </div>
              ) : (
                <div
                  className="text-center py-6 border border-dashed rounded-xl p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <FileText className="w-6 h-6 mx-auto mb-2 opacity-40" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    No resume summary detected. Upload your resume to extract your executive summary.
                  </p>
                </div>
              )}
            </section>

            {/* ── 3. TECHNICAL & PROFESSIONAL SKILLS ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    <Zap className="w-4 h-4 text-amber-500" />
                    Technical & Professional Skills
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Extracted from your resume & customizable
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {totalSkillsCount} Detected Skills
                </span>
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (skillInput.trim()) {
                        addSkill(skillInput);
                        setSkillInput("");
                        toast.success(`Added skill: ${skillInput.trim()}`);
                      }
                    }
                  }}
                  placeholder="Add a custom skill (e.g. Docker, PyTorch, GraphQL)..."
                  className="flex-1 px-4 py-2.5 rounded-xl border text-xs outline-none transition"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (skillInput.trim()) {
                      addSkill(skillInput);
                      setSkillInput("");
                      toast.success(`Added skill: ${skillInput.trim()}`);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Skill</span>
                </button>
              </div>

              {profile.categorizedSkills &&
              Object.keys(profile.categorizedSkills).some(
                (k) => Array.isArray(profile.categorizedSkills[k]) && profile.categorizedSkills[k].length > 0
              ) ? (
                <div className="space-y-4">
                  {skillCategories
                    .filter(
                      (cat) =>
                        Array.isArray(profile.categorizedSkills?.[cat.key]) &&
                        profile.categorizedSkills[cat.key].length > 0
                    )
                    .map((cat) => {
                      const Icon = cat.icon;
                      const skills = profile.categorizedSkills[cat.key];
                      return (
                        <div
                          key={cat.key}
                          className="p-4 rounded-xl border transition-colors"
                          style={{
                            background: `color-mix(in srgb, ${cat.color} 3%, var(--card-bg))`,
                            borderColor: `color-mix(in srgb, ${cat.color} 20%, var(--border))`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3
                              className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                              style={{ color: cat.color }}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {cat.label}
                            </h3>
                            <span className="text-[10px] font-semibold opacity-70" style={{ color: "var(--text-muted)" }}>
                              {skills.length} skills
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {skills.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition hover:scale-[1.02]"
                                style={{
                                  borderColor: `color-mix(in srgb, ${cat.color} 35%, transparent)`,
                                  background: `color-mix(in srgb, ${cat.color} 10%, var(--card-bg))`,
                                  color: "var(--text-primary)",
                                }}
                              >
                                {skill}
                                <button
                                  type="button"
                                  onClick={() => removeSkill(skill)}
                                  className="cursor-pointer opacity-60 hover:opacity-100 hover:text-red-500 transition"
                                  title={`Remove ${skill}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(profile.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 3%, var(--card-bg))",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="cursor-pointer opacity-60 hover:opacity-100 hover:text-red-500 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {totalSkillsCount === 0 && (
                    <div
                      className="w-full text-center py-6 border border-dashed rounded-xl"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-40" style={{ color: "var(--text-muted)" }} />
                      <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        No skills detected yet. Upload your resume above to automatically extract skills.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── 4. PROJECTS SECTION ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <FolderGit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Projects
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Key technical projects isolated from resume
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {projectsList.length} Confirmed Projects
                </span>
              </div>

              {projectsList.length > 0 ? (
                <div className="space-y-4">
                  {projectsList.map((proj, idx) => (
                    <div
                      key={proj.id || proj.title || idx}
                      className="p-4 rounded-xl border transition-colors space-y-2.5"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                            {proj.title || proj.name || "Untitled Project"}
                          </h3>
                          {proj.duration && (
                            <span className="text-[11px] font-medium opacity-75 flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                              <Calendar className="w-3 h-3" />
                              {proj.duration}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {proj.liveDemo && (
                            <a
                              href={proj.liveDemo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition flex items-center gap-1"
                            >
                              <Globe className="w-3 h-3" />
                              Demo
                            </a>
                          )}
                          {proj.githubRepo && (
                            <a
                              href={proj.githubRepo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition flex items-center gap-1"
                            >
                              <GithubIcon className="w-3 h-3" />
                              Code
                            </a>
                          )}
                        </div>
                      </div>

                      {proj.description && (
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          {proj.description}
                        </p>
                      )}

                      {Array.isArray(proj.bullets) && proj.bullets.length > 0 && (
                        <ul className="list-disc list-inside text-xs space-y-1 pl-1" style={{ color: "var(--text-secondary)" }}>
                          {proj.bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      )}

                      {Array.isArray(proj.technologies) && proj.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {proj.technologies.map((tech, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold border"
                              style={{
                                background: "color-mix(in srgb, #8b5cf6 10%, var(--card-bg))",
                                borderColor: "color-mix(in srgb, #8b5cf6 25%, transparent)",
                                color: "var(--text-primary)",
                              }}
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-center py-8 border border-dashed rounded-xl p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <FolderGit2 className="w-6 h-6 mx-auto mb-2 opacity-40" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    No projects detected in the uploaded resume.
                  </p>
                </div>
              )}
            </section>

            {/* ── 5. WORK EXPERIENCE & INTERNSHIPS SECTION ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Work Experience & Internships
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Employment records & verified industry internships
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {experienceList.length} Records
                </span>
              </div>

              {experienceList.length > 0 ? (
                <div className="space-y-4">
                  {experienceList.map((exp, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border transition-colors space-y-2"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                            {exp.role || exp.title || "Role Title"}
                            {exp.type && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                {exp.type === "internship" ? "Internship" : "Work Experience"}
                              </span>
                            )}
                          </h3>
                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {exp.company || "Company Name"} {exp.location ? `• ${exp.location}` : ""}
                          </p>
                        </div>
                        {(exp.startDate || exp.endDate || exp.duration || exp.durationText) && (
                          <span className="text-xs font-medium opacity-75 shrink-0" style={{ color: "var(--text-muted)" }}>
                            {exp.startDate && exp.endDate
                              ? `${exp.startDate} – ${exp.isCurrent ? "Present" : exp.endDate}`
                              : (exp.duration || exp.durationText || "")}
                          </span>
                        )}
                      </div>

                      {Array.isArray(exp.responsibilities) && exp.responsibilities.length > 0 && (
                        <ul className="list-disc list-inside text-xs space-y-1 pt-1" style={{ color: "var(--text-secondary)" }}>
                          {exp.responsibilities.map((r, rIdx) => (
                            <li key={rIdx}>{r}</li>
                          ))}
                        </ul>
                      )}

                      {Array.isArray(exp.achievements) && exp.achievements.length > 0 && (
                        <div className="pt-1">
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                            Key Achievements:
                          </span>
                          <ul className="list-disc list-inside text-xs space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                            {exp.achievements.map((a, aIdx) => (
                              <li key={aIdx}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-center py-8 border border-dashed rounded-xl p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Briefcase className="w-6 h-6 mx-auto mb-2 opacity-40" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    No work experience or internship detected in the uploaded resume.
                  </p>
                </div>
              )}
            </section>

            {/* ── 6. EDUCATION SECTION ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Education
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Academic degrees, university, & board qualifications
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {educationList.length} Degrees
                </span>
              </div>

              {educationList.length > 0 ? (
                <div className="space-y-4">
                  {educationList.map((edu, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border transition-colors space-y-1.5"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {edu.degree || edu.degreeRaw || "Degree / Diploma"}
                        </h3>
                        {(edu.endYear || edu.year || edu.duration) && (
                          <span className="text-xs font-semibold opacity-75 shrink-0" style={{ color: "var(--text-muted)" }}>
                            {edu.startYear && edu.endYear ? `${edu.startYear} – ${edu.endYear}` : (edu.endYear || edu.year || edu.duration)}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                        {edu.institution || edu.university || "University / Institution"}
                      </p>

                      {edu.fieldOfStudy && (
                        <p className="text-xs text-muted-foreground">
                          Field: {edu.fieldOfStudy}
                        </p>
                      )}

                      {(edu.cgpa || edu.percentage || edu.grade) && (
                        <span className="inline-block mt-1 text-[11px] font-black px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                          Grade: {edu.cgpa ? `CGPA ${edu.cgpa}` : (edu.percentage ? `${edu.percentage}%` : edu.grade)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-center py-8 border border-dashed rounded-xl p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <GraduationCap className="w-6 h-6 mx-auto mb-2 opacity-40" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    No education records detected.
                  </p>
                </div>
              )}
            </section>

            {/* ── 7. CERTIFICATIONS SECTION ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Certifications & Courses
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Verified certifications with isolated skills
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {certificationsList.length} Certifications
                </span>
              </div>

              {certificationsList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {certificationsList.map((cert, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border transition-colors space-y-2"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                        borderColor: "var(--border)",
                      }}
                    >
                      <h3 className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                        {cert.name || cert.title || "Certification Name"}
                      </h3>
                      {cert.issuer && (
                        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          {cert.issuer}
                        </p>
                      )}
                      {(cert.issueDate || cert.year) && (
                        <p className="text-[10px] opacity-75" style={{ color: "var(--text-muted)" }}>
                          Issued: {cert.issueDate || cert.year}
                        </p>
                      )}
                      {Array.isArray(cert.skills) && cert.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {cert.skills.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded text-[10px] font-bold border"
                              style={{
                                background: "color-mix(in srgb, #f59e0b 10%, var(--card-bg))",
                                borderColor: "color-mix(in srgb, #f59e0b 25%, transparent)",
                                color: "var(--text-primary)",
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-center py-8 border border-dashed rounded-xl p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Award className="w-6 h-6 mx-auto mb-2 opacity-40" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    No certifications detected.
                  </p>
                </div>
              )}
            </section>

            {/* ── 8. ACHIEVEMENTS SECTION ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Extracted Resume Achievements
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Evidence-backed accomplishments from resume
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  {achievementsList.length} Achievements
                </span>
              </div>

              {achievementsList.length > 0 ? (
                <div className="space-y-2.5">
                  {achievementsList.map((ach, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 transition-colors"
                      style={{
                        background: "color-mix(in srgb, #f97316 4%, var(--card-bg))",
                        borderColor: "color-mix(in srgb, #f97316 20%, var(--border))",
                        color: "var(--text-primary)",
                      }}
                    >
                      <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      <span>{typeof ach === "string" ? ach : (ach.title || ach.description)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-center py-8 border border-dashed rounded-xl p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-40" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    No achievements detected.
                  </p>
                </div>
              )}
            </section>

            {/* ── 9. PUBLICATIONS & RESEARCH ── */}
            {(publicationsList.length > 0 || researchList.length > 0) && (
              <section
                className="rounded-2xl border p-6 transition-colors"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <BookMarked className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Publications & Research
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Academic papers, journal publications, & research projects
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[...publicationsList, ...researchList].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border text-xs space-y-1"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                        borderColor: "var(--border)",
                      }}
                    >
                      <h3 className="font-bold text-indigo-600 dark:text-indigo-400">
                        {typeof item === "string" ? item : (item.title || item.name)}
                      </h3>
                      {typeof item === "object" && item.journal && (
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{item.journal}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── 10. LEADERSHIP & VOLUNTEERING ── */}
            {(leadershipList.length > 0 || volunteeringList.length > 0) && (
              <section
                className="rounded-2xl border p-6 transition-colors"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Leadership & Volunteering
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Extra-curricular responsibilities & social initiative work
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {[...leadershipList, ...volunteeringList].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border text-xs"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                        borderColor: "var(--border)",
                      }}
                    >
                      <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {typeof item === "string" ? item : (item.role || item.title || item.organization)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── 11. LANGUAGES & INTERESTS ── */}
            {(languagesList.length > 0 || interestsList.length > 0) && (
              <section
                className="rounded-2xl border p-6 transition-colors"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400">
                    <Languages className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    Languages & Interests
                  </h2>
                </div>

                <div className="space-y-3">
                  {languagesList.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold block mb-1.5" style={{ color: "var(--text-muted)" }}>
                        Languages Spoken:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {languagesList.map((lang, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-lg text-xs font-semibold border"
                            style={{
                              background: "color-mix(in srgb, #ec4899 8%, var(--card-bg))",
                              borderColor: "color-mix(in srgb, #ec4899 20%, transparent)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {typeof lang === "string" ? lang : (lang.name || lang.language)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {interestsList.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold block mb-1.5" style={{ color: "var(--text-muted)" }}>
                        Interests:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {interestsList.map((interest, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-lg text-xs font-semibold border"
                            style={{
                              background: "color-mix(in srgb, var(--text-primary) 4%, var(--card-bg))",
                              borderColor: "var(--border)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {typeof interest === "string" ? interest : interest.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── 12. CODING PROFILES & RESUME LINKS ── */}
            {(codingProfilesList.length > 0 || linksList.length > 0) && (
              <section
                className="rounded-2xl border p-6 transition-colors"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    Coding Profiles & Extracted Links
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[...codingProfilesList, ...linksList].map((item, idx) => {
                    const url = typeof item === "string" ? item : (item.url || item.link);
                    const label = typeof item === "object" ? (item.platform || item.name || url) : url;
                    return (
                      <a
                        key={idx}
                        href={url.startsWith("http") ? url : `https://${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold hover:border-teal-500 transition"
                        style={{
                          background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <span className="truncate">{label}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-teal-500" />
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

          </div>

          {/* ── RIGHT COLUMN (1 of 3 width on desktop) ── */}
          <div className="space-y-6">

            {/* ── 13. RESUME FILE CARD ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    Resume File
                  </h2>
                </div>
                {profile.atsScore != null && (
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {profile.atsScore} ATS Score
                  </span>
                )}
              </div>

              {profile.resumeFileName ? (
                <div className="space-y-4">
                  <div
                    className="p-4 rounded-xl border flex items-start gap-3 transition-colors"
                    style={{
                      background: "color-mix(in srgb, var(--text-primary) 3%, var(--card-bg))",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate" title={profile.resumeFileName} style={{ color: "var(--text-primary)" }}>
                        {profile.resumeFileName}
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Resume analyzed successfully
                      </p>
                      {profile.resumeUploadedAt && (
                        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                          Uploaded {new Date(profile.resumeUploadedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div
                      className="p-2.5 rounded-xl border transition-colors"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                        borderColor: "var(--border)",
                      }}
                    >
                      <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 block">{totalSkillsCount}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Skills Detected</span>
                    </div>
                    <div
                      className="p-2.5 rounded-xl border transition-colors"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                        borderColor: "var(--border)",
                      }}
                    >
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 block">
                        {projectsList.length}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Projects Detected</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleViewResume}
                        className="w-full py-2 px-3 rounded-xl border text-xs font-bold hover:opacity-80 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--card-bg)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadResume}
                        className="w-full py-2 px-3 rounded-xl border text-xs font-bold hover:opacity-80 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--card-bg)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Download</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isUploadingResume || saving}
                      onClick={() => !isUploadingResume && resumeInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-xl border border-dashed hover:border-blue-500 text-xs font-semibold hover:text-blue-500 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {isUploadingResume ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                          <span>Analyzing Resume...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Replace Resume File</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-center py-8 border border-dashed rounded-xl p-4 space-y-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                    {isUploadingResume ? (
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                      {isUploadingResume ? "Uploading & Analyzing..." : "No Resume Uploaded"}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {isUploadingResume
                        ? "Extracting skills, projects, and calculating ATS score."
                        : "Upload your PDF or DOCX resume to generate your profile intelligence."}
                    </p>
                  </div>
                  <Button
                    onClick={() => !isUploadingResume && resumeInputRef.current?.click()}
                    loading={isUploadingResume || saving}
                    disabled={isUploadingResume || saving}
                    className="w-full py-2 text-xs"
                  >
                    {isUploadingResume ? "Processing..." : "Upload Resume File"}
                  </Button>
                </div>
              )}
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleResumeUpload}
              />
            </section>

            {/* ── 14. ATS & DOMAIN INTELLIGENCE ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    ATS & Domain Intelligence
                  </h2>
                </div>
              </div>

              {(profile.primaryDomain || profile.resumeAnalysis?.primaryDomain) && (
                <div className="mb-4 p-3 rounded-xl border bg-purple-500/5 border-purple-500/20 space-y-1">
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    Primary Domain:
                  </span>
                  <p className="text-xs font-black text-purple-700 dark:text-purple-300">
                    {profile.primaryDomain || profile.resumeAnalysis?.primaryDomain}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div
                  className="p-4 rounded-xl border space-y-2"
                  style={{
                    background: "color-mix(in srgb, #10b981 6%, var(--card-bg))",
                    borderColor: "color-mix(in srgb, #10b981 25%, var(--border))",
                  }}
                >
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Strong Skills (Evidence-Based)
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(profile.strongSkills || profile.resumeAnalysis?.strongSkills || []).length > 0 ? (
                      (profile.strongSkills || profile.resumeAnalysis?.strongSkills || []).slice(0, 5).map((item) => {
                        const sName = typeof item === "object" ? item.name : item;
                        return (
                          <span
                            key={sName}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold border"
                            style={{
                              background: "color-mix(in srgb, #10b981 12%, var(--card-bg))",
                              borderColor: "color-mix(in srgb, #10b981 30%, transparent)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {sName}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                        Upload resume to detect strong project-backed skills
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl border space-y-2"
                  style={{
                    background: "color-mix(in srgb, #f59e0b 6%, var(--card-bg))",
                    borderColor: "color-mix(in srgb, #f59e0b 25%, var(--border))",
                  }}
                >
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Skills to Improve
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(profile.skillsToImprove || profile.resumeAnalysis?.skillsToImprove || []).length > 0 ? (
                      (profile.skillsToImprove || profile.resumeAnalysis?.skillsToImprove || []).slice(0, 5).map((item) => {
                        const sName = typeof item === "object" ? item.name : item;
                        return (
                          <span
                            key={sName}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold border"
                            style={{
                              background: "color-mix(in srgb, #f59e0b 12%, var(--card-bg))",
                              borderColor: "color-mix(in srgb, #f59e0b 30%, transparent)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {sName}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[11px] italic text-emerald-600 dark:text-emerald-400">
                        No critical skill gaps identified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ── PROFESSIONAL PROFILES ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Professional Profiles
                </h2>
                <button
                  type="button"
                  onClick={() => openEditModal("links")}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Edit Links
                </button>
              </div>

              <div className="space-y-3">
                <div
                  className="p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="p-2 rounded-lg shrink-0"
                      style={{
                        background: "color-mix(in srgb, var(--text-primary) 8%, var(--card-bg))",
                        color: "var(--text-primary)",
                      }}
                    >
                      <GithubIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>GitHub</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                        {profile.github || "Not connected"}
                      </p>
                    </div>
                  </div>
                  {profile.github ? (
                    <a
                      href={profile.github.startsWith("http") ? profile.github : `https://${profile.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition"
                      title="Open GitHub"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>

                <div
                  className="p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      <LinkedinIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>LinkedIn</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                        {profile.linkedin || "Not connected"}
                      </p>
                    </div>
                  </div>
                  {profile.linkedin ? (
                    <a
                      href={profile.linkedin.startsWith("http") ? profile.linkedin : `https://${profile.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition"
                      title="Open LinkedIn"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>

                <div
                  className="p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Portfolio</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                        {profile.portfolio || "Not connected"}
                      </p>
                    </div>
                  </div>
                  {profile.portfolio ? (
                    <a
                      href={profile.portfolio.startsWith("http") ? profile.portfolio : `https://${profile.portfolio}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition"
                      title="Open Portfolio"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* ── CAREER PREFERENCES ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Career Preferences
                </h2>
                <button
                  type="button"
                  onClick={() => openEditModal("career")}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Edit
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <div
                  className="p-3 rounded-xl border transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                    Preferred Role
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                    <span>{profile.preferredRole || "Software Developer"}</span>
                  </div>
                </div>

                <div
                  className="p-3 rounded-xl border transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                    Target Company
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    <Building className="w-3.5 h-3.5 text-purple-500" />
                    <span>{profile.preferredCompany || "Product Companies"}</span>
                  </div>
                </div>

                <div
                  className="p-3 rounded-xl border transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                    Preferred Location
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{profile.preferredLocation || "Pune / Remote"}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── INTERVIEW ACTIVITY METRICS ── */}
            <section
              className="rounded-2xl border p-6 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Interview Activity
                </h2>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div
                  className="p-3 rounded-xl border text-center transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-base font-black text-blue-600 dark:text-blue-400 block">
                    {profile.attemptUsed || profile.attemptsUsed || 0}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Interviews Completed</span>
                </div>

                <div
                  className="p-3 rounded-xl border text-center transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block">
                    {readinessScore != null ? `${readinessScore}%` : "N/A"}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Readiness Score</span>
                </div>

                <div
                  className="p-3 rounded-xl border text-center transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-base font-black text-purple-600 dark:text-purple-400 block">
                    {totalSkillsCount}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Skills Extracted</span>
                </div>

                <div
                  className="p-3 rounded-xl border text-center transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                    borderColor: "var(--border)",
                  }}
                >
                  <span className="text-base font-black text-orange-600 dark:text-orange-400 block">
                    {currentStreak} Days
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Active Streak</span>
                </div>
              </div>
            </section>

          </div>
        </div>

      </div>

      {/* ── RESUME UPLOAD & ANALYSIS MODAL OVERLAY ── */}
      {isUploadingResume && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-3xl border p-6 sm:p-8 space-y-6 text-center shadow-2xl relative overflow-hidden"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {/* Top decorative glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full" />

            {/* Header / Badge */}
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                AI Resume Intelligence
              </span>
            </div>

            {/* Animated Document Icon with Radar Glow */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-blue-500/20 animate-ping opacity-40" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 opacity-20 blur-md" />
              <div
                className="relative w-16 h-16 rounded-2xl border flex items-center justify-center shadow-lg"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <FileText className="w-8 h-8 text-blue-500 animate-bounce" style={{ animationDuration: "2s" }} />
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Analyzing Your Resume
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Extracting technical domain intelligence, verified projects, and updating your profile data.
              </p>
            </div>

            {/* Step Progress Checklist */}
            <div
              className="p-4 rounded-2xl border space-y-3 text-left"
              style={{
                background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
                borderColor: "var(--border)",
              }}
            >
              {[
                { stage: 1, label: "Uploading file & validating document" },
                { stage: 2, label: "Extracting text & section hierarchy" },
                { stage: 3, label: "Detecting confirmed projects & skills" },
                { stage: 4, label: "Computing ATS score & syncing profile" },
              ].map((step) => {
                const isDone = uploadStage > step.stage;
                const isCurrent = uploadStage === step.stage;

                return (
                  <div
                    key={step.stage}
                    className={`flex items-center gap-3 text-xs transition-all duration-300 ${
                      isCurrent
                        ? "font-bold text-blue-500 dark:text-blue-400"
                        : isDone
                        ? "font-medium text-emerald-600 dark:text-emerald-400"
                        : "font-normal text-slate-400 dark:text-slate-500 opacity-60"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-400 dark:border-slate-600 shrink-0" />
                    )}
                    <span className="flex-1">{step.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Footer reassurance note */}
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Please wait while we process your resume. Do not refresh or navigate away from this page.
            </p>
          </div>
        </div>
      )}

      <EditProfileModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profile}
        onSave={handleSaveModal}
        initialTab={editModalTab}
      />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
      <div className="rounded-3xl border p-8 space-y-4 animate-pulse" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-slate-300 dark:bg-slate-700" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-48 bg-slate-300 dark:bg-slate-700 rounded-lg" />
            <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border p-6 h-48 animate-pulse" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }} />
          <div className="rounded-2xl border p-6 h-64 animate-pulse" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }} />
          <div className="rounded-2xl border p-6 h-64 animate-pulse" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }} />
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border p-6 h-48 animate-pulse" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }} />
          <div className="rounded-2xl border p-6 h-64 animate-pulse" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }} />
        </div>
      </div>
    </div>
  );
}
