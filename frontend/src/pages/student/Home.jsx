import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  FileText,
  Play,
  BarChart3,
  History,
  Upload,
  CheckCircle2,
  Clock,
  Circle,
} from "lucide-react";
import Button from "../../components/ui/Button";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const STATUS_CONFIG = {
  not_started: { label: "Not Started", icon: Circle, color: "var(--text-muted)" },
  in_progress: { label: "In Progress", icon: Clock, color: "var(--primary)" },
  completed: { label: "Completed", icon: CheckCircle2, color: "var(--success)" },
};

/**
 * Student Home Dashboard — minimal placement preparation hub.
 */
function Home() {
  const { profile, openInterviewModal } = useOutletContext();
  const navigate = useNavigate();
  const greeting = getGreeting();
  const status = STATUS_CONFIG[profile.interviewStatus] || STATUS_CONFIG.not_started;
  const StatusIcon = status.icon;
  const attemptsLeft = profile.maxAttempts - (profile.attemptsUsed || 0);

  const quickActions = [
    { label: "Resume", icon: FileText, path: "/profile", desc: "Manage resume" },
    { label: "Interview", icon: Play, path: null, desc: "Start mock interview" },
    { label: "Results", icon: BarChart3, path: "/results", desc: "View scores" },
    { label: "Interview History", icon: History, path: "/interview-history", desc: "Past sessions" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-2"
      >
        <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          {greeting}, {profile.name?.split(" ")[0] || "Student"}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Welcome back.
        </h1>
        <p className="text-base" style={{ color: "var(--text-secondary)" }}>
          Complete your placement preparation.
        </p>
      </motion.section>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Resume Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="student-card p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Resume Status
              </h3>
              <p className="text-lg font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
                {profile.resumeFileName ? "Resume Uploaded" : "No Resume Uploaded"}
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            >
              <FileText className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
          </div>
          {profile.resumeUploadedAt && (
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              Last upload: {new Date(profile.resumeUploadedAt).toLocaleDateString()}
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:opacity-80"
            style={{ color: "var(--primary)" }}
          >
            <Upload className="w-4 h-4" />
            Update Resume
          </button>
        </motion.div>

        {/* Interview Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="student-card p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Interview Status
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusIcon className="w-5 h-5" style={{ color: status.color }} />
                <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  {status.label}
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Attempts Remaining:{" "}
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {attemptsLeft} / {profile.maxAttempts}
            </span>
          </p>
        </motion.div>
      </div>

      {/* Start Interview CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Button
          onClick={() => {
            if (attemptsLeft <= 0) {
              toast.error("No attempts remaining");
              return;
            }
            openInterviewModal?.();
          }}
          className="py-4 text-base font-semibold"
        >
          START INTERVIEW
        </Button>
      </motion.div>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                whileHover={{ y: -2 }}
                onClick={() => {
                  if (action.label === "Interview") {
                    openInterviewModal?.();
                  } else {
                    navigate(action.path);
                  }
                }}
                className="student-card p-5 text-left cursor-pointer"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
                </div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                  {action.label}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {action.desc}
                </p>
              </motion.button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default Home;
