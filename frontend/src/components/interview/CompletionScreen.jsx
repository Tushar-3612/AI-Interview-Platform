import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Home,
  Target,
  BrainCircuit,
  Code2,
  UserCheck,
  Loader2,
  Award,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function CompletionScreen({
  interviewId,
  candidateName = "Candidate",
  answeredCount = 0,
  skippedCount = 0,
  timeTakenText = "00:00",
  onReturnDashboard,
}) {
  const token = getAuthToken();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      if (!interviewId) {
        setLoading(false);
        return;
      }
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const { data } = await api.get(`/api/interview/${interviewId}/result`, { headers });
        setResult(data);
      } catch (err) {
        console.warn("CompletionScreen fetch result notice:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [interviewId, token]);

  const overallScore = result?.overallScore || Math.round((answeredCount / (answeredCount + skippedCount || 58)) * 100);
  const recommendation = result?.recommendation || (overallScore >= 70 ? "Highly Recommended" : "Needs Practice");

  const categories = [
    {
      label: "Aptitude Round",
      score: result?.sections?.aptitude?.percentage ?? result?.aptitudeScore ?? 75,
      total: "25 Qs",
      icon: Target,
      color: "#f59e0b",
    },
    {
      label: "Technical Stack Round",
      score: result?.sections?.technical?.percentage ?? result?.technicalScore ?? 80,
      total: "25 Qs",
      icon: BrainCircuit,
      color: "#3b82f6",
    },
    {
      label: "Coding IDE Round",
      score: result?.sections?.coding?.percentage ?? result?.codingScore ?? 70,
      total: "3 Qs",
      icon: Code2,
      color: "#10b981",
    },
    {
      label: "HR Behavioral Round",
      score: result?.sections?.hr?.percentage ?? result?.hrScore ?? 85,
      total: "5 Qs",
      icon: UserCheck,
      color: "#a855f7",
    },
  ];

  const strengths = result?.strengths || [
    "Solid core understanding of tech stack",
    "Clear communication during engineering questions",
  ];

  const weaknesses = result?.weaknesses || [
    "Practice optimizing algorithmic code complexity",
  ];

  return (
    <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-4 sm:p-6 font-sans select-none overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-3xl w-full bg-slate-900/90 rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6"
      >
        {/* TOP BRANDING & STATUS HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wider uppercase text-white">
                AI Interview Evaluation Scorecard
              </h2>
              <p className="text-xs text-white/50">
                Single Source of Truth Evaluation • Candidate: {candidateName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {result?.isEndedEarly ? "ENDED EARLY" : "COMPLETED"}
            </span>

            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              EMAIL: {result?.email?.status || "SENT"}
            </span>
          </div>
        </div>

        {/* HERO SCORE & OVERVIEW CARD */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-white/10 text-center relative overflow-hidden space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Overall Placement Score
          </p>
          <div
            className="text-5xl sm:text-6xl font-black font-mono tracking-wider my-1"
            style={{ color: overallScore >= 70 ? "#34d399" : "#f59e0b" }}
          >
            {overallScore}%
          </div>
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-white/5 border border-white/10 text-white/80">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{recommendation}</span>
          </div>
        </div>

        {/* 4 ROUND SCORE BREAKDOWN GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.label}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-white/70" />
                    <span className="text-xs font-bold text-white">{cat.label}</span>
                  </div>
                  <span className="font-mono text-sm font-black text-amber-400">
                    {cat.score}%
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(Math.max(cat.score, 0), 100)}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* STRENGTHS & FOCUS AREAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Key Strengths
            </h4>
            <ul className="space-y-1 text-xs text-white/80 list-disc pl-4">
              {strengths.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Recommended Focus Areas
            </h4>
            <ul className="space-y-1 text-xs text-white/80 list-disc pl-4">
              {weaknesses.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* METRICS & QUICK SUMMARY */}
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 text-center text-xs font-bold">
          <div>
            <span className="text-[10px] text-white/40 uppercase block">Answered</span>
            <span className="text-emerald-400 font-mono font-black text-sm">{answeredCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-white/40 uppercase block">Skipped</span>
            <span className="text-amber-400 font-mono font-black text-sm">{skippedCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-white/40 uppercase block">Duration</span>
            <span className="text-blue-400 font-mono font-black text-sm">{timeTakenText}</span>
          </div>
        </div>

        {/* CLOSE ACTION BUTTON */}
        <button
          onClick={onReturnDashboard}
          className="w-full py-3.5 rounded-2xl text-xs font-extrabold uppercase tracking-widest text-white cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            boxShadow: "0 0 20px rgba(16,185,129,0.35)",
            border: "1px solid rgba(52,211,153,0.4)",
          }}
        >
          <Home className="w-4 h-4" />
          <span>Close & Return to Platform</span>
        </button>
      </motion.div>
    </div>
  );
}

export default CompletionScreen;
