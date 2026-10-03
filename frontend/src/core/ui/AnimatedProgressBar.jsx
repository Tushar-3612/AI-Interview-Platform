import { useEffect, useRef, useState } from "react";

/**
 * Premium animated progress bar with glowing endpoint indicator.
 * The glow/pulse animation is anchored to the current progress percentage.
 */
export default function AnimatedProgressBar({
  score = 0,
  color = "#FF6B35",
  height = 10,
  showEndpoint = true,
}) {
  const [mounted, setMounted] = useState(false);
  const barRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const clamped = Math.max(0, Math.min(100, score));
  const filledWidth = mounted ? `${clamped}%` : "0%";

  return (
    <div className="relative w-full" style={{ height: height + 12 }}>
      {/* Track */}
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full overflow-hidden"
        style={{
          height,
          background: "var(--border)",
        }}
      >
        {/* Filled bar */}
        <div
          ref={barRef}
          className="h-full rounded-full relative"
          style={{
            width: filledWidth,
            background: `linear-gradient(90deg, ${color}CC, ${color})`,
            boxShadow: `0 0 12px ${color}55, 0 2px 8px ${color}33`,
            transition: "width 800ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Inner highlight strip */}
          <div
            className="absolute inset-x-0 top-0 rounded-full"
            style={{
              height: "40%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)",
            }}
          />
        </div>
      </div>

      {/* Animated glowing endpoint dot */}
      {showEndpoint && clamped > 0 && (
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{
            left: filledWidth,
            transition: "left 800ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Outer pulse ring */}
          <div
            className="absolute rounded-full"
            style={{
              width: 28,
              height: 28,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: `${color}22`,
              animation: "endpointPulse 2.4s ease-in-out infinite",
            }}
          />
          {/* Glow halo */}
          <div
            className="absolute rounded-full"
            style={{
              width: 20,
              height: 20,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: `${color}33`,
              filter: `blur(4px)`,
              animation: "endpointGlow 2s ease-in-out infinite alternate",
            }}
          />
          {/* Solid dot */}
          <div
            className="relative rounded-full"
            style={{
              width: 14,
              height: 14,
              background: `radial-gradient(circle at 40% 35%, ${color}, ${color}DD)`,
              boxShadow: `0 0 8px ${color}88, 0 0 16px ${color}44`,
              border: "2px solid rgba(255,255,255,0.3)",
            }}
          />
        </div>
      )}

      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes endpointPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          50% { transform: translate(-50%, -50%) scale(1.35); opacity: 0.15; }
        }
        @keyframes endpointGlow {
          0% { opacity: 0.5; filter: blur(3px); }
          100% { opacity: 1; filter: blur(6px); }
        }
      `}</style>
    </div>
  );
}
