import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import {
  Trophy,
  Building2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  RotateCcw,
  Home,
  ChevronDown,
  ChevronRight,
  FileText,
  Code2,
} from "lucide-react";

const STATUS_COLORS = {
  correct: "var(--success)",
  wrong: "var(--error)",
  skipped: "#F59E0B",
};

const SECTION_META = {
  aptitude: { label: "Aptitude", color: "#38BDF8", total: 15 },
  technical: { label: "Technical", color: "#A78BFA", total: 15 },
  coding: { label: "Coding", color: "#34D399", total: 3 },
};

export default function CompanyMockResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [openCards, setOpenCards] = useState(() => new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/api/mock-interview/result/${attemptId}`, { headers: authHeaders });
        setResult(data.result);
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "Failed to load result");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const { overall, maxScore, percentage, passed, stats, review, answered, maxTotal, perSection } = useMemo(() => {
    if (!result) return {};
    const s = result.scores || {};
    const apt = s.aptitude || {};
    const tech = s.technical || {};
    const cod = s.coding || {};
    const maxTotal = s.totalMarks ?? (apt.total || 0) + (tech.total || 0) + (cod.total || 0);
    const percentage = s.percentage ?? (maxTotal ? Math.round((s.overall / maxTotal) * 100 * 100) / 100 : 0);
    const passed = s.passed ?? percentage >= 40;

    const review = {
      aptitude: result.review?.aptitude || [],
      technical: result.review?.technical || [],
      coding: result.review?.coding || [],
    };

    const answered = [...review.aptitude, ...review.technical, ...review.coding].filter(
      (q) => q.status !== "skipped" && q.status !== "not_attempted"
    ).length;

    return {
      overall: s.overall ?? 0,
      maxScore: s.totalMarks ?? maxTotal,
      percentage,
      passed,
      maxTotal,
      answered,
      review,
      stats: {
        aptitude: {
          correct: apt.correct ?? 0,
          wrong: apt.wrong ?? 0,
          skipped: apt.skipped ?? 0,
          total: apt.total ?? 15,
        },
        technical: {
          correct: tech.correct ?? 0,
          wrong: tech.wrong ?? 0,
          skipped: tech.skipped ?? 0,
          total: tech.total ?? 15,
        },
        coding: {
          correct: cod.accepted ?? 0,
          wrong: Math.max(0, (cod.attempted ?? 0) - (cod.accepted ?? 0)),
          skipped: Math.max(0, (cod.total ?? 3) - (cod.attempted ?? 0)),
          total: cod.total ?? 3,
        },
      },
      perSection: {
        aptitude: { score: apt.correct ?? 0, total: apt.total ?? 15 },
        technical: { score: tech.correct ?? 0, total: tech.total ?? 15 },
        coding: { score: cod.accepted ?? 0, total: cod.total ?? 3 },
      },
    };
  }, [result]);

  const reviewItems = useMemo(() => {
    const items = [];
    (review?.aptitude || []).forEach((q) => items.push({ ...q, section: "aptitude" }));
    (review?.technical || []).forEach((q) => items.push({ ...q, section: "technical" }));
    (review?.coding || []).forEach((q) => items.push({ ...q, section: "coding" }));
    return items;
  }, [review]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--primary)" }} />
        <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>Loading result…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <p className="text-lg">Result not found.</p>
        <button onClick={() => navigate("/mock-interview")} className="mt-4 px-6 py-2 rounded-lg text-white" style={{ background: "var(--primary)" }}>
          Back to Mock Interview
        </button>
      </div>
    );
  }

  const toggleCard = (key) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredItems = activeTab === "all" ? reviewItems : reviewItems.filter((q) => q.section === activeTab);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--admin-accent-bg)", color: "var(--primary)" }}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold">{result.companyName} Mock Interview</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Result Summary</p>
            </div>
          </div>
          <span
            className="px-4 py-1.5 rounded-full text-sm font-bold"
            style={{ background: passed ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: passed ? "var(--success)" : "var(--error)", border: `1px solid ${passed ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}` }}
          >
            {passed ? "PASS" : "FAIL"}
          </span>
        </div>

        {/* Overall hero card */}
        <div className="rounded-3xl p-6 md:p-8 mb-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, var(--bg-secondary) 0%, var(--card-bg) 100%)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div
              className="w-28 h-28 rounded-full flex flex-col items-center justify-center shrink-0 border-4"
              style={{ borderColor: passed ? "var(--success)" : "var(--error)", background: "var(--bg-primary)", boxShadow: `0 0 30px ${passed ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}` }}
            >
              <span className="text-3xl font-black">{percentage}%</span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Overall</span>
            </div>
            <div className="text-center md:text-left flex-1">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                <Trophy className="w-5 h-5" style={{ color: "var(--primary)" }} />
                <span className="text-2xl font-bold">{overall} / {maxScore}</span>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                You answered {answered} out of {maxTotal} questions.
              </p>
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(0, Math.min(100, percentage))}%`, background: `linear-gradient(90deg, ${passed ? "#10B981" : "#EF4444"}, ${passed ? "#34D399" : "#F87171"})` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <SectionCard meta={SECTION_META.aptitude} stats={stats?.aptitude} score={perSection?.aptitude?.score} />
          <SectionCard meta={SECTION_META.technical} stats={stats?.technical} score={perSection?.technical?.score} />
          <SectionCard meta={SECTION_META.coding} stats={stats?.coding} score={perSection?.coding?.score} />
          <SectionCard meta={{ label: "Overall", color: "var(--primary)", total: maxTotal }} stats={{ correct: overall, total: maxTotal }} score={overall} percentage showResult={passed} />
        </div>

        {/* Final summary strip */}
        <div className="rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-2" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Final Result:</span>{" "}
            <span className="font-bold" style={{ color: passed ? "var(--success)" : "var(--error)" }}>{passed ? "PASS" : "FAIL"}</span>
          </div>
          <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            You scored {overall}/{maxTotal} ({percentage}%)
          </div>
        </div>

        {/* Question Review */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: "var(--primary)" }} />
            Question Review
          </h2>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[{ key: "all", label: "All" }, { key: "aptitude", label: "Aptitude" }, { key: "technical", label: "Technical" }, { key: "coding", label: "Coding" }].map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tab.key === "all" ? reviewItems.length : reviewItems.filter((q) => q.section === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold border transition-all"
                  style={{
                    color: isActive ? "#fff" : "var(--text-secondary)",
                    background: isActive ? `linear-gradient(135deg, ${SECTION_META[tab.key]?.color || "var(--primary)"} 0%, ${SECTION_META[tab.key]?.color || "var(--primary)"}dd 100%)` : "var(--card-bg)",
                    borderColor: isActive ? SECTION_META[tab.key]?.color || "var(--primary)" : "var(--border)",
                  }}
                >
                  {tab.label} <span className="opacity-90">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} /> Correct</span>
            <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" style={{ color: "var(--error)" }} /> Wrong</span>
            <span className="flex items-center gap-1.5"><MinusCircle className="w-4 h-4" style={{ color: "#F59E0B" }} /> Skipped</span>
          </div>

          {/* Cards */}
          {filteredItems.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>No questions in this section.</p>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((q) => (
                <ReviewCard
                  key={`${q.section}-${q.qn}-${q.answerKey || q.qn}`}
                  q={q}
                  isOpen={openCards.has(`${q.section}-${q.qn}`)}
                  onToggle={() => toggleCard(`${q.section}-${q.qn}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer summary + actions */}
        <div className="rounded-2xl p-5 text-center mb-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <p className="text-xl font-bold">You scored {overall}/{maxTotal} ({percentage}%)</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate("/mock-interview")}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)" }}
          >
            <RotateCcw className="w-4 h-4" /> New Mock
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            <Home className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ meta, stats, score, percentage, showResult }) {
  const isCoding = meta.label === "Coding";
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</span>
        {meta.label === "Overall" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: showResult ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: showResult ? "var(--success)" : "var(--error)" }}>
            {showResult ? "PASS" : "FAIL"}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{score}</span>
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}> / {stats?.total ?? meta.total}</span>
      </div>
      {meta.label !== "Overall" && stats && (
        <div className="flex items-center gap-3 text-xs mt-1 flex-wrap" style={{ color: "var(--text-secondary)" }}>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--success)" }} /> {stats.correct} correct</span>
          <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" style={{ color: "var(--error)" }} /> {stats.wrong ?? 0} wrong</span>
          <span className="flex items-center gap-1"><MinusCircle className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} /> {stats.skipped ?? 0} skipped</span>
        </div>
      )}
      {meta.label === "Overall" && (
        <div className="text-sm font-bold mt-1 flex items-center gap-1" style={{ color: "var(--primary)" }}>
          <Trophy className="w-4 h-4" /> {percentage}%
        </div>
      )}
      {isCoding && (
        <div className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
          <Code2 className="w-3.5 h-3.5" style={{ color: meta.color }} /> {stats.correct} solved of {stats.total}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ q, isOpen, onToggle }) {
  const meta = SECTION_META[q.section];
  const statusLabel =
    q.status === "correct" ? "Correct" : q.status === "wrong" ? "Wrong" : q.status === "not_attempted" ? "Not Attempted" : "Skipped";
  const statusColor = STATUS_COLORS[q.status] || "var(--text-muted)";

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:opacity-90 transition-opacity"
        style={{ background: "transparent", color: "var(--text-primary)" }}
      >
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `color-mix(in srgb, ${meta.color} 18%, transparent)`, color: meta.color }}>
          {q.qn}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide shrink-0" style={{ color: meta.color }}>{meta.label}</span>
        <span className="flex-1 min-w-0 text-sm truncate">{q.question || q.title || "Question"}</span>
        <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `color-mix(in srgb, ${statusColor} 14%, transparent)`, color: statusColor }}>
          {statusLabel}
        </span>
        {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: "var(--border)" }}>
          {q.section === "coding" ? (
            <CodingDetail q={q} />
          ) : (
            <McqDetail q={q} />
          )}
        </div>
      )}
    </div>
  );
}

function McqDetail({ q }) {
  const typeLabel = q.section === "technical" ? "Technical" : "Aptitude";
  return (
    <div className="space-y-3 pt-3">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>{typeLabel} Question</div>
        <p className="text-sm leading-relaxed">{q.question}</p>
      </div>

      {q.options && q.options.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Options</div>
          {q.options.map((opt, i) => {
            const isUser = q.selectedOption === opt;
            const isCorrectOpt = String(opt) === String(q.correctAnswer);
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm"
                style={{
                  background: isCorrectOpt ? "rgba(16,185,129,0.10)" : isUser && q.status === "wrong" ? "rgba(239,68,68,0.10)" : "var(--bg-secondary)",
                  border: `1px solid ${isCorrectOpt ? "rgba(16,185,129,0.5)" : isUser && q.status === "wrong" ? "rgba(239,68,68,0.5)" : "var(--border)"}`,
                }}
              >
                <span>{opt}</span>
                <span className="flex items-center gap-1 text-[10px] shrink-0">
                  {isCorrectOpt && <span className="flex items-center gap-1 font-bold" style={{ color: "var(--success)" }}><CheckCircle2 className="w-3.5 h-3.5" /> Correct</span>}
                  {isUser && !isCorrectOpt && <span className="flex items-center gap-1 font-bold" style={{ color: "var(--error)" }}><XCircle className="w-3.5 h-3.5" /> Your answer</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-1">
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <span className="text-xs font-bold uppercase tracking-wide block" style={{ color: "var(--text-muted)" }}>Your Answer</span>
          <span style={{ color: q.status === "correct" ? "var(--success)" : q.status === "wrong" ? "var(--error)" : "var(--text-muted)" }}>
            {q.status === "skipped" ? "Skipped" : q.selectedOption || "—"}
          </span>
        </div>
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <span className="text-xs font-bold uppercase tracking-wide block" style={{ color: "var(--text-muted)" }}>Correct Answer</span>
          <span style={{ color: "var(--success)" }}>{q.correctAnswer || "—"}</span>
        </div>
      </div>
    </div>
  );
}

function CodingDetail({ q }) {
  const statusLabel =
    q.status === "accepted"
      ? "Accepted"
      : q.status === "compile_error"
        ? "Compilation Error"
        : q.status === "not_attempted"
          ? "Not Attempted"
          : "Failed";
  const statusColor =
    q.status === "accepted" ? "var(--success)" : q.status === "not_attempted" ? "#F59E0B" : "var(--error)";

  return (
    <div className="space-y-3 pt-3">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Coding Problem {q.qn}</div>
        <p className="text-sm font-semibold">{q.title}</p>
        {q.description && <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{q.description}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatTile label="Status" value={statusLabel} color={statusColor} />
        <StatTile label="Language" value={q.language || "—"} />
        <StatTile label="Score" value={q.scoreText || "0/1"} color={q.score === 1 ? "var(--success)" : "var(--error)"} />
        <StatTile label="Test Cases" value={`${q.passedCount}/${q.totalCount}`} color={q.status === "accepted" ? "var(--success)" : "var(--error)"} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Execution Time" value={q.executionTimeMs ? `${q.executionTimeMs} ms` : "—"} />
        <StatTile label="Memory" value="—" />
      </div>

      {q.code && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Submitted Code</div>
          <pre className="rounded-xl p-4 text-xs overflow-auto max-h-64" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {q.code}
          </pre>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, color }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-sm font-semibold truncate" style={{ color: color || "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
