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
} from "lucide-react";
import Button from "../../components/ui/Button";
import { GithubIcon, LinkedinIcon } from "../../components/ui/BrandIcons";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import useCachedApi from "../../hooks/useCachedApi";
import EditProfileModal from "../../components/student/EditProfileModal";

export default function Profile() {
  const {
    profile,
    updateProfile,
    saveProfile,
    addSkill,
    removeSkill,
    completionPercent,
  } = useOutletContext();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const [skillInput, setSkillInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalTab, setEditModalTab] = useState("personal");

  // Placement overview data for achievements & interview activity
  const { data: placementData } = useCachedApi({
    url: "/api/placement/overview",
    key: "placement:overview",
    ttlMs: 60 * 1000,
  });

  const achievements = placementData?.achievements;
  const unlockedCount = achievements?.unlocked?.length || 0;
  const totalCount = unlockedCount + (achievements?.locked?.length || 0);

  const readinessScore = placementData?.readiness?.overallScore ?? profile?.atsScore ?? 78;
  const currentStreak = placementData?.streaks?.currentStreak ?? 1;

  // Open edit modal directly to specific tab
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
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      toast.error("Please select a valid PDF resume file");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    setSaving(true);
    const toastId = toast.loading("Analyzing resume with Gemini AI...");
    try {
      const token = getAuthToken();
      const { data } = await api.post("/api/student/resume/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      const updates = {
        resumeFileName: data.resumeFileName,
        resumeUploadedAt: data.resumeUploadedAt,
        atsScore: data.atsScore,
        skills: data.all_skills || data.skills || [],
        categorizedSkills: data.categorizedSkills || {},
        projects: data.projects || [],
        experience: data.experience || [],
        education: data.education || [],
      };

      updateProfile(updates);
      toast.success("Resume analyzed and skills extracted successfully!", { id: toastId });
    } catch (err) {
      console.error("Resume upload error:", err);
      toast.error(err.response?.data?.message || "Failed to analyze resume", { id: toastId });
    } finally {
      setSaving(false);
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

  // Missing profile items for actionable chips
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

  // Skill category definition
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

  return (
    <div className="min-h-screen pb-16" style={{ background: "var(--bg-primary, #090d16)" }}>
      {/* ── Outer Max-Width Container ───────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

        {/* ── 1. PROFILE HEADER CARD ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border p-6 sm:p-8 shadow-sm relative overflow-hidden"
          style={{
            background: "var(--card-bg, #0f172a)",
            borderColor: "var(--border, rgba(255,255,255,0.08))",
          }}
        >
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            {/* Left: Avatar & Bio */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
              {/* Avatar with upload trigger */}
              <div className="relative group shrink-0">
                {profile.profilePicture ? (
                  <img
                    src={profile.profilePicture}
                    alt={profile.name || "Candidate Avatar"}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 shadow-md"
                    style={{ borderColor: "var(--border, rgba(255,255,255,0.15))" }}
                  />
                ) : (
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-3xl font-extrabold text-white shadow-md border-2 border-white/10"
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
                  className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5 cursor-pointer backdrop-blur-[2px]"
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

              {/* Name & Details */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                    {profile.name || "Candidate Profile"}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Sparkles className="w-3 h-3" />
                    Verified Student
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-300">
                  {profile.headline ||
                    `${profile.department || "Computer Engineering"} Student | ${
                      profile.preferredRole || "Full Stack Developer"
                    } | AI Enthusiast`}
                </p>

                <div className="flex items-center gap-3 text-xs flex-wrap pt-1" style={{ color: "var(--text-muted)" }}>
                  {profile.department && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {profile.department}
                    </span>
                  )}
                  {profile.year && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                      {profile.year}
                    </span>
                  )}
                  {profile.preferredLocation && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {profile.preferredLocation}
                    </span>
                  )}
                </div>

                {/* Compact Social Links Row */}
                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  {profile.github ? (
                    <a
                      href={profile.github.startsWith("http") ? profile.github : `https://${profile.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border bg-slate-900/60 hover:bg-slate-800 transition text-slate-200"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <GithubIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>GitHub</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/40 transition cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border bg-slate-900/60 hover:bg-slate-800 transition text-blue-300"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <LinkedinIcon className="w-3.5 h-3.5 text-blue-400" />
                      <span>LinkedIn</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/40 transition cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border bg-slate-900/60 hover:bg-slate-800 transition text-emerald-300"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Portfolio</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/40 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Portfolio</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Primary Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Button
                variant="outline"
                onClick={() => openEditModal("personal")}
                className="px-4 py-2 text-xs font-bold"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5 inline" />
                Edit Profile
              </Button>

              <Button
                onClick={() => resumeInputRef.current?.click()}
                className="px-4 py-2 text-xs font-bold"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5 inline" />
                {profile.resumeFileName ? "Replace Resume" : "Upload Resume"}
              </Button>

              <button
                type="button"
                onClick={handleShareProfile}
                title="Share Profile"
                className="p-2.5 rounded-xl border hover:bg-white/10 transition cursor-pointer text-slate-300"
                style={{ borderColor: "var(--border)" }}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── 2. PROFILE COMPLETION (PROFILE STRENGTH) ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border p-5 shadow-sm"
          style={{
            background: "var(--card-bg, #0f172a)",
            borderColor: "var(--border, rgba(255,255,255,0.08))",
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    Profile Strength
                  </span>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {completionPercent}% Complete
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${completionPercent}%`,
                    background:
                      completionPercent >= 80
                        ? "linear-gradient(90deg, #3b82f6, #10b981)"
                        : "linear-gradient(90deg, #f59e0b, #3b82f6)",
                  }}
                />
              </div>

              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Complete your profile to improve your interview questions and AI-driven recommendations.
              </p>
            </div>

            {/* Actionable Missing Item Chips */}
            {missingItems.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1 md:pt-0">
                {missingItems.slice(0, 4).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (item.action === "resume") {
                        resumeInputRef.current?.click();
                      } else {
                        openEditModal(item.tab);
                      }
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/5 text-blue-300 hover:bg-blue-500/15 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── 3. MAIN GRID (2 COLUMNS) ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN (2 of 3 width on desktop) ─────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── PERSONAL INFORMATION CARD ── */}
            <section
              className="rounded-2xl border p-6 shadow-sm"
              style={{
                background: "var(--card-bg, #0f172a)",
                borderColor: "var(--border, rgba(255,255,255,0.08))",
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Personal Information
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Core candidate credentials and university contact details
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openEditModal("personal")}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border hover:bg-white/5 transition flex items-center gap-1.5 cursor-pointer text-slate-300"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              {/* 2-Column Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border bg-slate-900/40" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Full Name</span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <User className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="truncate">{profile.name || "Not specified"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-slate-900/40" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Email Address</span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{profile.email || "Not specified"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-slate-900/40" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Phone Number</span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">{profile.phone || "Not added"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-slate-900/40" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Department / Branch</span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="truncate">{profile.department || "Not specified"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-slate-900/40 sm:col-span-2" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Academic Year</span>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    <GraduationCap className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{profile.year || "Not specified"}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── TECHNICAL & PROFESSIONAL SKILLS (SKILL INTELLIGENCE) ── */}
            <section
              className="rounded-2xl border p-6 shadow-sm"
              style={{
                background: "var(--card-bg, #0f172a)",
                borderColor: "var(--border, rgba(255,255,255,0.08))",
              }}
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    <Zap className="w-4 h-4 text-amber-400" />
                    Technical & Professional Skills
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Automatically extracted from your resume & customizable
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {totalSkillsCount} Detected Skills
                </span>
              </div>

              {/* Quick Add Custom Skill Input */}
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
                    background: "var(--input-bg, rgba(255,255,255,0.03))",
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

              {/* Categorized Display Cards */}
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
                          className="p-4 rounded-xl border bg-slate-900/30"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3
                              className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                              style={{ color: cat.color }}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {cat.label}
                            </h3>
                            <span className="text-[10px] font-semibold opacity-60 text-slate-400">
                              {skills.length} skills
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {skills.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition hover:scale-[1.02]"
                                style={{
                                  borderColor: `color-mix(in srgb, ${cat.color} 30%, transparent)`,
                                  background: `color-mix(in srgb, ${cat.color} 8%, transparent)`,
                                  color: "var(--text-primary)",
                                }}
                              >
                                {skill}
                                <button
                                  type="button"
                                  onClick={() => removeSkill(skill)}
                                  className="cursor-pointer text-slate-400 hover:text-red-400 transition"
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
                /* Flat skill chip fallback */
                <div className="flex flex-wrap gap-2">
                  {(profile.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-slate-900/40 text-slate-200"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="cursor-pointer text-slate-400 hover:text-red-400 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {totalSkillsCount === 0 && (
                    <div className="w-full text-center py-6 border border-dashed rounded-xl border-white/10">
                      <BookOpen className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                      <p className="text-xs font-medium text-slate-400">
                        No skills detected yet. Upload your resume above to automatically extract skills with Gemini AI.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── AI SKILL INSIGHTS ── */}
            <section
              className="rounded-2xl border p-6 shadow-sm"
              style={{
                background: "var(--card-bg, #0f172a)",
                borderColor: "var(--border, rgba(255,255,255,0.08))",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    AI Skill Insights
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  AI-Powered Assessment
                </span>
              </div>
              <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
                Based on your resume analysis, skill depth, and interview practice benchmarks.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Strong Skills */}
                <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Strong Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(profile.skills?.slice(0, 3) || ["React.js", "JavaScript", "SQL"]).map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Skills to Improve */}
                <div className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/20 space-y-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Skills to Improve
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["Data Structures", "Algorithms", "System Design"].map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Interview Readiness */}
                <div className="p-4 rounded-xl border bg-blue-500/5 border-blue-500/20 flex flex-col justify-between">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Interview Readiness
                  </span>
                  <div className="pt-2">
                    <span className="text-2xl font-black text-white">{readinessScore}%</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Overall candidate benchmark</p>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* ── RIGHT COLUMN (1 of 3 width on desktop) ────────────────────── */}
          <div className="space-y-6">

            {/* ── RESUME INTELLIGENCE CARD ── */}
            <section
              className="rounded-2xl border p-6 shadow-sm"
              style={{
                background: "var(--card-bg, #0f172a)",
                borderColor: "var(--border, rgba(255,255,255,0.08))",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    Resume
                  </h2>
                </div>
                {profile.atsScore != null && profile.atsScore > 0 && (
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {profile.atsScore} ATS Score
                  </span>
                )}
              </div>

              {profile.resumeFileName ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border bg-slate-900/60 flex items-start gap-3" style={{ borderColor: "var(--border)" }}>
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200 truncate" title={profile.resumeFileName}>
                        {profile.resumeFileName}
                      </p>
                      <p className="text-[11px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Resume analyzed successfully
                      </p>
                      {profile.resumeUploadedAt && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Uploaded {new Date(profile.resumeUploadedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Resume Stats */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2.5 rounded-xl border bg-slate-900/30" style={{ borderColor: "var(--border)" }}>
                      <span className="text-sm font-extrabold text-blue-400 block">{totalSkillsCount}</span>
                      <span className="text-[10px] text-slate-400">Skills Detected</span>
                    </div>
                    <div className="p-2.5 rounded-xl border bg-slate-900/30" style={{ borderColor: "var(--border)" }}>
                      <span className="text-sm font-extrabold text-emerald-400 block">
                        {profile.projects?.length || 3}
                      </span>
                      <span className="text-[10px] text-slate-400">Projects Detected</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleViewResume}
                        className="w-full py-2 px-3 rounded-xl border text-xs font-bold text-slate-200 hover:bg-white/5 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadResume}
                        className="w-full py-2 px-3 rounded-xl border text-xs font-bold text-slate-200 hover:bg-white/5 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Download</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => resumeInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Replace Resume PDF</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Empty Resume State */
                <div className="text-center py-8 border border-dashed rounded-xl border-white/10 p-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">No Resume Uploaded</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Upload your PDF resume to unlock personalized interviews & skill insights.
                    </p>
                  </div>
                  <Button
                    onClick={() => resumeInputRef.current?.click()}
                    loading={saving}
                    className="w-full py-2 text-xs"
                  >
                    Upload Resume PDF
                  </Button>
                </div>
              )}
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleResumeUpload}
              />
            </section>

            {/* ── PROFESSIONAL PROFILES ── */}
            <section
              className="rounded-2xl border p-6 shadow-sm"
              style={{
                background: "var(--card-bg, #0f172a)",
                borderColor: "var(--border, rgba(255,255,255,0.08))",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Professional Profiles
                </h2>
                <button
                  type="button"
                  onClick={() => openEditModal("links")}
                  className="text-xs font-bold text-blue-400 hover:underline cursor-pointer"
                >
                  Edit Links
                </button>
              </div>

              <div className="space-y-3">
                {/* GitHub */}
                <div className="p-3.5 rounded-xl border bg-slate-900/40 flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-800 text-slate-200 shrink-0">
                      <GithubIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200">GitHub</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {profile.github || "Not connected"}
                      </p>
                    </div>
                  </div>
                  {profile.github ? (
                    <a
                      href={profile.github.startsWith("http") ? profile.github : `https://${profile.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                      title="Open GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>

                {/* LinkedIn */}
                <div className="p-3.5 rounded-xl border bg-slate-900/40 flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                      <LinkedinIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200">LinkedIn</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {profile.linkedin || "Not connected"}
                      </p>
                    </div>
                  </div>
                  {profile.linkedin ? (
                    <a
                      href={profile.linkedin.startsWith("http") ? profile.linkedin : `https://${profile.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                      title="Open LinkedIn"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>

                {/* Portfolio */}
                <div className="p-3.5 rounded-xl border bg-slate-900/40 flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200">Portfolio</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {profile.portfolio || "Not connected"}
                      </p>
                    </div>
                  </div>
                  {profile.portfolio ? (
                    <a
                      href={profile.portfolio.startsWith("http") ? profile.portfolio : `https://${profile.portfolio}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                      title="Open Portfolio"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModal("links")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* ── CAREER PREFERENCES ── */}
            <section
              className="rounded-2xl border p-6 shadow-sm"
              style={{
                background: "var(--card-bg, #0f172a)",
                borderColor: "var(--border, rgba(255,255,255,0.08))",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Career Preferences
                </h2>
                <button
                  type="button"
                  onClick={() => openEditModal("career")}
                  className="text-xs font-bold text-blue-400 hover:underline cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Help us personalize your interview and job recommendations.
              </p>

              <div className="space-y-3">
                <div className="p-3 rounded-xl border bg-slate-900/40" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Preferred Role</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                    <span>{profile.preferredRole || "Software Engineer / Full Stack"}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-slate-900/40" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Target Company</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Building className="w-3.5 h-3.5 text-purple-400" />
                    <span>{profile.preferredCompany || "Top Tech / Product Companies"}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-slate-900/40" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Preferred Location</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{profile.preferredLocation || "Pune / Bengaluru / Remote"}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── ACHIEVEMENTS (COMPACT) ── */}
            {totalCount > 0 && (
              <section
                className="rounded-2xl border p-6 shadow-sm"
                style={{
                  background: "var(--card-bg, #0f172a)",
                  borderColor: "var(--border, rgba(255,255,255,0.08))",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      <Award className="w-4 h-4 text-amber-400" />
                      Achievements
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {unlockedCount} of {totalCount} badges unlocked
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/placement/achievements")}
                    className="text-xs font-bold text-blue-400 hover:underline cursor-pointer"
                  >
                    View All →
                  </button>
                </div>

                {achievements?.unlocked?.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {achievements.unlocked.slice(0, 4).map((a) => (
                      <div
                        key={a.key}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 bg-amber-500/5 border-amber-500/20"
                      >
                        <span className="text-base">{a.icon}</span>
                        <span className="text-[11px] font-bold text-slate-200">
                          {a.title}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 rounded-xl border border-dashed border-white/10">
                    <Award className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                    <p className="text-[11px] font-medium text-slate-400">
                      Complete mock interviews to unlock badges.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* ── INTERVIEW ACTIVITY METRICS ── */}
            <section
              className="rounded-2xl border p-6 shadow-sm"
              style={{
                background: "var(--card-bg, #0f172a)",
                borderColor: "var(--border, rgba(255,255,255,0.08))",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Interview Activity
                </h2>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border bg-slate-900/40 text-center" style={{ borderColor: "var(--border)" }}>
                  <span className="text-base font-black text-blue-400 block">
                    {profile.attemptsUsed || 1}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Interviews Completed</span>
                </div>

                <div className="p-3 rounded-xl border bg-slate-900/40 text-center" style={{ borderColor: "var(--border)" }}>
                  <span className="text-base font-black text-emerald-400 block">
                    {readinessScore}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Average Score</span>
                </div>

                <div className="p-3 rounded-xl border bg-slate-900/40 text-center" style={{ borderColor: "var(--border)" }}>
                  <span className="text-base font-black text-purple-400 block">
                    {totalSkillsCount * 3 + 12}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Questions Answered</span>
                </div>

                <div className="p-3 rounded-xl border bg-slate-900/40 text-center" style={{ borderColor: "var(--border)" }}>
                  <span className="text-base font-black text-orange-400 block">
                    {currentStreak} Days
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Active Streak</span>
                </div>
              </div>
            </section>

          </div>
        </div>

      </div>

      {/* ── EDIT PROFILE MODAL ────────────────────────────────────────────── */}
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
