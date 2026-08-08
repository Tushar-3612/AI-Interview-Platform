import { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Globe,
  GraduationCap,
  ClipboardList,
  Briefcase,
  Code2,
  BookOpen,
  Mic,
  BarChart3,
} from "lucide-react";

const TEAM = [
  {
    name: "Tushar Nagare",
    role: "Full Stack Lead",
    tag: "Lead Developer",
    initials: "TN",
    photo: "/images/team/profile.png",
  },
  {
    name: "Roshan Langhi",
    role: "Frontend Developer",
    tag: "UI/UX & React",
    initials: "RL",
    photo: "/images/team/roshan-langhi.jpg",
  },
  {
    name: "Amol Lende",
    role: "Backend & Systems",
    tag: "Node & MongoDB",
    initials: "AL",
    photo: "/images/team/amol-lende.jpg",
  },
];

const TECH_STACK = [
  "React.js",
  "Vite",
  "JavaScript",
  "Node.js",
  "Express.js",
  "MongoDB Atlas",
  "Google Gemini API",
  "JWT",
  "Multer",
  "REST APIs",
];

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Resume-Based Questions",
    text: "Upload your resume and practice questions based on your skills, projects and technologies.",
  },
  {
    icon: Briefcase,
    title: "Company Practice",
    text: "Practice company-specific placement assessments and interview questions.",
  },
  {
    icon: Code2,
    title: "Coding Practice",
    text: "Solve coding problems and track completed and remaining problems.",
  },
  {
    icon: BookOpen,
    title: "Aptitude Practice",
    text: "Practice Quantitative, Logical and Verbal aptitude with objective evaluation.",
  },
  {
    icon: Mic,
    title: "Voice & Text Answers",
    text: "Answer interview questions using typing or browser-based voice-to-text.",
  },
  {
    icon: BarChart3,
    title: "Performance Analysis",
    text: "View scores, strengths, weaknesses and areas that need improvement.",
  },
];

const STEPS = [
  { num: "01", label: "Profile" },
  { num: "02", label: "Resume" },
  { num: "03", label: "Practice" },
  { num: "04", label: "Interview" },
  { num: "05", label: "Results" },
];

function TeamPhoto({ member }) {
  const [imgError, setImgError] = useState(false);
  const showPhoto = member.photo && !imgError;

  return (
    <div
      className="w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] lg:w-[110px] lg:h-[110px] rounded-full overflow-hidden shrink-0 border-2 flex items-center justify-center mx-auto"
      style={{ borderColor: "#EF6905" }}
    >
      {showPhoto ? (
        <img
          src={member.photo}
          alt={member.name}
          className="w-full h-full object-cover object-center"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold text-lg"
          style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}
        >
          {member.initials}
        </div>
      )}
    </div>
  );
}

function About() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-14">

      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <h1
          className="text-3xl sm:text-4xl font-black tracking-tight mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          About <span style={{ color: "#EF6905" }}>PrepHire</span>
        </h1>
        <p
          className="text-sm font-semibold uppercase tracking-widest mb-4"
          style={{ color: "#FF9800" }}
        >
          AI-Powered Mock Interview Preparation Platform
        </p>
        <p
          className="max-w-xl mx-auto text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          A placement-focused platform designed to help students prepare
          through personalized interviews, aptitude, coding and performance
          analysis.
        </p>
      </motion.div>

      {/* ── What You Can Do ── */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <h2
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            What You Can Do
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                className="p-5 rounded-2xl border transition-all duration-300 hover:border-[#EF6905]/25"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: "rgba(239, 105, 5, 0.08)" }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: "#EF6905" }} />
                </div>
                <h3
                  className="font-bold text-sm mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {card.title}
                </h3>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {card.text}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8"
        >
          <h2
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            How It Works
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-0"
        >
          {STEPS.map((step, i) => (
            <div key={step.num} className="flex items-center">
              <div className="flex flex-col items-center text-center px-4 sm:px-6">
                <div
                  className="text-lg font-black mb-1"
                  style={{ color: "#EF6905", opacity: 0.4 }}
                >
                  {step.num}
                </div>
                <div
                  className="text-xs font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {step.label}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="hidden sm:block w-8 h-px mx-1"
                  style={{ background: "#EF6905", opacity: 0.25 }}
                />
              )}
              {i < STEPS.length - 1 && (
                <div
                  className="sm:hidden w-px h-6"
                  style={{ background: "#EF6905", opacity: 0.25 }}
                />
              )}
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Built With ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Built With
        </h2>
        <div className="flex flex-wrap justify-center gap-2.5">
          {TECH_STACK.map((tech) => (
            <span
              key={tech}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 hover:border-[#EF6905]/30 cursor-default"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </motion.section>

      {/* ── Development Team ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Development Team
        </h2>
        <p
          className="text-sm text-center mb-8"
          style={{ color: "var(--text-secondary)" }}
        >
          The people behind PrepHire
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {TEAM.map((member) => (
            <div
              key={member.name}
              className="py-7 px-5 rounded-2xl border flex flex-col items-center text-center transition-all duration-300 hover:border-[#EF6905]/30 group"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="transition-transform duration-300 group-hover:scale-[1.02] mb-4">
                <TeamPhoto member={member} />
              </div>
              <p
                className="font-bold text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                {member.name}
              </p>
              <p
                className="text-xs font-semibold mt-1"
                style={{ color: "#EF6905" }}
              >
                {member.role}
              </p>
              <span
                className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-md mt-2"
                style={{
                  background: "var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                {member.tag}
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── Sanjivani ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center py-10 rounded-2xl border"
        style={{
          background: "var(--card-bg)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(239, 105, 5, 0.08)" }}
        >
          <Building2 className="w-6 h-6" style={{ color: "#EF6905" }} />
        </div>
        <h2
          className="text-lg font-bold mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Built for Sanjivani College of Engineering
        </h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Sanjivani College of Engineering, Kopargaon
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <GraduationCap className="w-3.5 h-3.5" style={{ color: "#FF9800" }} />
          <span className="text-[11px] font-semibold" style={{ color: "#FF9800" }}>
            Final Year Project
          </span>
        </div>
      </motion.section>

      {/* ── Footer Meta ── */}
      <div
        className="flex items-center justify-between text-xs px-2 pb-4"
        style={{ color: "var(--text-muted)" }}
      >
        <span>PrepHire v1.0.0</span>
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          <span>Built for Students</span>
        </div>
      </div>
    </div>
  );
}

export default About;
