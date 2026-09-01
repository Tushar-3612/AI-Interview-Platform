import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { timeAgo } from "../../utils/dateUtils";
import {
  History,
  Building2,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Target,
  Calendar,
  Clock,
  Timer,
  Filter,
  ArrowUpDown,
  BarChart3,
  Inbox,
  ExternalLink,
  Award,
  Percent,
  Layers,
} from "lucide-react";

const PASS_COLOR = "var(--success)";
const FAIL_COLOR = "var(--error)";

const COMPANY_COLORS = [
  "#A100FF",
  "#38BDF8",
  "#34D399",
  "#F59E0B",
  "#F472B6",
  "#818CF8",
  "#2DD4BF",
  "#FB7185",
];

// Deterministic accent color per company (presentation only — real counts/scores
// always come from the saved attempts in the database).
function companyColor(id) {
  const str = String(id || "").toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return COMPANY_COLORS[hash % COMPANY_COLORS.length];
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function fmtDateTime(value) {
  if (!value) return { date: "—", time: "—" };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { date: "—", time: "—" };
  const date = d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return { date, time };
}

function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (mins > 0) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  return `${secs}s`;
}

function ScoreBadge({ correct, total, color }) {
  return (
    <div className="flex flex-col items-center rounded-xl px-3 py-2 min-w-[64px]" style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)" }}>
      <span className="text-sm font-bold tabular-nums" style={{ color: color || "var(--text-primary)" }}>
        {correct}/{total}
      </span>
      <span className="text-[10px] uppercase tracking-wide font-bold mt-0.5" style={{ color: "var(--text-muted)" }}>score</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent, sub }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1.5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        <Icon className="w-3.5 h-3.5" style={{ color: accent || "var(--text-secondary)" }} />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-black tabular-nums leading-none" style={{ color: accent || "var(--text-primary)" }}>
        {value}
      </div>
      {sub && <div className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

export default function CompanyMockHistory() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);

  // Filters
  const [companyFilter, setCompanyFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all"); // all | passed | failed
  const [sortDir, setSortDir] = useState("newest"); // newest | oldest

  // Expand/collapse: set of companyIds currently expanded
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await api.get("/api/mock-interview/history", { headers: authHeaders });
        if (!active) return;
        setStats(data.stats || null);
        setCompanies(data.companies || []);
      } catch (err) {
        console.error("Load mock history error:", err);
        if (active) {
          setError(true);
          toast.error(err.response?.data?.message || "Failed to load mock interview history");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [authHeaders]);

  const companyList = useMemo(() => {
    // Unique companies present in the actual history (for the filter dropdown).
    return [...companies]
      .map((c) => ({ id: c.companyId, name: c.companyName }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [companies]);

  const visibleCompanies = useMemo(() => {
    const result = [...companies].filter(
      (c) => companyFilter === "all" || String(c.companyId) === String(companyFilter)
    );

    result.forEach((c) => {
      let attempts = [...c.attempts];
      if (resultFilter === "passed") attempts = attempts.filter((a) => a.passed);
      if (resultFilter === "failed") attempts = attempts.filter((a) => !a.passed);
      const sorted = [...attempts].sort((a, b) => {
        const delta = new Date(a.submittedAt || a.startedAt) - new Date(b.submittedAt || b.startedAt);
        return sortDir === "newest" ? -delta : delta;
      });
      c.filteredAttempts = sorted;
      c.filteredCount = sorted.length;
    });

    return result.filter((c) => c.filteredCount > 0);
  }, [companies, companyFilter, resultFilter, sortDir]);

  const toggleCompany = (companyId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  };

  const hasAny = !loading && !error && (companies?.length || 0) > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--admin-accent-bg)", color: "var(--primary)" }}>
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight">Mock Interview History</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Your completed Company Mock Interview attempts — grouped by company.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/mock-interview")}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)" }}
        >
          <RotateCcw className="w-4 h-4" /> New Mock Interview
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading your mock interview history…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <XCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--error)" }} />
          <p className="font-bold text-sm">Could not load your mock interview history.</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Please refresh the page and try again.</p>
        </div>
      ) : !hasAny ? (
        <div className="rounded-3xl p-12 flex flex-col items-center text-center gap-3" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
            <Inbox className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>No Mock Interviews Completed Yet</h2>
          <p className="text-sm max-w-md" style={{ color: "var(--text-secondary)" }}>
            Complete your first Company Mock Interview to see your performance history here.
          </p>
          <button
            onClick={() => navigate("/mock-interview")}
            className="mt-2 px-6 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)" }}
          >
            <Building2 className="w-4 h-4" /> Start Mock Interview
          </button>
        </div>
      ) : (
        <>
          {/* Overall statistics */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-8">
            <StatCard icon={Layers} label="Total Mocks" value={stats?.totalCompleted || 0} accent="var(--primary)" />
            <StatCard icon={CheckCircle2} label="Passed" value={stats?.totalPassed || 0} accent="var(--success)" />
            <StatCard icon={XCircle} label="Failed" value={stats?.totalFailed || 0} accent="var(--error)" />
            <StatCard icon={Trophy} label="Best Score" value={stats?.bestScore || 0} accent="#F59E0B" />
            <StatCard icon={Target} label="Avg Score" value={stats?.averageScore || 0} accent="var(--text-primary)" />
            <StatCard icon={Percent} label="Avg %" value={`${stats?.averagePercentage || 0}%`} accent="var(--primary)" />
            <StatCard icon={Award} label="Companies" value={companies.length} accent="var(--text-primary)" />
          </section>

          {/* Filters */}
          <section className="rounded-2xl p-3 mb-6 flex flex-col lg:flex-row lg:items-center gap-3" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              <Filter className="w-4 h-4" style={{ color: "var(--primary)" }} /> Filters
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Company:
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer"
                style={{ background: "var(--input-bg)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                <option value="all">All Companies</option>
                {companyList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Result:
              <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                {[{ key: "all", label: "All" }, { key: "passed", label: "Passed" }, { key: "failed", label: "Failed" }].map((o) => {
                  const isActive = resultFilter === o.key;
                  return (
                    <button
                      key={o.key}
                      onClick={() => setResultFilter(o.key)}
                      className="px-3 py-1 rounded-md text-[11px] font-bold transition-all"
                      style={{
                        color: isActive ? "#fff" : "var(--text-secondary)",
                        background: isActive ? "linear-gradient(135deg, var(--primary), var(--accent))" : "transparent",
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              <ArrowUpDown className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer"
                style={{ background: "var(--input-bg)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </section>

          {/* Company-wise cards */}
          {visibleCompanies.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <Filter className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="font-bold text-sm">No attempts match your filters.</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Try adjusting the company, result, or sort options.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleCompanies.map((c) => {
                const color = companyColor(c.companyId);
                const isExpanded = expanded.has(String(c.companyId));
                const last = fmtDateTime(c.lastAttemptedAt);
                const emptyAttempts = c.filteredAttempts.length === 0;
                return (
                  <div key={String(c.companyId)} className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}>
                    {/* Company summary card */}
                    <div
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4"
                      style={{ borderBottom: expanded ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                      onClick={() => toggleCompany(String(c.companyId))}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-sm" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, boxShadow: `0 4px 14px ${color}44` }}>
                          {initials(c.companyName)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-extrabold truncate" style={{ color: "var(--text-primary)" }}>{c.companyName}</h3>
                          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                            {c.count} Mock{c.count === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      {/* Key stats */}
                      <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2 text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Best</span>
                          <span className="font-black text-sm tabular-nums" style={{ color: "#F59E0B" }}>{c.bestScore}/{c.attempts[0]?.totalMarks ?? c.bestScore}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Latest</span>
                          <span className="font-black text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>{c.latestScore}/{c.attempts[0]?.totalMarks ?? c.latestScore}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Avg %</span>
                          <span className="font-black text-sm tabular-nums" style={{ color: "var(--primary)" }}>{c.averagePercentage}%</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Result</span>
                          <span className="font-bold text-sm">
                            <span style={{ color: PASS_COLOR }}>{c.passed} Passed</span>
                            <span style={{ color: "var(--text-muted)" }}> · </span>
                            <span style={{ color: FAIL_COLOR }}>{c.failed} Failed</span>
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Last</span>
                          <span className="font-semibold text-sm" style={{ color: "var(--text-secondary)" }}>{last.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <span className="text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                          <History className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> View History
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                        ) : (
                          <ChevronDown className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                        )}
                      </div>
                    </div>

                    {/* Expandable attempt list */}
                    {isExpanded && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                        {emptyAttempts ? (
                          <div className="rounded-xl p-6 text-center text-sm" style={{ background: "var(--input-bg)", border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
                            No attempts match the current result filter.
                          </div>
                        ) : (
                          c.filteredAttempts.map((a) => {
                            const dt = fmtDateTime(a.submittedAt || a.startedAt);
                            const pass = a.passed;                            return (
                              <div
                                key={String(a.attemptId)}
                                className="mt-3 rounded-2xl p-4 flex flex-col gap-3"
                                style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)" }}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
                                      MOCK #{String(a.attemptNumber).padStart(2, "0")}
                                    </span>
                                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{c.companyName}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full"
                                      style={{ background: pass ? "var(--badge-success-bg)" : "var(--badge-error-bg)", color: pass ? "var(--badge-success-text)" : "var(--badge-error-text)" }}
                                    >
                                      {pass ? "PASS" : "FAIL"}
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ background: "var(--admin-navy-bg)", color: "var(--admin-navy)" }}>
                                      Completed
                                    </span>
                                  </div>
                                </div>

                                {/* Attempt meta: date / time / duration */}
                                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> {dt.date}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> {dt.time}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Timer className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> {fmtDuration(a.durationSeconds)}
                                  </span>
                                  <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                                    <BarChart3 className="w-3.5 h-3.5" /> {timeAgo(a.submittedAt || a.startedAt)}
                                  </span>
                                </div>

                                {/* Section + overall scores */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <ScoreBadge correct={a.aptitudeScore.correct} total={a.aptitudeScore.total} color="#38BDF8" />
                                  <ScoreBadge correct={a.technicalScore.correct} total={a.technicalScore.total} color="#A78BFA" />
                                  <ScoreBadge correct={a.codingScore.accepted} total={a.codingScore.total} color="#34D399" />
                                  <ScoreBadge correct={a.overall} total={a.totalMarks} color={pass ? PASS_COLOR : FAIL_COLOR} />

                                  <div className="flex flex-col items-center rounded-xl px-3 py-2 min-w-[72px]" style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)" }}>
                                    <span className="text-sm font-black tabular-nums" style={{ color: pass ? "var(--success)" : "var(--error)" }}>{a.percentage}%</span>
                                    <span className="text-[10px] uppercase tracking-wide font-bold mt-0.5" style={{ color: "var(--text-muted)" }}>percentage</span>
                                  </div>
                                </div>

                                {/* View Result */}
                                <button
                                  onClick={() => navigate(`/company-mock/result/${a.attemptId}`)}
                                  className="self-end flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white mt-1"
                                  style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)" }}
                                >
                                  View Result <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
