import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Settings2, Loader2 } from "lucide-react";
import Button from "../ui/Button";

function StartInterviewModal({ open, onClose, profile, onSubmit, isStarting = false }) {
  const [formData, setFormData] = useState({
    interviewType: "Technical",
    difficulty: "Medium",
    duration: 30, // minutes
  });

  if (!open) return null;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isStarting) return;
    onSubmit(formData);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isStarting ? undefined : onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configure Interview
            </h2>
            <button
              onClick={isStarting ? undefined : onClose}
              disabled={isStarting}
              className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {!profile?.resumeFileName && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
                <strong>Note:</strong> You haven't uploaded a resume yet. For the best AI mock interview experience, we recommend uploading your resume in your Profile first.
              </div>
            )}
          
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Interview Type</label>
                <select
                  name="interviewType"
                  value={formData.interviewType}
                  onChange={handleChange}
                  disabled={isStarting}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                >
                  <option value="Technical">Technical</option>
                  <option value="HR">HR / Behavioral</option>
                  <option value="Managerial">Managerial</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Difficulty Level</label>
                <select
                  name="difficulty"
                  value={formData.difficulty}
                  onChange={handleChange}
                  disabled={isStarting}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>
            
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-zinc-800">
              <Button type="button" variant="outline" onClick={onClose} disabled={isStarting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isStarting} className="flex items-center gap-2 min-w-[120px] justify-center">
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Start Now
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default StartInterviewModal;

