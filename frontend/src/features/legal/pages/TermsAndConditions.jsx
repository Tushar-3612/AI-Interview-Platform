import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  FileText,
  UserCheck,
  Brain,
  Lock,
  Mail,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

function TermsAndConditions() {
  const sections = [
    {
      icon: UserCheck,
      title: "Account Information",
      description:
        "Users must provide accurate and complete information during registration. Each account is intended for individual use only.",
    },
    {
      icon: FileText,
      title: "Interview Attempt",
      description:
        "Each registered student is allowed only one official interview attempt. Once submitted, it cannot be restarted or modified unless permitted by the administrator.",
    },
    {
      icon: ShieldCheck,
      title: "Resume Upload",
      description:
        "Only PDF resumes are accepted. Users are responsible for the accuracy of the information contained in their uploaded resumes.",
    },
    {
      icon: Lock,
      title: "Data Usage",
      description:
        "Your profile information, resume, and interview responses are used only for interview generation, evaluation, and academic purposes. Your information will not be shared with third parties without your permission.",
    },
    {
      icon: Brain,
      title: "AI-Based Evaluation",
      description:
        "Interview questions and evaluations are generated using AI assistance. The generated evaluation is intended only for learning and placement preparation purposes.",
    },
    {
      icon: AlertCircle,
      title: "User Responsibility",
      description:
        "Users are expected to answer interview questions honestly. Misuse of the platform may result in account suspension or permanent removal.",
    },
    {
      icon: ShieldCheck,
      title: "Privacy & Security",
      description:
        "Passwords are securely encrypted before storage. Personal information is stored securely using industry standard security practices.",
    },
    {
      icon: Mail,
      title: "Contact",
      description:
        "For any issues regarding your account or interview, please contact the Placement Cell or the System Administrator.",
    },
  ];

  return (
    <div
      className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{
        background: "var(--background)",
        color: "var(--text-primary)",
      }}
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-5 blur-3xl animate-pulse"
          style={{ background: "var(--primary)" }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-5 blur-3xl animate-pulse delay-1000"
          style={{ background: "var(--secondary)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto relative"
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
                Terms & Conditions
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
            className="mb-10 text-base leading-relaxed p-4 rounded-xl border-l-4"
            style={{
              color: "var(--text-secondary)",
              borderColor: "var(--primary)",
              background: "var(--background)",
            }}
          >
            Welcome to the <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>Interview Platform</strong>.
            By creating an account and using this platform, you agree to the following
            Terms & Conditions. Please read them carefully.
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
                  <div>
                    <h3 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                      {section.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {section.description}
                    </p>
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
              to="/signup"
              className="group flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 hover:gap-3"
              style={{
                color: "var(--primary)",
                background: "var(--primary-light)",
              }}
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Back to Signup
            </Link>

            <Link
              to="/privacy-policy"
              className="group flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 hover:gap-3"
              style={{
                color: "var(--primary)",
                background: "var(--primary-light)",
              }}
            >
              Privacy Policy
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          {/* Footer Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-6 text-xs text-center"
            style={{ color: "var(--text-secondary)" }}
          >
            By using this platform, you agree to our Terms & Conditions and Privacy Policy.
          </motion.p>
        </div>
      </motion.div>
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

export default TermsAndConditions;