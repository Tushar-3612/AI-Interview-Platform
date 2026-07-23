import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Calendar, Briefcase, ChevronDown, ChevronUp, Award, BrainCircuit, CheckCircle2, XCircle } from "lucide-react";

const DEFAULT_HISTORY = [
  {
    id: 1,
    date: "July 14, 2026",
    role: "Software Engineer Intern",
    status: "Completed",
    score: "82%",
    details: {
      aptitudeScore: "24/30",
      technicalScore: "85%",
      codingScore: "2/3",
      overallPercentage: 82,
      result: "Pass",
      strengths: ["Strong analytical thinking", "Good structural explanation of OOPs concepts."],
      weaknesses: ["Refine answers related to systems design scaling details."]
    }
  },
  {
    id: 2,
    date: "July 10, 2026",
    role: "Full Stack Developer",
    status: "Completed",
    score: "75%",
    details: {
      aptitudeScore: "20/30",
      technicalScore: "78%",
      codingScore: "2/3",
      overallPercentage: 75,
      result: "Pass",
      strengths: ["Excellent problem-solving in Javascript constraints."],
      weaknesses: ["Strengthen knowledge of relational database normalization principles."]
    }
  },
];

/**
 * Interview History — past mock interview sessions.
 */
function InterviewHistory() {
  const [historyList, setHistoryList] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("interview-history-list");
    if (stored) {
      setHistoryList(JSON.parse(stored));
    } else {
      localStorage.setItem("interview-history-list", JSON.stringify(DEFAULT_HISTORY));
      setHistoryList(DEFAULT_HISTORY);
    }
  }, []);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your entire interview history?")) {
      localStorage.removeItem("interview-history-list");
      setHistoryList([]);
      toast.success("History cleared!");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Interview History
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Your past mock placement practice sessions and evaluations.
            </p>
          </div>

          {historyList.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 cursor-pointer hover:bg-red-500/10 transition"
            >
              Clear History
            </button>
          )}
        </div>

        {historyList.length === 0 ? (
          <div className="student-card p-12 text-center">
            <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)" }}>No interviews yet. Start your first practice from the Practice page.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historyList.map((item, i) => {
              const isExpanded = expandedId === item.id;
              const details = item.details;
              const hasPassed = details?.result === "Pass";

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="student-card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-800/10 transition"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: hasPassed
                            ? "color-mix(in srgb, var(--success) 10%, transparent)"
                            : "color-mix(in srgb, var(--error) 10%, transparent)",
                        }}
                      >
                        <Briefcase
                          className="w-5 h-5"
                          style={{ color: hasPassed ? "var(--success)" : "var(--error)" }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                          {item.role}
                        </p>
                        <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                          <Calendar className="w-3.5 h-3.5" /> {item.date}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: hasPassed ? "var(--success)" : "var(--error)" }}>
                          {item.score}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {hasPassed ? "PASSED" : "FAILED"}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && details && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t px-6 py-5 space-y-4"
                        style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}
                      >
                        <div className="grid grid-cols-3 gap-2 text-center border-b pb-4" style={{ borderColor: "var(--border)" }}>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-neutral-400">Aptitude</p>
                            <p className="text-sm font-semibold text-neutral-200 mt-0.5">{details.aptitudeScore}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-neutral-400">Technical AI</p>
                            <p className="text-sm font-semibold text-neutral-200 mt-0.5">{details.technicalScore}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-neutral-400">Coding</p>
                            <p className="text-sm font-semibold text-neutral-200 mt-0.5">{details.codingScore}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-bold text-neutral-400 flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-green-500" />
                              Strengths Profile
                            </h4>
                            <ul className="text-xs space-y-1 list-disc pl-4 text-neutral-300">
                              {details.strengths.map((s, idx) => (
                                <li key={idx}>{s}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="space-y-1.5">
                            <h4 className="text-xs font-bold text-neutral-400 flex items-center gap-1.5">
                              <BrainCircuit className="w-3.5 h-3.5 text-red-400" />
                              Improvement Targets
                            </h4>
                            <ul className="text-xs space-y-1 list-disc pl-4 text-neutral-300">
                              {details.weaknesses.map((w, idx) => (
                                <li key={idx}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default InterviewHistory;
