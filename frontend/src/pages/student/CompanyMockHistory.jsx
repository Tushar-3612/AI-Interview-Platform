import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  ArrowRight,
  Trophy,
  Loader2,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function CompanyMockHistory() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const { data } = await api.get("/api/company-mock/history", { headers });
        setAttempts(data.attempts || []);
      } catch (err) {
        console.error("Failed to load mock history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [token]);

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getScoreColor = (score) => {
    if (score == null) return "var(--text-muted)";
    if (score >= 80) return "#16A34A";
    if (score >= 60) return "#F59E0B";
    if (score >= 45) return "#F97316";
    return "#E73F1E";
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#8B5CF6" }} />
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#8B5CF6" }}>
              Mock Interview History
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Track your company-specific mock interview performance
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/company-mock")}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-[10px] text-white cursor-pointer transition hover:opacity-90"
            style={{ background: "#8B5CF6", boxShadow: "0 4px 14px rgba(139, 92, 246, 0.3)" }}
          >
            Start New Mock <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {attempts.length === 0 ? (
          <div className="text-center py-20 p-10 rounded-[18px] border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
            <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>No Mock Interviews Yet</h2>
            <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>
              Start your first company mock interview to see your history here.
            </p>
            <button
              onClick={() => navigate("/company-mock")}
              className="px-5 py-2.5 rounded-[10px] text-xs font-bold text-white cursor-pointer"
              style={{ background: "#8B5CF6", boxShadow: "0 4px 14px rgba(139, 92, 246, 0.3)" }}
            >
              Start Mock Interview
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {attempts.map((attempt, i) => (
              <motion.div
                key={attempt._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-[18px] border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ background: "var(--card-bg)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-[12px] flex items-center justify-center text-white font-bold text-base shrink-0"
                    style={{ background: attempt.companyColor || "#8B5CF6" }}
                  >
                    {attempt.companyName?.[0] || "M"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {attempt.companyName || "Unknown Company"}
                      </h3>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                        style={{
                          background: attempt.status === "completed" ? "rgba(22, 163, 74, 0.1)" : "rgba(245, 158, 11, 0.1)",
                          color: attempt.status === "completed" ? "#16A34A" : "#F59E0B",
                        }}
                      >
                        {attempt.status === "completed" ? "Completed" : "In Progress"}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {formatDate(attempt.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Section scores */}
                  <div className="hidden sm:flex items-center gap-4 text-xs">
                    {attempt.aptitudeScore != null && (
                      <div className="text-center">
                        <p className="font-bold" style={{ color: getScoreColor(attempt.aptitudeScore) }}>
                          {attempt.aptitudeScore}%
                        </p>
                        <p style={{ color: "var(--text-muted)" }}>Aptitude</p>
                      </div>
                    )}
                    {attempt.technicalScore != null && (
                      <div className="text-center">
                        <p className="font-bold" style={{ color: getScoreColor(attempt.technicalScore) }}>
                          {attempt.technicalScore}%
                        </p>
                        <p style={{ color: "var(--text-muted)" }}>Technical</p>
                      </div>
                    )}
                    {attempt.codingScore != null && (
                      <div className="text-center">
                        <p className="font-bold" style={{ color: getScoreColor(attempt.codingScore) }}>
                          {attempt.codingScore}%
                        </p>
                        <p style={{ color: "var(--text-muted)" }}>Coding</p>
                      </div>
                    )}
                  </div>

                  {/* Overall score */}
                  {attempt.overallScore != null && (
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" style={{ color: getScoreColor(attempt.overallScore) }} />
                      <span className="text-lg font-black" style={{ color: getScoreColor(attempt.overallScore) }}>
                        {attempt.overallScore}%
                      </span>
                    </div>
                  )}

                  {/* Action */}
                  <button
                    onClick={() => navigate(`/company-mock?result=${attempt._id}`)}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-[10px] border cursor-pointer transition hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    View <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default CompanyMockHistory;
