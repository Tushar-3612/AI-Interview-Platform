import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Check, Copy } from "lucide-react";
import toast from "react-hot-toast";

export default function DuplicateConflictModal({ isOpen, onClose, newQuestion, existingQuestion }) {
  if (!isOpen || !existingQuestion) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied question ID to clipboard");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 backdrop-blur-md"
          style={{ background: "var(--admin-modal-overlay, rgba(0, 0, 0, 0.7))" }}
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-3xl rounded-2xl border p-6 shadow-2xl z-10 overflow-hidden"
          style={{ background: "var(--card-bg, #1e293b)", borderColor: "var(--border, #334155)", color: "var(--text-primary, #f8fafc)" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b" style={{ borderColor: "var(--border, #334155)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-amber-400">
                  DUPLICATE QUESTION DETECTED
                </h3>
                <p className="text-xs" style={{ color: "var(--text-secondary, #94a3b8)" }}>
                  Question already exists in the company question bank and cannot be added.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-colors hover:bg-slate-700/50"
              style={{ color: "var(--text-muted, #64748b)" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Comparison Body */}
          <div className="py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* New Question Box */}
            <div className="p-4 rounded-xl border flex flex-col justify-between" style={{ background: "rgba(15, 23, 42, 0.5)", borderColor: "var(--border, #334155)" }}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    New Question
                  </span>
                  <span className="text-[11px] font-semibold text-rose-400">
                    Status: Rejected
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400">Question Content:</p>
                  <p className="text-sm font-semibold text-white p-3 rounded-lg bg-slate-900/60 border border-slate-800 leading-relaxed">
                    {newQuestion?.question || newQuestion?.title || "N/A"}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                <div>Company: <span className="font-semibold text-slate-200">{newQuestion?.companyId || "Selected Company"}</span></div>
                <div>Type: <span className="font-semibold text-slate-200 uppercase">{newQuestion?.type || "MCQ"}</span></div>
              </div>
            </div>

            {/* Existing Question Box */}
            <div className="p-4 rounded-xl border border-amber-500/40 flex flex-col justify-between" style={{ background: "rgba(245, 158, 11, 0.05)" }}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Existing Question
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(existingQuestion.questionId)}
                    className="flex items-center gap-1 text-[11px] font-mono text-amber-400 hover:underline"
                  >
                    <span>ID: {existingQuestion.questionId}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-amber-300/80">Already Exists As:</p>
                  <p className="text-sm font-semibold text-white p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 leading-relaxed">
                    {existingQuestion.question || existingQuestion.title || "N/A"}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-500/20 text-xs text-slate-300 space-y-1">
                <div>Company: <span className="font-semibold text-amber-300">{existingQuestion.companyName || existingQuestion.companyId}</span></div>
                <div>Type: <span className="font-semibold text-amber-300 uppercase">{existingQuestion.type || "MCQ"}</span></div>
                <div>Difficulty: <span className="font-semibold capitalize text-amber-300">{existingQuestion.difficulty || "Medium"}</span></div>
              </div>
            </div>
          </div>

          {/* Alert Callout */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Duplicate question text detected after string normalization (spaces, case, & punctuation). Please provide another question.</span>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t flex justify-end gap-3" style={{ borderColor: "var(--border, #334155)" }}>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer"
            >
              Close & Modify Question
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
