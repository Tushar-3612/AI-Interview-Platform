import React from "react";
import { Send, AlertTriangle, X } from "lucide-react";

export default function SubmissionModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Submit Solution?",
  message = "Your code will be evaluated against official hidden test cases. Are you ready to submit?",
  confirmText = "Submit Now",
  loading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-md rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 bg-[var(--card-bg)] text-[var(--text-primary)]"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400">
            <Send className="w-5 h-5" />
            <h3 className="text-base font-extrabold">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold border hover:bg-[var(--bg-secondary)] transition cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 shadow-md shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
