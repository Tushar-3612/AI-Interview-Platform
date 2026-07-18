import { useState, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, ShieldCheck, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

/**
 * MicrophoneControls Component
 * Manages audio toggle settings and displays a live fluctuating mic input volume meter.
 */
function MicrophoneControls({
  micOn = true,
  speakerOn = true,
  noiseReductionOn = false,
  onToggleMic,
  onToggleSpeaker,
  onToggleNoiseReduction,
}) {
  const [volLevel, setVolLevel] = useState(0);

  // Simulate volume fluctuation when microphone is active
  useEffect(() => {
    let timer;
    if (micOn) {
      timer = setInterval(() => {
        // Random volume fluctuation between 5% and 85% to look realistic
        const randomVol = Math.floor(Math.random() * 80) + 5;
        setVolLevel(randomVol);
      }, 150);
    } else {
      setVolLevel(0);
    }

    return () => clearInterval(timer);
  }, [micOn]);

  return (
    <div className="glass-card rounded-[24px] p-6 space-y-5">
      <h3 className="font-semibold text-sm tracking-wide uppercase text-muted">
        Audio Configuration
      </h3>

      {/* Control buttons */}
      <div className="grid grid-cols-3 gap-2">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={() => {
            onToggleMic?.();
            toast(micOn ? "Microphone muted" : "Microphone active");
          }}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs gap-1.5 transition-all cursor-pointer ${
            micOn
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400"
          }`}
        >
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          <span>{micOn ? "Mic On" : "Mic Muted"}</span>
        </button>

        {/* Speaker Toggle */}
        <button
          type="button"
          onClick={() => {
            onToggleSpeaker?.();
            toast(speakerOn ? "Speaker muted" : "Speaker active");
          }}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs gap-1.5 transition-all cursor-pointer ${
            speakerOn
              ? "bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400"
          }`}
        >
          {speakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          <span>{speakerOn ? "Audio On" : "Audio Off"}</span>
        </button>

        {/* Noise Reduction Toggle */}
        <button
          type="button"
          onClick={() => {
            onToggleNoiseReduction?.();
            toast(noiseReductionOn ? "Noise isolation disabled" : "Smart noise isolation enabled");
          }}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs gap-1.5 transition-all cursor-pointer ${
            noiseReductionOn
              ? "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900 text-sky-600 dark:text-sky-400"
              : "bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
          }`}
        >
          {noiseReductionOn ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5 text-slate-400" />}
          <span>Noise Red.</span>
        </button>
      </div>

      {/* Volume meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Mic Input Level</span>
          <span>{micOn ? `${volLevel}%` : "Muted"}</span>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden relative border border-slate-200/50 dark:border-zinc-700/50">
          <div 
            className="h-full rounded-full transition-all duration-150 ease-out"
            style={{ 
              width: `${volLevel}%`,
              background: volLevel > 75 
                ? "linear-gradient(90deg, var(--success) 0%, var(--error) 100%)" 
                : "var(--success)"
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MicrophoneControls;
