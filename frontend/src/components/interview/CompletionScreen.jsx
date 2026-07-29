import React from "react";
import { CheckCircle2, Home } from "lucide-react";
import Button from "../ui/Button";
import { motion } from "framer-motion";

function CompletionScreen({ candidateName, answeredCount, skippedCount, timeTakenText, onReturnHome, onReturnDashboard, onRestartInterview }) {
  const handleReturn = onReturnHome || onReturnDashboard;
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-slate-200 dark:border-zinc-800 p-8 text-center"
      >
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        
        <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Interview Complete!</h2>
        <p className="text-slate-500 mb-8">Great job, {candidateName.split(' ')[0]}. Your session has been recorded and evaluated.</p>
        
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl">
            <div className="text-2xl font-bold text-primary">{answeredCount}</div>
            <div className="text-xs text-slate-500 font-medium">Answered</div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl">
            <div className="text-2xl font-bold text-amber-500">{skippedCount}</div>
            <div className="text-xs text-slate-500 font-medium">Skipped</div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl">
            <div className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-1">{timeTakenText}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Duration</div>
          </div>
        </div>
        
        <Button onClick={handleReturn} className="w-full py-4 text-base">
          <Home className="w-5 h-5 mr-2" />
          Return to Dashboard
        </Button>
      </motion.div>
    </div>
  );
}

export default CompletionScreen;
