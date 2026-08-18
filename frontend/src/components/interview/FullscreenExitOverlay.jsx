import React from "react";
import { ShieldAlert, Maximize2 } from "lucide-react";

/**
 * FullscreenExitOverlay — Professional blocking overlay displayed
 * when a candidate exits fullscreen mode during a real interview session.
 */
function FullscreenExitOverlay({ isOpen, onReenterFullscreen }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none"
      style={{
        background: "rgba(5, 6, 9, 0.96)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div
        className="max-w-md w-full p-6 rounded-3xl text-center flex flex-col items-center gap-4"
        style={{
          background: "linear-gradient(145deg, #0e1222 0%, #070913 100%)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          boxShadow: "0 0 50px rgba(239, 68, 68, 0.2)",
        }}
      >
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Interview Paused
          </h2>
          <p className="text-xs text-white/70 mt-2 leading-relaxed">
            Fullscreen mode is required to maintain interview integrity and prevent security penalties. Please return to fullscreen mode to continue your session.
          </p>
        </div>

        <button
          onClick={onReenterFullscreen}
          className="w-full py-3.5 px-6 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            boxShadow: "0 4px 20px rgba(37, 99, 235, 0.4)",
          }}
        >
          <Maximize2 className="w-4 h-4" />
          <span>Return to Fullscreen</span>
        </button>

        <p className="text-[10px] text-white/30 font-mono">
          Session progress & current question preserved
        </p>
      </div>
    </div>
  );
}

export default FullscreenExitOverlay;
