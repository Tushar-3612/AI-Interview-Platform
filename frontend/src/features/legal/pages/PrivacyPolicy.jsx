import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  User,
  Mail,
  FileText,
  Database,
  Lock,
  Share2,
  Users,
  Phone,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Eye,
  Server,
  Brain,
} from "lucide-react";

function PrivacyPolicy() {
  const sections = [
    {
      icon: User,
      title: "Information We Collect",
      items: [
        "Full Name",
        "College Email",
        "Department",
        "Academic Year",
        "Portfolio Link (Optional)",
        "Resume (PDF)",
        "Interview Responses",
      ],
    },
    {
      icon: Brain,
      title: "How We Use Your Information",
      items: [
        "Create your account",
        "Generate AI interview questions",
        "Evaluate interview responses",
        "Improve the platform experience",
      ],
    },
    {
      icon: FileText,
      title: "Resume & Interview Data",
      description:
        "Uploaded resumes and interview responses are used only for interview generation, AI evaluation, and academic purposes.",
    },
    {
      icon: Lock,
      title: "Data Security",
      description:
        "Passwords are encrypted using bcrypt before storage. All personal information is securely stored, and reasonable measures are taken to protect it from unauthorized access.",
    },
    {
      icon: Server,
      title: "Third-Party Services",
      description:
        "The platform may use trusted third-party services such as Google Gemini AI and MongoDB Atlas to provide interview generation and data storage functionality.",
    },
    {
      icon: Share2,
      title: "Data Sharing",
      description:
        "We do not sell or share your personal information with third parties except when required by law or with your explicit consent.",
    },
    {
      icon: Users,
      title: "User Rights",
      description:
        "Users may request correction or deletion of their account data by contacting the Placement Cell or the System Administrator.",
    },
    {
      icon: Phone,
      title: "Contact",
      description:
        "For any privacy-related concerns, please contact the Admin of this website",
    },
  ];

  return (
    <div
      className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex flex-col"
      style={{
        background: "var(--background)",
        color: "var(--text-primary)",
      }}
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -left-40 w-80 h-80 rounded-full opacity-5 blur-3xl animate-pulse"
          style={{ background: "var(--primary)" }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full opacity-5 blur-3xl animate-pulse delay-1000"
          style={{ background: "var(--secondary)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto relative flex-1"
      >
        <div
          className="rounded-3xl p-8 sm:p-10 border shadow-2xl backdrop-blur-sm transition-all hover:shadow-[0_20px_70px_-15px]"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          }}
        >
          {/* Header Section */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl sm:text-5xl font-extrabold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Privacy Policy
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm mt-2 flex items-center gap-2"
                style={{ color: "var(--text-secondary)" }}
              >
                <CheckCircle className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Effective Date: <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>2026</strong>
              </motion.p>
            </div>
            <div className="hidden sm:block p-3 rounded-2xl" style={{ background: "var(--primary-light)" }}>
              <ShieldCheck className="w-8 h-8" style={{ color: "var(--primary)" }} />
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-10 text-base leading-relaxed p-4 rounded-xl border-l-4 flex items-start gap-3"
            style={{
              color: "var(--text-secondary)",
              borderColor: "var(--primary)",
              background: "var(--background)",
            }}
          >
            <Eye className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
            <span>
              Your privacy is important to us. This Privacy Policy explains how the
              Interview Platform collects, stores, and protects your personal
              information.
            </span>
          </motion.p>

          {/* Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.map((section, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * (index + 1) }}
                className="group p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl shrink-0 transition-colors duration-300 group-hover:bg-opacity-20"
                    style={{ background: "var(--primary-light)" }}
                  >
                    <section.icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                      {section.title}
                    </h3>
                    {section.items ? (
                      <ul className="space-y-1">
                        {section.items.map((item, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
                            <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "var(--primary)" }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {section.description}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-10 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4"
            style={{ borderColor: "var(--border)" }}
          >
            <Link
              to="/terms-and-conditions"
              className="group flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 hover:gap-3"
              style={{
                color: "var(--primary)",
                background: "var(--primary-light)",
              }}
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Terms & Conditions
            </Link>

            <Link
              to="/signup"
              className="group flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 hover:gap-3"
              style={{
                color: "var(--primary)",
                background: "var(--primary-light)",
              }}
            >
              Back to Signup
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-10 text-center"
      >
        <div className="max-w-4xl mx-auto px-4">
          <div className="pt-6 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              © 2026 Interview Platform
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Developed for Placement Preparation
            </p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}

export default PrivacyPolicy;