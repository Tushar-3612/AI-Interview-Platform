import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UserCheck,
  Mail,
  Phone,
  Link as LinkIcon,
  FileText,
  User,
} from "lucide-react";

import InputField from "../ui/InputField";
import Button from "../ui/Button";

function StartInterviewModal({
  open,
  onClose,
  profile = {},
  onFillProfile,
  onSubmit,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    portfolio: "",
    github: "",
    linkedin: "",
    resumeFileName: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: profile?.name || "",
        email: profile?.email || "",
        phone: profile?.phone || "",
        portfolio: profile?.portfolio || "",
        github: profile?.github || "",
        linkedin: profile?.linkedin || "",
        resumeFileName: profile?.resumeFileName || "",
      });
    }
  }, [open, profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResumeUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm((prev) => ({
        ...prev,
        resumeFileName: file.name,
      }));
    }
  };

  const handleFillProfile = () => {
    onFillProfile?.();

    setForm({
      name: profile?.name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      portfolio: profile?.portfolio || "",
      github: profile?.github || "",
      linkedin: profile?.linkedin || "",
      resumeFileName: profile?.resumeFileName || "",
    });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[32px] p-6 sm:p-8 glass-card"
        >
          <div className="flex items-center justify-between mb-6">
            <h2
              className="text-xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Start Interview
            </h2>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:opacity-70"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleFillProfile}
            className="mb-6"
          >
            <UserCheck className="w-4 h-4" />
            Fill Using Profile
          </Button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit?.(form);
            }}
          >
            <InputField
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              icon={User}
              required
            />

            <InputField
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              icon={Mail}
              required
            />

            <InputField
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              icon={Phone}
            />

            <InputField
              label="Portfolio Website"
              name="portfolio"
              value={form.portfolio}
              onChange={handleChange}
              icon={LinkIcon}
            />

            <InputField
              label="GitHub Profile"
              name="github"
              value={form.github}
              onChange={handleChange}
              icon={LinkIcon}
            />

            <InputField
              label="LinkedIn Profile"
              name="linkedin"
              value={form.linkedin}
              onChange={handleChange}
              icon={LinkIcon}
            />

            <div className="mb-6">
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Resume
              </label>

              <div
                className="flex items-center gap-3 p-4 rounded-xl border"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--input-bg)",
                }}
              >
                <FileText
                  className="w-5 h-5"
                  style={{ color: "var(--primary)" }}
                />

                <span
                  className="flex-1 truncate text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {form.resumeFileName || "No resume selected"}
                </span>

                <label
                  className="cursor-pointer text-sm font-medium"
                  style={{ color: "var(--primary)" }}
                >
                  Upload

                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleResumeUpload}
                  />
                </label>
              </div>
            </div>

            <Button type="submit">
              Proceed to Interview
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default StartInterviewModal;