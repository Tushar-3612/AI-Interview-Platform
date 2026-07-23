import React from "react";

/**
 * AudioVisualizer — Animated bar-based audio waveform.
 * Uses pure CSS animation via the `.audio-bar` and `.audio-bar.active` classes
 * defined in globals.css.
 *
 * Props:
 *   isActive   {boolean} — whether to animate
 *   barCount   {number}  — number of bars (default 14)
 *   color      {string}  — CSS color for bars (default electric blue)
 *   height     {string}  — container height in px (default "32px")
 *   className  {string}  — extra classes for wrapper div
 */
function AudioVisualizer({
  isActive = false,
  barCount = 14,
  color = "#2563eb",
  activeColor,
  height = "32px",
  className = "",
}) {
  // Generate staggered timing for organic feel
  const bars = Array.from({ length: barCount }, (_, i) => {
    // Vary duration and delay per bar for natural look
    const durations = [0.6, 0.75, 0.55, 0.9, 0.65, 0.8, 0.5, 0.7, 0.85, 0.6, 0.72, 0.58, 0.78, 0.65];
    const delays    = [0, 0.12, 0.24, 0.08, 0.32, 0.18, 0.4, 0.06, 0.28, 0.15, 0.36, 0.22, 0.44, 0.1];
    return {
      dur:   `${durations[i % durations.length]}s`,
      delay: `${delays[i % delays.length]}s`,
    };
  });

  const resolvedActive = activeColor || color;

  return (
    <div
      className={`audio-visualizer ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      {bars.map((bar, i) => (
        <span
          key={i}
          className={`audio-bar${isActive ? " active" : ""}`}
          style={{
            backgroundColor: isActive ? resolvedActive : color,
            opacity: isActive ? 0.9 : 0.3,
            "--bar-dur": bar.dur,
            "--bar-delay": bar.delay,
          }}
        />
      ))}
    </div>
  );
}

export default AudioVisualizer;
