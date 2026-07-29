import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Activity, Wind, CheckCircle, Zap } from "lucide-react";

/**
 * CircularGauge — Mini SVG ring gauge
 */
function CircularGauge({ value, size = 48, strokeWidth = 4, color = "#2563eb" }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={progress}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="white"
      >
        {value}
      </text>
    </svg>
  );
}

/**
 * MetricBar — Animated horizontal progress bar with label
 */
function MetricBar({ label, value, maxValue = 100, color, icon: Icon, badge }) {
  const pct = Math.min(100, Math.round((value / maxValue) * 100));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3 h-3" style={{ color }} />}
          <span className="text-xs font-medium text-white/70">{label}</span>
        </div>
        {badge ? (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${color}22`, color }}
          >
            {badge}
          </span>
        ) : (
          <span className="text-[10px] font-bold" style={{ color }}>
            {value}
            {maxValue === 100 ? "%" : " wpm"}
          </span>
        )}
      </div>
      <div className="metric-track">
        <motion.div
          className="metric-fill"
          style={{ background: `linear-gradient(90deg, ${color}aa, ${color})` }}
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

/**
 * SpeakingMetrics — Real-time speaking skill evaluator panel.
 * Simulates dynamic updates while the user is actively speaking.
 *
 * Props:
 *   isListening {boolean} — triggers live simulated metric fluctuation
 *   transcript  {string}  — used to compute filler word count
 */
function SpeakingMetrics({ isListening = false, transcript = "" }) {
  // Base metric values (simulate real-time analysis)
  const [metrics, setMetrics] = useState({
    pace: 132,        // wpm
    fillerCount: 0,   // count
    clarity: 87,      // 0–100
    confidence: 74,   // 0–100
  });

  // Filler word detection from transcript
  const fillerWords = ["um", "uh", "like", "you know", "basically", "literally", "actually", "so"];
  const fillerCount = fillerWords.reduce((acc, fw) => {
    const regex = new RegExp(`\\b${fw}\\b`, "gi");
    return acc + (transcript.match(regex)?.length || 0);
  }, 0);

  // Simulated metric ticker while listening
  const intervalRef = useRef(null);
  useEffect(() => {
    if (isListening) {
      intervalRef.current = setInterval(() => {
        setMetrics((prev) => ({
          pace:       clamp(prev.pace + randomDelta(8),  80, 180),
          fillerCount: fillerCount,
          clarity:    clamp(prev.clarity + randomDelta(4), 50, 99),
          confidence: clamp(prev.confidence + randomDelta(5), 40, 98),
        }));
      }, 2200);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isListening, fillerCount]);

  const paceLabel  = metrics.pace < 120 ? "Slow" : metrics.pace < 160 ? "Good" : "Fast";
  const paceColor  = metrics.pace < 120 ? "#f59e0b" : metrics.pace < 160 ? "#10b981" : "#ef4444";
  const fillerBadge = fillerCount === 0 ? "None" : fillerCount < 3 ? "Low" : fillerCount < 6 ? "Medium" : "High";
  const fillerColor = fillerCount === 0 ? "#10b981" : fillerCount < 3 ? "#22d3ee" : fillerCount < 6 ? "#f59e0b" : "#ef4444";

  return (
    <div className="room-card rounded-2xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">
            Speaking Skills
          </span>
        </div>
        {isListening && (
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
              style={{ animation: "statusDot 1s ease-in-out infinite" }}
            />
            Live
          </span>
        )}
      </div>

      {/* Metrics Row: Clarity gauge + Confidence gauge */}
      <div className="flex items-center justify-around">
        <div className="flex flex-col items-center gap-1">
          <CircularGauge value={metrics.clarity} color="#2563eb" />
          <span className="text-[10px] text-white/50 font-medium">Clarity</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <CircularGauge value={metrics.confidence} color="#14b8a6" />
          <span className="text-[10px] text-white/50 font-medium">Confidence</span>
        </div>
      </div>

      {/* Pace bar */}
      <MetricBar
        label="Speech Pace"
        value={metrics.pace}
        maxValue={180}
        color={paceColor}
        icon={Wind}
        badge={`${paceLabel} · ${metrics.pace} wpm`}
      />

      {/* Filler Words bar */}
      <MetricBar
        label="Filler Words"
        value={Math.min(fillerCount * 10, 100)}
        maxValue={100}
        color={fillerColor}
        icon={Zap}
        badge={`${fillerBadge}${fillerCount > 0 ? ` (${fillerCount})` : ""}`}
      />
    </div>
  );
}

// Helpers
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}
function randomDelta(range) {
  return Math.floor(Math.random() * range * 2) - range;
}

export default SpeakingMetrics;
