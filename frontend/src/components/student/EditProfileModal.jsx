import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Phone,
  Building2,
  GraduationCap,
  Globe,
  Briefcase,
  Building,
  MapPin,
  Save,
} from "lucide-react";
import Button from "../ui/Button";
import { GithubIcon, LinkedinIcon } from "../ui/BrandIcons";

const WORK_TYPES = ["Full-time", "Internship", "Remote", "Hybrid", "Contract"];

export default function EditProfileModal({
  isOpen,
  onClose,
  profile = {},
  onSave,
  initialTab = "personal",
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    department: "",
    year: "",
    linkedin: "",
    github: "",
    portfolio: "",
    preferredRole: "",
    preferredCompany: "",
    preferredLocation: "",
    preferredWorkType: "Full-time",
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setFormData({
        name: profile.name || "",
        phone: profile.phone || "",
        department: profile.department || "",
        year: profile.year || "",
        linkedin: profile.linkedin || "",
        github: profile.github || "",
        portfolio: profile.portfolio || "",
        preferredRole: profile.preferredRole || "",
        preferredCompany: profile.preferredCompany || "",
        preferredLocation: profile.preferredLocation || "",
        preferredWorkType: profile.preferredWorkType || "Full-time",
      });
    }
  }, [isOpen, profile, initialTab]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error("Save profile error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: "personal", label: "Personal Info", icon: User },
    { id: "links", label: "Professional Links", icon: Globe },
    { id: "career", label: "Career Preferences", icon: Briefcase },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden z-10 my-8"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Edit Profile
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Keep your candidate profile up to date for personalized recommendations
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              style={{ color: "var(--text-primary)" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div
            className="flex border-b px-6 gap-2"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
            }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                    active
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    color: active ? undefined : "var(--text-secondary)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* TAB 1: PERSONAL INFO */}
              {activeTab === "personal" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" style={{ color: "var(--text-muted)" }} />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. Roshan Langhi"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--input-bg)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" style={{ color: "var(--text-muted)" }} />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--input-bg)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        Department / Branch
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" style={{ color: "var(--text-muted)" }} />
                        <input
                          type="text"
                          name="department"
                          value={formData.department}
                          onChange={handleChange}
                          placeholder="e.g. Computer Engineering"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--input-bg)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        Academic Year
                      </label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" style={{ color: "var(--text-muted)" }} />
                        <input
                          type="text"
                          name="year"
                          value={formData.year}
                          onChange={handleChange}
                          placeholder="e.g. Final Year / 4th Year"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--input-bg)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PROFESSIONAL LINKS */}
              {activeTab === "links" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      LinkedIn Profile URL
                    </label>
                    <div className="relative">
                      <LinkedinIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                      <input
                        type="text"
                        name="linkedin"
                        value={formData.linkedin}
                        onChange={handleChange}
                        placeholder="https://linkedin.com/in/yourprofile"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--input-bg)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      GitHub Profile URL
                    </label>
                    <div className="relative">
                      <GithubIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-70" style={{ color: "var(--text-primary)" }} />
                      <input
                        type="text"
                        name="github"
                        value={formData.github}
                        onChange={handleChange}
                        placeholder="https://github.com/yourusername"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--input-bg)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Personal Portfolio / Website
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                      <input
                        type="text"
                        name="portfolio"
                        value={formData.portfolio}
                        onChange={handleChange}
                        placeholder="https://yourportfolio.dev"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--input-bg)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CAREER PREFERENCES */}
              {activeTab === "career" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Preferred Job Role
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" style={{ color: "var(--text-muted)" }} />
                      <input
                        type="text"
                        name="preferredRole"
                        value={formData.preferredRole}
                        onChange={handleChange}
                        placeholder="e.g. Full Stack Developer, SDE-1, Data Analyst"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--input-bg)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        Target / Preferred Company
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" style={{ color: "var(--text-muted)" }} />
                        <input
                          type="text"
                          name="preferredCompany"
                          value={formData.preferredCompany}
                          onChange={handleChange}
                          placeholder="e.g. Google, TCS, Microsoft"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--input-bg)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        Preferred Location
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" style={{ color: "var(--text-muted)" }} />
                        <input
                          type="text"
                          name="preferredLocation"
                          value={formData.preferredLocation}
                          onChange={handleChange}
                          placeholder="e.g. Pune, Bengaluru, Remote"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--input-bg)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Work Arrangement / Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {WORK_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, preferredWorkType: type }))}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            formData.preferredWorkType === type
                              ? "bg-blue-600/15 border-blue-500/50 text-blue-600 dark:text-blue-400"
                              : "border-[var(--border)] hover:opacity-80"
                          }`}
                          style={{
                            background: formData.preferredWorkType === type ? undefined : "var(--card-bg)",
                            color: formData.preferredWorkType === type ? undefined : "var(--text-secondary)",
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div
              className="flex items-center justify-between px-6 py-4 border-t"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in srgb, var(--text-primary) 2%, var(--card-bg))",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 hover:opacity-100 transition cursor-pointer"
                style={{ color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <Button type="submit" loading={saving} className="px-5 py-2 text-xs">
                  <Save className="w-3.5 h-3.5 mr-1.5 inline" />
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
