import { useState, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  User,
  Mail,
  Phone,
  Building2,
  GraduationCap,
  Link as LinkIcon,
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Plus,
  X,
  Camera,
  Award,
} from "lucide-react";
import InputField from "../../components/ui/InputField";
import Button from "../../components/ui/Button";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import useCachedApi from "../../hooks/useCachedApi";

const ProfileLink = ({ label, name, icon: Icon, profile, updateProfile }) => (
  <div className="student-card p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
        <div className="min-w-0">
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
          {profile[name] ? (
            <a
              href={profile[name].startsWith("http") ? profile[name] : `https://${profile[name]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium truncate block hover:underline"
              style={{ color: "var(--primary)" }}
            >
              {profile[name]}
            </a>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Not Added</p>
          )}
        </div>
      </div>
      {!profile[name] && (
        <button
          type="button"
          onClick={() => {
            const val = prompt(`Enter ${label}:`);
            if (val) updateProfile({ [name]: val });
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
          style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
        >
          Add
        </button>
      )}
    </div>
  </div>
);

/**
 * Candidate Profile — comprehensive student profile management.
 */
function Profile() {
  const { profile, updateProfile, saveProfile, addSkill, removeSkill, completionPercent } =
    useOutletContext();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const [skillInput, setSkillInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: placementData } = useCachedApi({
    url: "/api/placement/overview",
    key: "placement:overview",
    ttlMs: 60 * 1000,
  });

  const achievements = placementData?.achievements;
  const unlockedCount = achievements?.unlocked?.length || 0;
  const totalCount = unlockedCount + (achievements?.locked?.length || 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile();
      toast.success("Profile saved successfully");
    } catch {
      toast.error("Failed to sync profile changes to database");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    updateProfile({ [e.target.name]: e.target.value });
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateProfile({ profilePicture: reader.result });
    reader.readAsDataURL(file);
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("resume", file);

    setSaving(true);
    const toastId = toast.loading("Uploading and analyzing resume with Gemini AI...");
    try {
      const token = getAuthToken();
      const { data } = await api.post("/api/student/resume/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      updateProfile({
        resumeFileName: data.resumeFileName,
        resumeUploadedAt: data.resumeUploadedAt,
        atsScore: data.atsScore,
        skills: data.skills,
      });
      toast.success("Resume analyzed and profile skills updated!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to analyze resume", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Candidate Profile
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Profile Completion:{" "}
          <span className="font-semibold" style={{ color: "var(--primary)" }}>
            {completionPercent}%
          </span>
        </p>

        {/* Profile Picture */}
        <section className="student-card p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
            Profile Picture
          </h2>
          <div className="flex items-center gap-5">
            <div className="relative">
              {profile.profilePicture ? (
                <img
                  src={profile.profilePicture}
                  alt="Profile"
                  className="w-20 h-20 rounded-2xl object-cover border"
                  style={{ borderColor: "var(--border)" }}
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                  style={{ background: "var(--primary)" }}
                >
                  {profile.name?.[0]?.toUpperCase() || "S"}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <Camera className="w-3.5 h-3.5" />
                Upload
              </button>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Change
              </button>
              {profile.profilePicture && (
                <button
                  type="button"
                  onClick={() => updateProfile({ profilePicture: null })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                  style={{ color: "var(--error)" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>
        </section>

        {/* Personal Information */}
        <section className="student-card p-6 mb-6 space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
            Personal Information
          </h2>
          <InputField label="Full Name" name="name" value={profile.name || ""} onChange={handleChange} icon={User} />
          <InputField label="Email" name="email" type="email" value={profile.email || ""} onChange={handleChange} icon={Mail} />
          <InputField label="Phone Number" name="phone" value={profile.phone || ""} onChange={handleChange} icon={Phone} />
          <InputField label="Department" name="department" value={profile.department || ""} onChange={handleChange} icon={Building2} />
          <InputField label="Academic Year" name="year" value={profile.year || ""} onChange={handleChange} icon={GraduationCap} />
        </section>

        {/* Professional Profiles */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 px-1" style={{ color: "var(--text-muted)" }}>
            Professional Profiles
          </h2>
          <div className="space-y-3">
            <ProfileLink label="Portfolio Website" name="portfolio" icon={LinkIcon} profile={profile} updateProfile={updateProfile} />
            <ProfileLink label="GitHub Profile" name="github" icon={LinkIcon} profile={profile} updateProfile={updateProfile} />
            <ProfileLink label="LinkedIn Profile" name="linkedin" icon={LinkIcon} profile={profile} updateProfile={updateProfile} />
          </div>
        </section>

        {/* Resume */}
        <section className="student-card p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
            Resume
          </h2>
          <div
            className="flex items-center gap-3 p-4 rounded-xl border mb-4"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}
          >
            <FileText className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <span className="text-sm flex-1" style={{ color: "var(--text-secondary)" }}>
              {profile.resumeFileName || "No resume uploaded yet"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => resumeInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Resume
            </button>
            <button
              type="button"
              onClick={() => resumeInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <Upload className="w-3.5 h-3.5" />
              Replace Resume
            </button>
            <button
              type="button"
              onClick={() => toast("Download available after backend integration")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <Download className="w-3.5 h-3.5" />
              Download Resume
            </button>
            <button
              type="button"
              onClick={() => toast("View available after backend integration")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <Eye className="w-3.5 h-3.5" />
              View Resume
            </button>
            <input ref={resumeInputRef} type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
          </div>
        </section>

        {/* Career Preferences */}
        <section className="student-card p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
            Career Preferences <span className="font-normal normal-case">(Optional)</span>
          </h2>
          <InputField label="Preferred Role" name="preferredRole" value={profile.preferredRole || ""} onChange={handleChange} />
          <InputField label="Preferred Company" name="preferredCompany" value={profile.preferredCompany || ""} onChange={handleChange} />
          <InputField label="Preferred Location" name="preferredLocation" value={profile.preferredLocation || ""} onChange={handleChange} />
        </section>

        {/* Skills */}
        <section className="student-card p-6 mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
            Skills
          </h2>
          <div className="flex gap-2 mb-4">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill(skillInput);
                  setSkillInput("");
                }
              }}
              placeholder="Add a skill..."
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
            />
            <button
              type="button"
              onClick={() => { addSkill(skillInput); setSkillInput(""); }}
              className="px-4 py-2.5 rounded-xl cursor-pointer"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(profile.skills || []).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                {skill}
                <button type="button" onClick={() => removeSkill(skill)} className="cursor-pointer hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Achievements */}
        {totalCount > 0 && (
          <section className="student-card p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Achievements
              </h2>
              <button
                type="button"
                onClick={() => navigate("/placement/achievements")}
                className="text-xs font-bold cursor-pointer hover:underline"
                style={{ color: "#EF6905" }}
              >
                View All
              </button>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-14 h-14 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="16" fill="none"
                    stroke="#EF6905"
                    strokeWidth="3"
                    strokeDasharray={`${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black" style={{ color: "#EF6905" }}>
                    {unlockedCount}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {unlockedCount} of {totalCount} unlocked
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Complete more practice to unlock badges.
                </p>
              </div>
            </div>
            {achievements?.unlocked?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {achievements.unlocked.slice(0, 5).map((a) => (
                  <div
                    key={a.key}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0"
                    style={{
                      borderColor: "rgba(239, 105, 5, 0.2)",
                      background: "rgba(239, 105, 5, 0.04)",
                    }}
                  >
                    <span className="text-base">{a.icon}</span>
                    <span className="text-[10px] font-bold" style={{ color: "var(--text-primary)" }}>
                      {a.title}
                    </span>
                  </div>
                ))}
                {achievements.unlocked.length > 5 && (
                  <div
                    className="flex items-center px-3 py-2 rounded-xl border shrink-0"
                    style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
                  >
                    <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                      +{achievements.unlocked.length - 5} more
                    </span>
                  </div>
                )}
              </div>
            )}
            {unlockedCount === 0 && (
              <div
                className="text-center py-3 rounded-xl border"
                style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}
              >
                <Award className="w-5 h-5 mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                <p className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                  Complete practice attempts to unlock achievements.
                </p>
              </div>
            )}
          </section>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSave} loading={saving}>
            Save Changes
          </Button>
          <Button variant="outline" onClick={handleSave} loading={saving}>
            Update Profile
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default Profile;
