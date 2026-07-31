import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Code2, CheckCircle2, Award, ChevronRight, Clock, History, TrendingUp } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import Button from "../../components/ui/Button";
import { SkeletonCompanyDashboard, ErrorState } from "../../components/ui/Skeleton";
import { timeAgo, formatTime } from "../../utils/dateUtils";

function RoundSelection() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [company, setCompany] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [homeRes, historyRes] = await Promise.all([
        api.get("/api/practice/home", { headers }),
        api.get("/api/practice/aptitude/history", { headers, params: { limit: 20 } }),
      ]);
      const list = homeRes.data?.companies || [];
      const found = list.find((c) => c.id === companyId || c._id === companyId);
      setCompany(found);
      setAttempts((historyRes.data?.attempts || []).filter((a) => a.companyId === companyId));
    } catch (err) {
      setError(err.response?.status || "network_failure");
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatLastUpdated = (dateVal) => {
    if (!dateVal) return "Updated recently";
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return "Updated recently";
    
    const now = new Date();
    const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = dNow - dDate;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    
    if (diffDays === 0) return "Updated Today";
    if (diffDays === 1) return "Updated Yesterday";
    if (diffDays > 1 && diffDays < 15) return `Updated ${diffDays} Days Ago`;
    return `Updated ${date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`;
  };

  if (loading) {
    return <SkeletonCompanyDashboard />;
  }

  if (error || !company) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <ErrorState
          statusCode={error}
          message="Failed to load company details."
          onRetry={fetchData}
          onGoBack={() => navigate("/interview-practice")}
        />
      </div>
    );
  }



  const latestAttempt = attempts[0];
  const bestAttempt = attempts.reduce((best, a) => (!best || a.percentage > best.percentage ? a : best), null);

  const roundsConfig = [
    {
      id: "aptitude",
      title: "Aptitude Round",
      desc: "MCQs testing Quantitative, Logical, and Verbal reasoning. Select count and difficulty.",
      icon: BookOpen,
      path: `/interview-practice/${companyId}/aptitude`,
      attempts: attempts.length,
      bestScore: bestAttempt ? `${bestAttempt.score} / ${bestAttempt.questionCount} (${bestAttempt.percentage}%)` : null,
    },
    {
      id: "coding",
      title: "Coding Round",
      desc: "Solve algorithmic problems in multiple languages. Tested against hidden test cases.",
      icon: Code2,
      path: `/interview-practice/${companyId}/coding`,
      attempts: company.codingCount || 0,
      bestScore: null,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => navigate("/interview-practice")}
        className="flex items-center gap-2 text-sm font-medium mb-6 cursor-pointer hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Companies
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 p-6 sm:p-8 student-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl overflow-hidden shrink-0"
            style={{ background: company.color }}
          >
            {company.logo ? (
              <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
            ) : (
              company.name[0]
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {company.name} Interview Prep
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {company.description || "Complete both assessment rounds to get comprehensive performance feedback."}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatLastUpdated(company.lastUpdated)}
              </span>
              {company.package && <span>· {company.package}</span>}
            </div>
          </div>
        </div>
      </motion.div>

      {latestAttempt && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="student-card p-4 mb-6 flex flex-wrap items-center gap-4"
        >
          <TrendingUp className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Last attempt: {latestAttempt.percentage}%
            </span>{" "}
            · {latestAttempt.score} / {latestAttempt.questionCount} correct · {formatTime(latestAttempt.timeTaken)} · {timeAgo(latestAttempt.createdAt)}
          </div>
          <Button onClick={() => navigate(`/interview-practice/${companyId}/aptitude`)} className="ml-auto px-4 py-2 text-xs">
            Continue Practice
          </Button>
        </motion.div>
      )}

      <div className="space-y-4 mb-8">
        {roundsConfig.map((r, i) => {
          const Icon = r.icon;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="student-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                      {r.title}
                    </h3>
                    {r.attempts > 0 && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    {r.desc}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span className="flex items-center gap-1">
                      <History className="w-3 h-3" />
                      {r.id === "aptitude" ? `${r.attempts} attempt${r.attempts === 1 ? "" : "s"}` : `${r.attempts} problems`}
                    </span>
                    {r.bestScore && (
                      <span className="font-semibold text-green-500">Best: {r.bestScore}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                <Button onClick={() => navigate(r.path)} className="px-4 py-2 text-xs">
                  {r.attempts > 0 ? "Practice Again" : "Start Round"}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {attempts.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-3xl border border-dashed flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
          style={{ borderColor: "var(--primary)", background: "color-mix(in srgb, var(--primary) 3%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-yellow-500" />
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Keep Going!</h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                You have {attempts.length} aptitude attempts for {company.name}. Consistency builds placement readiness.
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/practice/aptitude/history")}
            className="flex items-center gap-1 text-xs px-5 py-2.5 font-bold"
          >
            View History
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}

export default RoundSelection;
