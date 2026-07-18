import { motion } from "framer-motion";
import { History, Calendar, Briefcase } from "lucide-react";

const MOCK_HISTORY = [
  { id: 1, date: "July 14, 2026", role: "Software Engineer Intern", status: "Completed", score: "8.2/10" },
  { id: 2, date: "July 10, 2026", role: "Full Stack Developer", status: "Completed", score: "7.5/10" },
];

/**
 * Interview History — past mock interview sessions.
 */
function InterviewHistory() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Interview History
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Your past mock interview sessions.
        </p>

        {MOCK_HISTORY.length === 0 ? (
          <div className="student-card p-12 text-center">
            <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)" }}>No interviews yet. Start your first interview from the home page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {MOCK_HISTORY.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="student-card p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
                    <Briefcase className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{item.role}</p>
                    <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                      <Calendar className="w-3 h-3" /> {item.date}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--success)" }}>{item.score}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.status}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default InterviewHistory;
