import { motion } from "framer-motion";
import {
  Target,
  Eye,
  Layers,
  Code2,
  Users,
  Building2,
  Info,
  Sparkles,
  GraduationCap,
  ShieldCheck,
  Cpu,
  Globe,
} from "lucide-react";

const TEAM = [
  {
    name: "Tushar Nagare",
    role: "Full Stack Lead",
    tag: "Lead Developer",
    initials: "TN",
    color: "from-blue-500 to-indigo-600",
  },
  {
    name: "Roshan Langhi",
    role: "Frontend Developer",
    tag: "UI/UX & React",
    initials: "RL",
    color: "from-purple-500 to-pink-600",
  },
  {
    name: "Amol Lende",
    role: "Backend & Systems",
    tag: "Node & MongoDB",
    initials: "AL",
    color: "from-emerald-500 to-teal-600",
  },
];

const TECH_STACK = [
  "React",
  "Node.js",
  "Express.js",
  "MongoDB Atlas",
  "Tailwind CSS",
  "Framer Motion",
  "JWT Auth",
  "REST API",
];

const OVERVIEW_CARDS = [
  {
    icon: Target,
    title: "Our Mission",
    text: "Empower every student with structured interview preparation, resume-based mock interviews, and company-specific practice — making placement readiness accessible to all.",
    accent: "var(--primary)",
  },
  {
    icon: Eye,
    title: "Our Vision",
    text: "Become the trusted placement preparation platform adopted across departments at Sanjivani College, helping students transition seamlessly from campus to career.",
    accent: "var(--accent)",
  },
  {
    icon: Layers,
    title: "Platform Features",
    text: "Comprehensive resume AI analysis, real-time mock interview simulations, company-wise aptitude prep, automated scoring analytics, and skill evaluation.",
    accent: "var(--primary)",
  },
  {
    icon: Code2,
    title: "Architecture",
    text: "Built on modern MERN stack architecture with optimized database querying, modular API design, dynamic response evaluation, and responsive design systems.",
    accent: "var(--accent)",
  },
];

/**
 * Redesigned About Page — platform overview for Sanjivani College students.
 */
function About() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">

      {/* ── Hero Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-[var(--border)] p-8 sm:p-12 text-center"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in srgb, var(--primary) 12%, transparent), transparent 70%), color-mix(in srgb, var(--card-bg) 80%, var(--bg-primary))",
        }}
      >
        {/* Top subtle border glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--primary)]" />

        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--primary)]/30 text-xs font-bold uppercase tracking-wider mb-4"
          style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
        >
          <Sparkles className="w-3.5 h-3.5" /> Placement Preparation Ecosystem
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4" style={{ color: "var(--text-primary)" }}>
          About{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]">
            Interview Platform
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-sm sm:text-base font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          An all-in-one AI-driven preparation hub tailored specifically for students of Sanjivani College of Engineering to boost confidence, master placement rounds, and secure placements.
        </p>
      </motion.div>

      {/* ── Core Values & Overview Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {OVERVIEW_CARDS.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 sm:p-7 shadow-[var(--shadow-sm)] hover:border-[var(--primary)]/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3.5 mb-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in srgb, ${item.accent} 12%, transparent)` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: item.accent }} />
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </h2>
                </div>
                <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
                  {item.text}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Tech Stack Badges ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-8 shadow-[var(--shadow-sm)]"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
            <Cpu className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Powered By Modern Tech</h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Engineering stack backing the platform architecture</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-2">
          {TECH_STACK.map((tech) => (
            <span
              key={tech}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 hover:scale-105 cursor-default"
              style={{
                background: "color-mix(in srgb, var(--bg-primary) 60%, transparent)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </motion.section>

      {/* ── Development Team Section ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-8 shadow-[var(--shadow-sm)] space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
              <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Development Team</h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>The engineering minds behind the project</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)" }}>
            <ShieldCheck className="w-3.5 h-3.5" /> Active Contributors
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TEAM.map((member) => (
            <div
              key={member.name}
              className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/30 hover:border-[var(--primary)]/40 transition-all duration-300 flex items-center gap-4 group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${member.color} text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                {member.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                  {member.name}
                </p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--primary)" }}>
                  {member.role}
                </p>
                <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-md mt-1.5" style={{ background: "color-mix(in srgb, var(--border) 50%, transparent)", color: "var(--text-muted)" }}>
                  {member.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── College & Institutional Info ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-8 shadow-[var(--shadow-sm)]"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-1" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
            <Building2 className="w-6 h-6" style={{ color: "var(--primary)" }} />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Sanjivani College of Engineering, Kopargaon
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <GraduationCap className="w-3.5 h-3.5" /> Final Year Project
              </span>
            </div>
            <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
              Developed under the academic guidance of project guides for placement training, skill building, and campus placement drives.
            </p>
          </div>
        </div>
      </motion.section>

      {/* ── Footer / Meta ── */}
      <div className="flex items-center justify-between text-xs px-2" style={{ color: "var(--text-muted)" }}>
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          <span>Interview Platform v1.0.0</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          <span>Built for Students</span>
        </div>
      </div>

    </div>
  );
}

export default About;