import { motion } from "framer-motion";
import { Play } from "lucide-react";

/**
 * InterviewLayout Component
 * Manages the responsive grid layouts:
 * - Desktop: 3 columns (Left Panel, Center Question/Editor, Right Stats)
 * - Tablet: 2 columns
 * - Mobile: Stacked single column
 */
function InterviewLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  isPaused = false,
  onResume,
}) {
  return (
    <div className="min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-black dark:to-zinc-950 p-4 lg:p-4 flex flex-col justify-center relative transition-all duration-300">
      
      {/* Background elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[128px] pointer-events-none" />

      {/* Main Grid Wrapper */}
      <div className="w-full mx-auto flex-1 flex flex-col justify-center relative min-h-0">
        <div 
          className="grid grid-cols-1 lg:grid-cols-[20%_55%_25%] items-stretch h-full min-h-0"
          style={{ gap: "var(--sidebar-gap)" }}
        >
          
          {/* LEFT COLUMN: AI Card and Webcam */}
          <div className="col-span-1 flex flex-col lg:h-full lg:min-h-0" style={{ gap: "var(--sidebar-gap)" }}>
            {leftPanel}
          </div>

          {/* CENTER COLUMN: Question, Coding Editor, Nav Buttons */}
          <div className="col-span-1 flex flex-col lg:h-full lg:min-h-0 justify-between" style={{ gap: "var(--sidebar-gap)" }}>
            {centerPanel}
          </div>

          {/* RIGHT COLUMN: Candidate Stats, Progress, Live Notes, Logs */}
          <div className="col-span-1 flex flex-col lg:h-full lg:min-h-0" style={{ gap: "var(--sidebar-gap)" }}>
            {rightPanel}
          </div>

        </div>
      </div>

      {/* Paused Overlay Screen */}
      {isPaused && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-6"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            className="glass-card max-w-sm rounded-[32px] p-8 border border-white/10 flex flex-col items-center gap-4 text-white"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center animate-pulse">
              <Play className="w-8 h-8 rotate-90" />
            </div>
            
            <h2 className="text-xl font-bold tracking-tight">
              Interview Paused
            </h2>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Your video stream, timer countdown, and conversational logs are suspended. Press resume to continue.
            </p>

            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white btn-gradient transition-all cursor-pointer shadow-md"
            >
              Resume Interview
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

export default InterviewLayout;
