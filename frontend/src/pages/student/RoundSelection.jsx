import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Cpu, Code2, BookOpen, Lock, CheckCircle2, ChevronRight, Award } from "lucide-react";
import { COMPANIES } from "../../data/companies";
import Button from "../../components/ui/Button";

function RoundSelection() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const company = COMPANIES.find((c) => c.id === companyId);
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    const sessionKey = `practice-session-${companyId}`;
    const stored = localStorage.getItem(sessionKey);
    if (stored) {
      setSession(JSON.parse(stored));
    } else {
      const initial = {
        companyId,
        rounds: {
          aptitude: { completed: false, score: null, maxScore: 30 },
          technical: { completed: false, score: null, maxScore: 100 },
          coding: { completed: false, score: null, maxScore: 3 }
        }
      };
      localStorage.setItem(sessionKey, JSON.stringify(initial));
      setSession(initial);
    }
  }, [companyId]);

  if (!company) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p style={{ color: "var(--text-secondary)" }}>Company not found.</p>
        <button
          type="button"
          onClick={() => navigate("/interview-practice")}
          className="mt-4 text-sm font-medium cursor-pointer"
          style={{ color: "var(--primary)" }}
        >
          Back to Practice
        </button>
      </div>
    );
  }

  if (!session) return null;

  const { aptitude, technical, coding } = session.rounds;

  const isTechnicalLocked = !aptitude.completed;
  const isCodingLocked = !technical.completed;
  const allCompleted = aptitude.completed && technical.completed && coding.completed;

  const roundsConfig = [
    {
      id: "aptitude",
      title: "Aptitude Round",
      desc: "30 MCQs testing Quantitative, Logical, and Verbal reasoning.",
      icon: BookOpen,
      status: aptitude.completed ? "completed" : "active",
      score: aptitude.completed ? `${aptitude.score}/${aptitude.maxScore}` : null,
      locked: false,
      path: `/interview-practice/${companyId}/aptitude`
    },
    {
      id: "technical",
      title: "Technical Round",
      desc: "20 random company-specific questions evaluated using Gemini AI API.",
      icon: Cpu,
      status: technical.completed ? "completed" : (isTechnicalLocked ? "locked" : "active"),
      score: technical.completed ? `${technical.score}%` : null,
      locked: isTechnicalLocked,
      path: `/interview-practice/${companyId}/technical`
    },
    {
      id: "coding",
      title: "Coding Round",
      desc: "3 coding questions (Easy, Medium, Hard) evaluated against predefined test cases.",
      icon: Code2,
      status: coding.completed ? "completed" : (isCodingLocked ? "locked" : "active"),
      score: coding.completed ? `${coding.score}/${coding.maxScore} Solved` : null,
      locked: isCodingLocked,
      path: `/interview-practice/${companyId}/coding`
    }
  ];

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset your practice progress for this company?")) {
      const sessionKey = `practice-session-${companyId}`;
      const initial = {
        companyId,
        rounds: {
          aptitude: { completed: false, score: null, maxScore: 30 },
          technical: { completed: false, score: null, maxScore: 100 },
          coding: { completed: false, score: null, maxScore: 3 }
        }
      };
      localStorage.setItem(sessionKey, JSON.stringify(initial));
      setSession(initial);
    }
  };

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
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
            style={{ background: company.color }}
          >
            {company.name[0]}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {company.name} Interview Prep
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Complete all 3 assessment stages to get a comprehensive performance report.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="text-xs font-semibold px-4 py-2 rounded-xl border cursor-pointer hover:bg-neutral-800 transition"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          Reset Progress
        </button>
      </motion.div>

      {/* Rounds list */}
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
              style={{ opacity: r.locked ? 0.65 : 1 }}
            >
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: r.locked
                      ? "color-mix(in srgb, var(--border) 20%, transparent)"
                      : "color-mix(in srgb, var(--primary) 10%, transparent)",
                  }}
                >
                  {r.locked ? (
                    <Lock className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <Icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                      {r.title}
                    </h3>
                    {r.status === "completed" && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    {r.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                {r.score && (
                  <div className="text-right">
                    <p className="text-xs text-neutral-400">Score Obtained</p>
                    <p className="text-sm font-bold text-green-500">{r.score}</p>
                  </div>
                )}

                <Button
                  onClick={() => navigate(r.path)}
                  disabled={r.locked}
                  className="px-4 py-2 text-xs"
                >
                  {r.status === "completed" ? "Practice Again" : "Start Round"}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Result Trigger */}
      {allCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-3xl border border-dashed flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
          style={{ borderColor: "var(--primary)", background: "color-mix(in srgb, var(--primary) 3%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-yellow-500" />
            <div>
              <h3 className="font-semibold text-sm sm:text-base">All Rounds Completed!</h3>
              <p className="text-xs text-neutral-400">View your aggregate feedback, grades, and strengths/weaknesses profile.</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(`/interview-practice/${companyId}/result`)}
            className="flex items-center gap-1 text-xs px-5 py-2.5 font-bold"
          >
            View Interview Result
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}

export default RoundSelection;
