import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Medal,
  Crown,
  Search,
  RotateCcw,
  Clock,
  Target,
  Users,
  ArrowRight,
  TrendingUp,
  Award,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import { formatTime } from "../../../core/utils/dateUtils.js";
import toast from "react-hot-toast";

const RANK_BADGES = [
  { rank: 1, icon: Crown, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)", label: "1st Place" },
  { rank: 2, icon: Medal, color: "#94A3B8", bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.4)", label: "2nd Place" },
  { rank: 3, icon: Medal, color: "#D97706", bg: "rgba(217, 119, 6, 0.15)", border: "rgba(217, 119, 6, 0.4)", label: "3rd Place" },
];

export default function NptelLeaderboardView({ onStartTest }) {
  const token = getAuthToken();
  const [loading, setLoading] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [search, setSearch] = useState("");

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.get("/api/nptel/leaderboard", { headers });
      if (res.data?.success) {
        setLeaderboardData(res.data.leaderboard || []);
        setCurrentUserRank(res.data.currentUserRank || null);
      }
    } catch (err) {
      console.warn("Failed to load NPTEL leaderboard:", err.message);
      toast.error("Could not load real-time leaderboard.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await api.get("/api/nptel/leaderboard", { headers });
        if (!ignore && res.data?.success) {
          setLeaderboardData(res.data.leaderboard || []);
          setCurrentUserRank(res.data.currentUserRank || null);
        }
      } catch (err) {
        console.warn("Failed to load NPTEL leaderboard:", err.message);
        if (!ignore) toast.error("Could not load real-time leaderboard.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [token]);

  const filteredList = leaderboardData.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.name?.toLowerCase().includes(q) ||
      item.department?.toLowerCase().includes(q)
    );
  });

  const topThree = leaderboardData.slice(0, 3);
  const hasLeaderboardEntries = Array.isArray(leaderboardData) && leaderboardData.length > 0;
  const topPercentage = hasLeaderboardEntries ? (leaderboardData[0]?.percentage ?? 0) : null;
  const maxPossibleScore = leaderboardData[0]?.maxScore || 120;
  const avgPercentage = hasLeaderboardEntries
    ? (leaderboardData.reduce((acc, c) => acc + (c.percentage || 0), 0) / leaderboardData.length).toFixed(1)
    : 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-2 sm:px-4 py-3 space-y-4 max-w-6xl mx-auto w-full">
      {/* ── HEADER BANNER ── */}
      <div
        className="rounded-2xl p-4 sm:p-5 border relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          background: "linear-gradient(135deg, rgba(255, 107, 53, 0.12) 0%, rgba(255, 138, 61, 0.05) 100%)",
          borderColor: "rgba(255, 107, 53, 0.3)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
            style={{
              background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
              borderColor: "#FF6B35",
              boxShadow: "0 6px 20px rgba(255, 107, 53, 0.35)",
            }}
          >
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black" style={{ color: "var(--text-primary)" }}>
                NPTEL Candidates Leaderboard
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#FF6B35]/20 text-[#FF6B35] border border-[#FF6B35]/30">
                Average % Ranking
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Official candidate standings &amp; performance benchmarks for Research Methodology
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLeaderboard}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer bg-[var(--bg-secondary)] hover:bg-[var(--card-bg)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            title="Refresh Leaderboard"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {onStartTest && (
            <button
              type="button"
              onClick={onStartTest}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-md hover:opacity-95"
              style={{
                background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                boxShadow: "0 4px 15px rgba(255, 107, 53, 0.3)",
              }}
            >
              <span>Start Test</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 rounded-xl border bg-[var(--card-bg)] flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Candidates</div>
            <div className="text-base font-black" style={{ color: "var(--text-primary)" }}>{leaderboardData.length}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl border bg-[var(--card-bg)] flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Top Average</div>
            <div className="text-base font-black text-amber-500">{hasLeaderboardEntries ? `${topPercentage}%` : "—"}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl border bg-[var(--card-bg)] flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Cohort Average</div>
            <div className="text-base font-black text-blue-400">{hasLeaderboardEntries ? `${avgPercentage}%` : "—"}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl border bg-[var(--card-bg)] flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Your Standing</div>
            <div className="text-base font-black text-emerald-400">
              {currentUserRank ? `#${currentUserRank.rank}` : "Unranked"}
            </div>
          </div>
        </div>
      </div>

      {/* ── CURRENT CANDIDATE POSITION CARD ── */}
      <div
        className="rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{
          background: currentUserRank
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)"
            : "linear-gradient(135deg, rgba(255, 107, 53, 0.08) 0%, rgba(255, 138, 61, 0.03) 100%)",
          borderColor: currentUserRank ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 107, 53, 0.25)",
        }}
      >
        {currentUserRank ? (
          <>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-white shrink-0 shadow-md"
                style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
              >
                <span className="text-[10px] leading-none uppercase">Rank</span>
                <span className="text-lg leading-tight font-black">#{currentUserRank.rank}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                    {currentUserRank.name} (You)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active Rank
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
                  <span>Average: <b className="text-emerald-400">{currentUserRank.percentage}%</b></span>
                  <span>Avg Marks: <b>{currentUserRank.score} / {currentUserRank.maxScore || maxPossibleScore}</b></span>
                  <span>Time: <b>{formatTime(currentUserRank.timeSpentSeconds)}</b></span>
                  <span>Eligible Attempts: <b>{currentUserRank.attemptsCount || 1}</b></span>
                </div>
              </div>
            </div>

            {onStartTest && (
              <button
                type="button"
                onClick={onStartTest}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition cursor-pointer self-start sm:self-center shadow-md hover:opacity-95 shrink-0"
                style={{
                  background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                }}
              >
                Retake to Improve Rank →
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 text-[#FF6B35] flex items-center justify-center shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  You don't have a ranked score yet
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Complete the unified 120-question NPTEL assignment test to benchmark yourself against other candidates.
                </p>
              </div>
            </div>

            {onStartTest && (
              <button
                type="button"
                onClick={onStartTest}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition cursor-pointer self-start sm:self-center shadow-md hover:opacity-95 shrink-0"
                style={{
                  background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                }}
              >
                Take Assignment Test Now →
              </button>
            )}
          </>
        )}
      </div>

      {/* ── TOP PODIUM (1 to 3 Real Candidates) ── */}
      {topThree.length >= 1 && (
        <div
          className={`grid gap-2.5 sm:gap-3 ${
            topThree.length === 1
              ? "grid-cols-1 max-w-md mx-auto w-full"
              : topThree.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-3"
          }`}
        >
          {topThree.map((candidate, idx) => {
            const badge = RANK_BADGES[idx] || RANK_BADGES[2];
            const Icon = badge.icon;
            const isFirst = idx === 0;

            return (
              <motion.div
                key={candidate.userId || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-4 rounded-2xl border relative overflow-hidden flex flex-col justify-between ${
                  topThree.length === 3
                    ? isFirst
                      ? "sm:order-2 sm:-translate-y-1"
                      : idx === 1
                      ? "sm:order-1"
                      : "sm:order-3"
                    : ""
                }`}
                style={{
                  background: "var(--card-bg)",
                  borderColor: badge.border,
                  boxShadow: isFirst ? "0 8px 25px rgba(245, 158, 11, 0.15)" : "none",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30"
                    >
                      {candidate.attemptsCount || 1} {candidate.attemptsCount === 1 ? "attempt" : "attempts"}
                    </span>
                    <span
                      className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      Rank #{candidate.rank}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  <h4 className="text-sm font-black truncate" style={{ color: "var(--text-primary)" }}>
                    {candidate.name}
                  </h4>
                  <p className="text-[11px] text-gray-400 truncate">{candidate.department}</p>
                </div>

                <div className="pt-2.5 border-t flex items-center justify-between text-xs font-bold" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <span className="text-base font-black" style={{ color: badge.color }}>
                      {candidate.percentage}%
                    </span>
                    <span className="text-gray-400 text-[11px]"> avg</span>
                  </div>
                  <div className="text-right text-[11px] text-gray-400">
                    <div>Avg Marks: {candidate.score} / {candidate.maxScore || maxPossibleScore}</div>
                    <div className="text-[10px] flex items-center justify-end gap-1 text-gray-400 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(candidate.timeSpentSeconds)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── SEARCH & TABLE ── */}
      <div className="p-3 sm:p-4 rounded-2xl border bg-[var(--card-bg)] flex-1 min-h-[300px] flex flex-col" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="text-xs font-bold text-gray-400 flex items-center gap-2">
            <span>Showing {filteredList.length} candidate{filteredList.length === 1 ? "" : "s"}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Live Verified Submissions
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search candidate or dept..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border bg-[var(--input-bg)] outline-none focus:border-[#FF6B35]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Empty state when zero candidates have submitted yet */}
        {leaderboardData.length === 0 && !loading ? (
          <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/15 text-[#FF6B35] flex items-center justify-center border border-orange-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-sm sm:text-base font-black" style={{ color: "var(--text-primary)" }}>
              No Candidates on the Leaderboard Yet
            </h3>
            <p className="text-xs text-gray-400 max-w-md">
              Be the first student to take the 120-question NPTEL assignment test. Your score and attempts will immediately show at Rank #1!
            </p>
            {onStartTest && (
              <button
                type="button"
                onClick={onStartTest}
                className="mt-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-md hover:opacity-95"
                style={{
                  background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                }}
              >
                <span>Start Test Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          /* Rankings Table */
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-gray-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider" style={{ borderColor: "var(--border)" }}>
                  <th className="py-2 px-2 sm:px-3">Rank</th>
                  <th className="py-2 px-2 sm:px-3">Candidate</th>
                  <th className="py-2 px-2 sm:px-3 hidden md:table-cell">Department</th>
                  <th className="py-2 px-2 sm:px-3">Average %</th>
                  <th className="py-2 px-2 sm:px-3 hidden lg:table-cell">Avg Marks</th>
                  <th className="py-2 px-2 sm:px-3 text-center hidden sm:table-cell">Eligible Attempts</th>
                  <th className="py-2 px-2 sm:px-3 hidden sm:table-cell">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {filteredList.map((cand) => {
                  const isMe = currentUserRank && String(cand.userId) === String(currentUserRank.userId);
                  const rankNum = cand.rank;

                  return (
                    <tr
                      key={cand.userId}
                      className={`transition ${isMe ? "bg-[#FF6B35]/10 font-bold" : "hover:bg-[var(--bg-secondary)]"}`}
                    >
                      <td className="py-2 px-2 sm:px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {rankNum === 1 ? (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-amber-500/20 text-amber-500 font-black text-[10px] sm:text-xs flex items-center justify-center">1</span>
                          ) : rankNum === 2 ? (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-slate-400/20 text-slate-300 font-black text-[10px] sm:text-xs flex items-center justify-center">2</span>
                          ) : rankNum === 3 ? (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-amber-700/20 text-amber-600 font-black text-[10px] sm:text-xs flex items-center justify-center">3</span>
                          ) : (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md text-gray-400 font-bold text-[10px] sm:text-xs flex items-center justify-center">#{rankNum}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-2 sm:px-3 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <div
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0"
                            style={{
                              background: isMe
                                ? "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)"
                               : "var(--border)",
                              color: isMe ? "#FFF" : "var(--text-secondary)",
                            }}
                          >
                            {cand.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold flex items-center gap-1 min-w-0 whitespace-nowrap">
                              <span
                                className="text-[11px] sm:text-xs font-bold whitespace-nowrap truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {cand.name}
                              </span>
                              {isMe && (
                                <span className="text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded bg-[#FF6B35] text-white shrink-0 leading-none">
                                  YOU
                                </span>
                              )}
                              <span className="text-[9px] text-gray-400 font-normal whitespace-nowrap truncate md:hidden">
                                · {cand.department}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2 px-2 sm:px-3 hidden md:table-cell text-gray-400 text-xs">
                        {cand.department}
                      </td>

                      {/* Average % */}
                      <td className="py-2 px-2 sm:px-3 font-bold whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-14 sm:w-16 h-1.5 rounded-full bg-[var(--border)] overflow-hidden hidden sm:block">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, cand.percentage))}%`,
                                background: cand.percentage >= 75 ? "#10B981" : cand.percentage >= 50 ? "#FF6B35" : "#EF4444",
                              }}
                            />
                          </div>
                          <span className="text-xs sm:text-sm font-black" style={{ color: isMe ? "#FF6B35" : "var(--text-primary)" }}>
                            {cand.percentage}%
                          </span>
                        </div>
                      </td>

                      {/* Avg Marks */}
                      <td className="py-2 px-2 sm:px-3 text-gray-400 whitespace-nowrap hidden lg:table-cell">
                        <span className="font-semibold text-xs" style={{ color: "var(--text-primary)" }}>{cand.score}</span>
                        <span className="text-[10px]"> / {cand.maxScore || maxPossibleScore}</span>
                      </td>

                      {/* Number of Eligible Attempts Badge */}
                      <td className="py-2 px-2 sm:px-3 text-center hidden sm:table-cell">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black border"
                          style={{
                            background: isMe ? "rgba(255, 107, 53, 0.15)" : "var(--bg-secondary)",
                            borderColor: isMe ? "rgba(255, 107, 53, 0.4)" : "var(--border)",
                            color: isMe ? "#FF6B35" : "var(--text-primary)",
                          }}
                          title={`${cand.attemptsCount || 1} eligible attempt(s)`}
                        >
                          {cand.attemptsCount || 1}
                        </span>
                      </td>

                      {/* Avg Time */}
                      <td className="py-2 px-2 sm:px-3 hidden sm:table-cell text-gray-400">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(cand.timeSpentSeconds)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-400 text-xs">
                      No candidates found matching "{search}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
