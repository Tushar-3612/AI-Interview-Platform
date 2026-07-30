import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Loader2 } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function Results() {
  const token = getAuthToken();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const { data } = await api.get("/api/student/results", { headers });
        setResults(data || []);
      } catch {
        // stays empty
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [token]);

  const latest = results.length > 0 ? results[0] : null;

  const categories = latest
    ? [
        { label: "Technical", score: latest.technicalScore },
        { label: "Resume", score: latest.resumeScore },
        { label: "Coding", score: latest.codingScore },
      ]
    : [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Results
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Your interview performance breakdown.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : !latest ? (
          <div className="student-card p-12 text-center">
            <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)" }}>No results yet.</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Complete an interview to see your AI-evaluated scores.
            </p>
          </div>
        ) : (
          <>
            <div className="student-card p-6 mb-6 text-center">
              <BarChart3 className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--primary)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Overall Score</p>
              <p className="text-4xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
                {latest.overallScore || 0}%
              </p>
              <div className="flex items-center justify-center gap-1 mt-2 text-xs" style={{ color: "var(--success)" }}>
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Latest interview result</span>
              </div>
            </div>

            <div className="space-y-4">
              {categories.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="student-card p-5"
                >
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                    <span className="font-semibold" style={{ color: "var(--primary)" }}>
                      {item.score ?? "--"}/100
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    {item.score != null && (
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(Math.max(item.score, 0), 100)}%`, background: "var(--primary)" }}
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {latest.strengths && latest.strengths.length > 0 && (
              <div className="student-card p-5 mt-4">
                <h3 className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>Strengths</h3>
                <ul className="space-y-1">
                  {latest.strengths.map((s, idx) => (
                    <li key={idx} className="text-xs" style={{ color: "var(--text-secondary)" }}>+ {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {latest.weaknesses && latest.weaknesses.length > 0 && (
              <div className="student-card p-5 mt-4">
                <h3 className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>Areas to Improve</h3>
                <ul className="space-y-1">
                  {latest.weaknesses.map((w, idx) => (
                    <li key={idx} className="text-xs" style={{ color: "var(--text-secondary)" }}>- {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {results.length > 1 && (
              <div className="student-card p-5 mt-4">
                <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>All Results</h3>
                <div className="space-y-2">
                  {results.map((r, idx) => (
                    <div
                      key={r._id || idx}
                      className="flex items-center justify-between py-2 border-b text-xs"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>
                        Interview #{r.interviewId?.slice(-6) || idx + 1}
                      </span>
                      <span className="font-bold" style={{ color: "var(--primary)" }}>
                        {r.overallScore || 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

export default Results;
