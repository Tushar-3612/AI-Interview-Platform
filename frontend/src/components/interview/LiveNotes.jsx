import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";

/**
 * LiveNotes Component
 * Displays real-time evaluation highlights or corrections generated during the interview session.
 */
function LiveNotes({ notes = [] }) {
  return (
    <div 
      className="glass-card rounded-[16px] p-3 flex flex-col justify-between w-full"
      style={{ height: "var(--ai-notes-height)" }}
    >
      <div className="flex items-center justify-between border-b pb-1 shrink-0" style={{ borderColor: "var(--border)" }}>
        <h3 className="font-bold text-[10px] tracking-wider uppercase text-muted">
          Real-time AI Notes
        </h3>
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 font-bold"></span>
        </span>
      </div>

      <div className="flex-grow overflow-y-auto pr-0.5 mt-1.5 min-h-0">
        {notes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted text-[10px] py-4 gap-1">
            <HelpCircle className="w-4 h-4 text-slate-350 dark:text-zinc-650" />
            <p>Analyzing speech patterns...</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence>
              {notes.map((note, index) => {
                const isSuccess = note.status === "success";
                const Icon = isSuccess ? CheckCircle2 : AlertTriangle;
                return (
                  <motion.li
                    key={note.text + index}
                    initial={{ opacity: 0, x: -10, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`flex items-start gap-1.5 p-1.5 rounded-lg border text-[10px] leading-snug font-medium ${
                      isSuccess
                        ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/5 border-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    <Icon className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{note.text}</span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

export default LiveNotes;
