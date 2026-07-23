import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Camera, CameraOff, MonitorUp,
  Settings, PhoneOff, Wifi, Bot, Volume2, VolumeX
} from "lucide-react";
import AudioVisualizer from "../interview/AudioVisualizer";

/**
 * NetworkStrength — Animated signal bar indicator
 */
function NetworkStrength({ level = 4 }) {
  const bars = [1, 2, 3, 4];
  return (
    <div className="flex items-end gap-0.5" aria-label={`Network: ${level}/4 bars`}>
      {bars.map((b) => (
        <div
          key={b}
          style={{
            width: "3px",
            height: `${b * 4 + 4}px`,
            borderRadius: "1px",
            backgroundColor:
              b <= level
                ? b <= 1 ? "#ef4444" : b <= 2 ? "#f59e0b" : "#10b981"
                : "rgba(255,255,255,0.15)",
            transition: "background-color 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

/**
 * ControlButton — Bottom action bar icon button
 */
function ControlButton({ icon: Icon, label, onClick, active = true, danger = false, disabled = false, pulse = false, id }) {
  const bgColor = danger
    ? active ? "rgba(239,68,68,0.85)" : "rgba(239,68,68,0.15)"
    : active
      ? "rgba(255,255,255,0.08)"
      : "rgba(239,68,68,0.2)";

  const iconColor = danger
    ? active ? "#ffffff" : "#f87171"
    : active ? "#e5e7eb" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        id={id}
        onClick={onClick}
        disabled={disabled}
        title={label}
        className="relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
        style={{ background: bgColor, border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {pulse && (
          <span
            className="absolute inset-0 rounded-2xl ptl-ring"
            style={{ background: "rgba(239,68,68,0.3)" }}
          />
        )}
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </button>
      <span className="text-[10px] font-medium text-white/35">{label}</span>
    </div>
  );
}

/**
 * InterviewLayout — Full-screen dark video call room layout.
 *
 * Props:
 *   headerProps  { timerSeconds, totalSeconds, interviewType, networkLevel }
 *   controlProps { isMicOn, isCameraOn, isListening, onToggleMic, onToggleCamera, onEndInterview, onSettings }
 *   isPaused     {boolean}
 *   onResume     {function}
 *   leftPanel    {ReactNode}  — AI avatar stage (70%)
 *   rightPanel   {ReactNode}  — user cam + transcript + metrics (30%)
 *   centerPanel  {ReactNode}  — preserved for backwards compat / code editor
 */
function InterviewLayout({
  headerProps = {},
  controlProps = {},
  isPaused,
  onResume,
  leftPanel,
  rightPanel,
  centerPanel,
}) {
  const {
    timerSeconds = 0,
    totalSeconds = 1800,
    interviewType = "Software Engineer",
    networkLevel = 4,
  } = headerProps;

  const {
    isMicOn,
    isCameraOn,
    isSpeakerOn = true,
    isListening,
    onToggleMic,
    onToggleCamera,
    onShareScreen,
    onSettings,
    onEndInterview,
    onPushToTalk,
    onToggleSpeaker,
  } = controlProps;

  const m = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
  const s = (timerSeconds % 60).toString().padStart(2, "0");
  const isTimerLow = timerSeconds < 300;
  const timerPct = (timerSeconds / totalSeconds) * 100;

  return (
    <div
      className="w-screen h-screen overflow-hidden flex flex-col"
      style={{ background: "#050609", fontFamily: "Poppins, system-ui, sans-serif" }}
    >

      {/* ═══════════════════════════════════════════
          TOP HEADER BAR
      ═══════════════════════════════════════════ */}
      <header
        className="shrink-0 h-[60px] flex items-center px-6 gap-4"
        style={{
          background: "rgba(8, 10, 18, 0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Left — Logo + Interview type */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #2563eb, #14b8a6)" }}
          >
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:flex flex-col min-w-0">
            <span className="text-[10px] font-semibold text-white/35 uppercase tracking-widest leading-tight">
              Interview in Progress
            </span>
            <span className="text-[13px] font-bold text-white truncate leading-tight">
              {interviewType}
            </span>
          </div>
        </div>

        {/* Center — countdown timer */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div
            className="font-mono text-2xl font-bold tabular-nums"
            style={{
              color: isTimerLow ? "#ef4444" : "#f1f5f9",
              animation: isTimerLow ? "statusDot 1s ease-in-out infinite" : "none",
            }}
          >
            {m}:{s}
          </div>
          {/* Thin timer progress bar */}
          <div className="w-32 h-0.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${timerPct}%`,
                background: isTimerLow
                  ? "linear-gradient(90deg, #ef4444, #f87171)"
                  : "linear-gradient(90deg, #2563eb, #14b8a6)",
              }}
            />
          </div>
        </div>

        {/* Right — Network + Paused banner + End button */}
        <div className="flex items-center gap-4">
          {isPaused && (
            <button
              onClick={onResume}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-amber-300 cursor-pointer"
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              ▶ Resume
            </button>
          )}

          {/* REC + Network */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-white/30" />
              <NetworkStrength level={networkLevel} />
            </div>
          </div>

          {/* End Interview */}
          <button
            id="btn-end-interview"
            onClick={onEndInterview}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #dc2626, #b91c1c)",
              boxShadow: "0 0 20px rgba(220,38,38,0.35)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">End Interview</span>
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════
          MAIN STAGE
      ═══════════════════════════════════════════ */}
      <div className="flex-1 flex min-h-0 p-3 gap-3">

        {/* LEFT: AI Avatar + (optional) center content stacked */}
        <div className="flex flex-col flex-1 min-w-0 gap-3">
          {/* AI Stage — full height when no centerPanel, or 65% */}
          <div className={`${centerPanel ? "h-[62%]" : "flex-1"} min-h-0`}>
            {leftPanel}
          </div>

          {/* Center panel (code editor / question card) if provided */}
          {centerPanel && (
            <div className="flex-1 min-h-0">
              {centerPanel}
            </div>
          )}
        </div>

        {/* RIGHT: 30% sidebar */}
        <div
          className="w-[30%] shrink-0 flex flex-col min-h-0 min-w-[280px] max-w-[380px] overflow-y-hidden"
        >
          {rightPanel}
        </div>


      </div>

      {/* ═══════════════════════════════════════════
          BOTTOM ACTION BAR
      ═══════════════════════════════════════════ */}
      <footer
        className="shrink-0 h-[84px] flex items-center justify-center gap-6 px-6"
        style={{
          background: "rgba(8, 10, 18, 0.95)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        <ControlButton
          id="btn-toggle-mic"
          icon={isMicOn ? Mic : MicOff}
          label={isMicOn ? "Mute" : "Unmuted"}
          active={isMicOn}
          onClick={onToggleMic}
        />

        <ControlButton
          id="btn-toggle-camera"
          icon={isCameraOn ? Camera : CameraOff}
          label={isCameraOn ? "Camera" : "Camera Off"}
          active={isCameraOn}
          onClick={onToggleCamera}
        />

        {/* Mute / Unmute Chatbot voice */}
        <ControlButton
          id="btn-toggle-speaker"
          icon={isSpeakerOn ? Volume2 : VolumeX}
          label={isSpeakerOn ? "Bot Audio" : "Bot Muted"}
          active={isSpeakerOn}
          onClick={onToggleSpeaker}
        />

        {/* Push-to-Talk — center, larger */}
        <div className="flex flex-col items-center gap-1.5 relative">
          <button
            id="btn-push-to-talk"
            onClick={onPushToTalk}
            className="relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
            style={{
              background: isListening
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : "linear-gradient(135deg, #2563eb, #14b8a6)",
              boxShadow: isListening
                ? "0 0 24px rgba(239,68,68,0.5)"
                : "0 0 24px rgba(37,99,235,0.4)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {isListening && (
              <span
                className="absolute inset-0 rounded-2xl ptl-ring"
                style={{ background: "rgba(239,68,68,0.35)" }}
              />
            )}
            <Mic className="w-6 h-6 text-white" />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-bold text-white/50">
              {isListening ? "Speaking…" : "Push to Talk"}
            </span>
            {isListening && (
              <AudioVisualizer
                isActive={true}
                barCount={8}
                color="rgba(239,68,68,0.4)"
                activeColor="#f87171"
                height="12px"
              />
            )}
          </div>
        </div>


        <ControlButton
          id="btn-settings"
          icon={Settings}
          label="Settings"
          active={true}
          onClick={onSettings}
        />

        {/* Spacer so the layout is symmetric */}
        <div className="w-[52px]" />
      </footer>
    </div>
  );
}

export default InterviewLayout;
