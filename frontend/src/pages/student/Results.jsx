import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Loader2, CheckCircle2, AlertTriangle, ArrowLeft, Mail, Award, Target, BrainCircuit, Code2, UserCheck } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function Results() {
  const token = getAuthToken();
  const { interviewId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeId = interviewId || searchParams.get("session") || searchParams.get("interviewId");

  const [result, setResult] = useState(null);
  const [resultsList, setResultsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResultData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        if (activeId) {
          try {
            const { data } = await api.get(`/api/interview/${activeId}/result`, { headers });
            setResult(data);
          } catch {
            // Fallback to latest result if specific id fails
          }
        }

        const { data: allResults } = await api.get("/api/student/results", { headers });
        setResultsList(allResults || []);
        if (!result && allResults && allResults.length > 0) {
          setResult(allResults[0]);
        }
      } catch {
        // stays empty
      } finally {
        setLoading(false);
      }
    };
    fetchResultData();
  }, [token, activeId]);

  const activeResult = result || (resultsList.length > 0 ? resultsList[0] : null);

  const categories = activeResult
    ? [
        { label: "Aptitude Round", score: activeResult.sections?.aptitude?.percentage ?? activeResult.aptitudeScore ?? 0, total: "25 Qs", icon: Target, color: "#f59e0b" },
        { label: "Technical Stack Round", score: activeResult.sections?.technical?.percentage ?? activeResult.technicalScore ?? 0, total: "25 Qs", icon: BrainCircuit, color: "#3b82f6" },
        { label: "Coding IDE Round", score: activeResult.sections?.coding?.percentage ?? activeResult.codingScore ?? 0, total: "3 Qs", icon: Code2, color: "#10b981" },
        { label: "HR Behavioral Round", score: activeResult.sections?.hr?.percentage ?? activeResult.hrScore ?? 0, total: "5 Qs", icon: UserCheck, color: "#a855f7" },
      ]
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            onClick={() => navigate("/interview-history")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 transition text-white/80 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Interview History
          </button>

          {activeResult?.email?.status && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border bg-white/5 text-white/60 border-white/10">
              <Mail className="w-3 h-3 text-blue-400" />
              Email Status: <span className="text-emerald-400">{activeResult.email.status}</span>
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black mb-1 text-white">
          Performance Evaluation Scorecard
        </h1>
        <p className="text-xs text-white/50 mb-8">
          Single Source of Truth Evaluation Report permanently saved in platform database.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : !activeResult ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-white/10">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 text-white/30" />
            <p className="text-white/70 font-bold text-sm">No evaluation result found.</p>
            <p className="text-xs text-white/40 mt-1">
              Complete an interview session to see your permanent evaluation scorecard.
            </p>
          </div>
        ) : (
          <>
            {/* OVERALL SCORECARD HERO */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 text-center mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-4 py-1 bg-blue-500/10 border-b border-l border-blue-500/20 text-[10px] font-extrabold text-blue-400 uppercase tracking-widest rounded-bl-2xl">
                {activeResult.targetRound && activeResult.targetRound !== "all"
                  ? `${activeResult.targetRound.toUpperCase()} ROUND • ${activeResult.isEndedEarly ? "PARTIAL" : "COMPLETED"}`
                  : (activeResult.isEndedEarly ? "ENDED EARLY" : "COMPLETED")}
              </div>

              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-blue-400" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-white/40">
                {activeResult.targetRound && activeResult.targetRound !== "all"
                  ? `${activeResult.targetRound.toUpperCase()} Round Performance Score`
                  : "Overall Placement Score"}
              </p>
              
              <div className="text-5xl font-black font-mono my-2 text-white" style={{ color: (activeResult.overallScore || 0) >= 70 ? "#34d399" : "#f59e0b" }}>
                {activeResult.overallScore || 0}%
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-white/80">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>{activeResult.recommendation || "Needs Evaluation"}</span>
              </div>
            </div>

            {/* 4 ROUND SCORE BREAKDOWN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {categories.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-white/70" />
                        <span className="text-xs font-extrabold text-white">{item.label}</span>
                      </div>
                      <span className="font-mono text-sm font-black text-amber-400">
                        {item.score}%
                      </span>
                    </div>

                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(Math.max(item.score, 0), 100)}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* STRENGTHS & WEAKNESSES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Key Strengths
                </h3>
                <ul className="space-y-1.5 text-xs text-white/80 list-disc pl-4">
                  {(activeResult.strengths || []).length > 0
                    ? activeResult.strengths.map((s, idx) => <li key={idx}>{s}</li>)
                    : <li>No specific strengths recorded</li>}
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Recommended Focus Areas
                </h3>
                <ul className="space-y-1.5 text-xs text-white/80 list-disc pl-4">
                  {(activeResult.weaknesses || []).length > 0
                    ? activeResult.weaknesses.map((w, idx) => <li key={idx}>{w}</li>)
                    : <li>No major weaknesses identified</li>}
                </ul>
              </div>
            </div>

          </>
        )}
      </motion.div>
    </div>
  );
}

export default Results;
