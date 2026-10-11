import { useNavigate } from "react-router-dom";
import { ChevronLeft, GraduationCap } from "lucide-react";
import NptelLeaderboardView from "../components/NptelLeaderboardView.jsx";
import { NPTEL_THEME } from "../data/nptelData.js";

export default function NptelLeaderboardPage() {
  const navigate = useNavigate();

  return (
    <div className="h-[calc(100vh-4.25rem)] max-h-[calc(100vh-4.25rem)] overflow-hidden flex flex-col px-2 sm:px-4 py-2 w-full max-w-[1400px] mx-auto">
      {/* ── BACK HEADER ── */}
      <div
        className="shrink-0 flex items-center justify-between gap-2 mb-2 pb-2 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            id="nptel-lb-back-btn"
            onClick={() => navigate("/nptel-assignment")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition hover:bg-[var(--bg-secondary)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center border shrink-0"
            style={{
              background: NPTEL_THEME.bgSubtle,
              borderColor: NPTEL_THEME.border,
              color: NPTEL_THEME.primary,
            }}
          >
            <GraduationCap className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
              NPTEL Leaderboard
            </div>
            <p className="hidden md:block text-[11px]" style={{ color: "var(--text-muted)" }}>
              Candidate rankings &amp; performance benchmarks for Research Methodology
            </p>
          </div>
        </div>

        <button
          type="button"
          id="nptel-lb-start-test-btn"
          onClick={() => navigate("/nptel-assignment/test")}
          className="px-4 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer transition hover:opacity-95 shadow-md flex items-center gap-1.5 shrink-0"
          style={{ background: NPTEL_THEME.gradient, boxShadow: NPTEL_THEME.glow }}
        >
          Start Test
        </button>
      </div>

      {/* ── LEADERBOARD VIEW ── */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
        <NptelLeaderboardView
          onStartTest={() => navigate("/nptel-assignment/test")}
        />
      </div>
    </div>
  );
}
