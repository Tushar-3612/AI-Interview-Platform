import { motion } from "framer-motion";
import { Target, Eye, Layers, Code2, Users, Building2, Info } from "lucide-react";

const TEAM = [
  { name: "Tushar Nagare", role: "Coming soon " },
  { name: "Roshan Langhi", role: "Coming soon " },
  { name: "Amol Lende ", role: "Coming soon " },
];

/**
 * About Page — platform overview for Sanjivani College students.
 */
function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            About Interview Platform
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            A placement preparation platform built for Sanjivani College of Engineering students.
          </p>
        </div>

        {[
          {
            icon: Target,
            title: "Mission",
            text: "Empower every student with structured interview preparation, resume-based mock interviews, and company-specific practice — making placement readiness accessible to all.",
          },
          {
            icon: Eye,
            title: "Vision",
            text: "Become the trusted placement preparation platform adopted by Sanjivani College, helping students transition confidently from campus to career.",
          },
          {
            icon: Layers,
            title: "Platform Overview",
            text: "Interview Platform offers resume upload, mock interview sessions, practice questions from top companies, performance evaluation, and placement analytics — all in one clean interface.",
          },
          {
            icon: Code2,
            title: "Technology Stack",
            text: "React, Node.js, Express, MongoDB Atlas, Tailwind CSS, and modern evaluation services — built with production-grade MERN architecture.",
          },
        ].map((section, i) => {
          const Icon = section.icon;
          return (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="student-card p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
                  <Icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
                </div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{section.title}</h2>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{section.text}</p>
            </motion.section>
          );
        })}

        <section className="student-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Development Team</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TEAM.map((member) => (
              <div key={member.name} className="p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{member.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{member.role}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="student-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <Building2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>College Information</h2>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Sanjivani College of Engineering, Kopargaon — Final Year Project developed under the guidance of the project guide for academic and placement training purposes.
          </p>
        </section>

        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Info className="w-4 h-4" />
          <span>Version 1.0.0</span>
        </div>
      </motion.div>
    </div>
  );
}

export default About;
