import { motion } from "framer-motion";
import { CheckCircle2, Home, RotateCcw, FileText, Download, Award, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * CompletionScreen Component
 * Displayed when the mock interview is finalized successfully. Shows analytics metrics.
 */
function CompletionScreen({
  candidateName = "Roshan Langhi",
  answeredCount = 9,
  skippedCount = 1,
  timeTakenText = "24:18",
  onReturnDashboard,
  onRestartInterview,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-black dark:to-zinc-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-10 flex flex-col items-center"
      >
        {/* Animated Checkmark Emblem */}
        <div className="relative mb-6">
          <motion.div
            className="absolute inset-0 rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-xl"
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="w-18 h-18 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center relative z-10">
            <CheckCircle2 className="w-9 h-9" />
          </div>
        </div>

        {/* Headline */}
        <div className="text-center space-y-2 mb-8">
          <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
            Interview Finished
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-3 text-slate-900 dark:text-white">
            Interview Completed Successfully
          </h1>
          <p className="text-sm max-w-md mx-auto text-slate-500 dark:text-zinc-400 leading-relaxed">
            Excellent job, <span className="font-semibold text-slate-800 dark:text-white">{candidateName}</span>! 
            Your responses have been saved and compiled for AI analysis evaluation.
          </p>
        </div>

        {/* Analytics Statistics Dashboard Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full mb-8">
          {/* Questions answered */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-800/50 text-center">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Answered</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mt-1">
              {answeredCount} <span className="text-xs text-slate-400">/ 10</span>
            </p>
          </div>

          {/* Questions skipped */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-800/50 text-center">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Skipped</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mt-1">
              {skippedCount} <span className="text-xs text-slate-400">/ 10</span>
            </p>
          </div>

          {/* Time taken */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-800/50 text-center">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Duration</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mt-1">{timeTakenText}</p>
          </div>

          {/* Mock Score Coherence */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-800/50 text-center">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Coherence</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-500 mt-1">88%</p>
          </div>
        </div>

        {/* Real-time score meter indicator */}
        <div className="w-full bg-slate-50 dark:bg-zinc-800/20 border border-slate-100 dark:border-zinc-800/40 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Estimated Competency Tier</h4>
            <p className="text-sm font-semibold text-slate-850 dark:text-white mt-0.5">Level 3 — Senior Candidate Coherence Grade</p>
            <p className="text-xs text-slate-400 mt-0.5">Strong command over multi-threading and asynchronous database normalization structures.</p>
          </div>
        </div>

        {/* Buttons drawer */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {/* Return Dashboard */}
          <button
            type="button"
            onClick={onReturnDashboard}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all hover:opacity-85 cursor-pointer bg-slate-50 border-slate-200 text-slate-700 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-300"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          {/* View Report */}
          <button
            type="button"
            onClick={() => {
              toast.success("Opening AI Evaluation Report... (UI mock)");
            }}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all hover:opacity-85 cursor-pointer bg-slate-50 border-slate-200 text-slate-700 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-300"
          >
            <BarChart3 className="w-4 h-4" />
            <span>View Report</span>
          </button>

          {/* Download PDF */}
          <button
            type="button"
            onClick={() => {
              toast.success("Preparing PDF download... (UI mock)");
            }}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all hover:opacity-85 cursor-pointer bg-slate-50 border-slate-200 text-slate-700 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-300"
          >
            <Download className="w-4 h-4" />
            <span>Download CV</span>
          </button>

          {/* Start Another */}
          <button
            type="button"
            onClick={onRestartInterview}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white btn-gradient transition-all cursor-pointer shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Start Another</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default CompletionScreen;
