import { motion } from "framer-motion";
import { Bot, Mic, AudioLines, BrainCircuit } from "lucide-react";

/**
 * AIInterviewerCard Component
 * Displays the AI Interviewer Avatar, status, and sound wave/speech animations.
 */
function AIInterviewerCard({ status = "Speaking" }) {
  // Status configurations
  const statusConfig = {
    Listening: {
      color: "var(--success)",
      bgColor: "rgba(16, 185, 129, 0.1)",
      text: "Listening",
      icon: Mic,
    },
    Speaking: {
      color: "var(--primary)",
      bgColor: "rgba(37, 99, 235, 0.1)",
      text: "Speaking",
      icon: AudioLines,
    },
    Thinking: {
      color: "var(--accent)",
      bgColor: "rgba(20, 184, 166, 0.1)",
      text: "Thinking",
      icon: BrainCircuit,
    },
  };

  const currentStatus = statusConfig[status] || statusConfig.Speaking;
  const StatusIcon = currentStatus.icon;

  // Sound wave bar heights for speaking animation
  const waveBars = [
    { duration: 0.6, delay: 0.0 },
    { duration: 0.8, delay: 0.15 },
    { duration: 0.5, delay: 0.3 },
    { duration: 0.7, delay: 0.05 },
    { duration: 0.9, delay: 0.2 },
    { duration: 0.6, delay: 0.1 },
    { duration: 0.8, delay: 0.25 },
    { duration: 0.5, delay: 0.0 },
  ];

  return (
    <div className="glass-card rounded-[16px] p-4 flex flex-col items-center justify-between h-full w-full relative overflow-hidden">
      {/* Background Glow */}
      <div 
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[48px] pointer-events-none transition-all duration-500"
        style={{ background: currentStatus.color, opacity: 0.15 }}
      />
      
      {/* Bot Header info */}
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-[10px] lg:text-xs font-semibold tracking-wider uppercase text-muted">
          AI Interviewer
        </span>
        <span 
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] lg:text-xs font-medium border"
          style={{ 
            color: currentStatus.color, 
            borderColor: `color-mix(in srgb, ${currentStatus.color} 20%, transparent)`,
            background: currentStatus.bgColor
          }}
        >
          <StatusIcon className="w-3 h-3 animate-pulse" />
          {currentStatus.text}
        </span>
      </div>

      {/* Avatar Container */}
      <div className="relative my-2 lg:my-3 flex items-center justify-center">
        {/* Animated outer ring */}
        <AnimatePulseCircle status={status} color={currentStatus.color} />

        {/* Real Avatar Box */}
        <div 
          className="w-20 h-20 lg:w-24 lg:h-24 rounded-full flex items-center justify-center relative z-10 border-2"
          style={{ 
            background: "var(--bg-secondary)", 
            borderColor: currentStatus.color,
            boxShadow: `0 0 15px color-mix(in srgb, ${currentStatus.color} 25%, transparent)`
          }}
        >
          <Bot 
            className="w-10 h-10 lg:w-12 lg:h-12" 
            style={{ color: currentStatus.color }}
          />
        </div>
      </div>

      {/* Bot Details */}
      <div className="text-center w-full mt-1">
        <h3 className="font-semibold text-sm lg:text-base" style={{ color: "var(--text-primary)" }}>
          InterviewBot AI
        </h3>
        <p className="text-[10px] lg:text-xs text-muted">
          Gemini Pro Live Engine
        </p>
      </div>

      {/* Speech Animation Display */}
      <div className="w-full h-10 mt-3 flex items-center justify-center border-t border-dashed" style={{ borderColor: "var(--border)" }}>
        {status === "Speaking" && (
          <div className="flex items-center gap-1 h-6">
            {waveBars.map((bar, index) => (
              <motion.div
                key={index}
                className="w-1 rounded-full"
                style={{ background: "var(--primary)" }}
                animate={{
                  height: [6, 22, 6],
                }}
                transition={{
                  duration: bar.duration,
                  repeat: Infinity,
                  repeatType: "reverse",
                  delay: bar.delay,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}

        {status === "Listening" && (
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--success)" }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Waiting for reply...</span>
          </div>
        )}

        {status === "Thinking" && (
          <div className="flex items-center gap-1 h-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--accent)" }}
                animate={{
                  y: [0, -4, 0],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponent for pulse circles
function AnimatePulseCircle({ status, color }) {
  if (status !== "Speaking") {
    return (
      <div 
        className="absolute w-36 h-36 rounded-full border border-dashed animate-spin" 
        style={{ borderColor: "var(--border)", animationDuration: "12s" }}
      />
    );
  }

  return (
    <>
      <motion.div
        className="absolute w-36 h-36 rounded-full opacity-30 border"
        style={{ borderColor: color }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.05, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-44 h-44 rounded-full opacity-10 border"
        style={{ borderColor: color }}
        animate={{ scale: [1, 1.35, 1], opacity: [0.1, 0, 0.1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
    </>
  );
}

export default AIInterviewerCard;
