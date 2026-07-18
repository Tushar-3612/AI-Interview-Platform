import { motion, AnimatePresence } from "framer-motion";
import { AlertOctagon, X } from "lucide-react";

/**
 * ConfirmExitDialog Component
 * Overlay modal alert asking for confirmation before exiting an active interview.
 */
function ConfirmExitDialog({ isOpen = false, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop glass blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md overflow-hidden rounded-[28px] p-6 sm:p-8 glass-card border border-red-500/10 shadow-2xl z-50 text-center"
        >
          {/* Close x */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Danger alert icon */}
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-5 animate-bounce">
            <AlertOctagon className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold tracking-tight mb-2" style={{ color: "var(--text-primary)" }}>
            End Interview Session?
          </h2>
          
          <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            Are you sure you want to end this interview? 
            <span className="block font-semibold mt-1.5 text-amber-500">
              Warning: Your current response progress will be evaluated.
            </span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl border text-sm font-semibold hover:opacity-85 transition-all cursor-pointer bg-slate-50 border-slate-200 text-slate-700 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>

            {/* Confirm End Button */}
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all cursor-pointer shadow-sm shadow-red-900/25"
            >
              End Interview
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ConfirmExitDialog;
