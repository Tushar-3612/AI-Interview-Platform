import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Timer,
  Play,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Code2,
  BrainCircuit,
  Flag,
  ChevronLeft,
  ChevronRight,
  Building2,
  History,
  Terminal,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import useCachedApi from "../../hooks/useCachedApi";
import { formatTime } from "../../utils/dateUtils";

const LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "kotlin", label: "Kotlin" },
  { id: "php", label: "PHP" },
];

const STARTER = `function solution(...args) {
  // Write your solution here
  
}`;

function CompanyPicker({ onSelect }) {
  const { data, loading } = useCachedApi({ url: "/api/placement/companies", key: "mock:companies", ttlMs: 5 * 60 * 1000 });
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center pt-6">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black" style={{ color: "var(--text-primary)" }}>Mock Online Assessment</h1>
        <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          Pick a company and experience a realistic timed OA — aptitude + coding, exactly like the real drive.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 w-full rounded-2xl" />)}
        {data?.companies?.map((c) => (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
            onClick={() => onSelect(c.id)}
            className="rounded-2xl border p-5 text-left cursor-pointer transition-all"
            style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black text-white" style={{ background: c.color || "var(--primary)" }}>
                {c.name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>60 min · 15 aptitude + 2 coding</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                Real exam experience
              </span>
              <Play className="w-4 h-4" style={{ color: "var(--primary)" }} />
            </div>
          </motion.button>
        ))}
      </div>

      <div className="text-center">
        <button onClick={() => navigate("/placement-dashboard")} className="text-xs font-bold cursor-pointer hover:underline" style={{ color: "var(--text-secondary)" }}>
          ← Back to dashboard
        </button>
      </div>
    </div>
  );
}

function ResultScreen({ result, onRetry, onDashboard }) {
  return (
    <div className="max-w-2xl mx-auto pt-8 space-y-6">
      <div className="text-center">
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${result.overallScore >= 60 ? "" : ""}`} style={{ background: result.overallScore >= 60 ? "color-mix(in srgb, var(--success) 12%, transparent)" : "color-mix(in srgb, var(--error) 12%, transparent)" }}>
          {result.overallScore >= 60 ? <CheckCircle2 className="w-10 h-10" style={{ color: "var(--success)" }} /> : <AlertTriangle className="w-10 h-10" style={{ color: "var(--error)" }} />}
        </div>
        <h1 className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
          {result.overallScore}%
        </h1>
        <p className="text-sm mt-1 font-semibold" style={{ color: "var(--text-secondary)" }}>
          {result.overallScore >= 85 ? "Outstanding! You're ready for this company." : result.overallScore >= 60 ? "Good attempt — keep pushing!" : "Keep practicing — you're getting there."}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {result.companyName} Mock OA · completed in {formatTime(result.timeTakenSec)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <BrainCircuit className="w-3.5 h-3.5" /> Aptitude
          </p>
          <p className="text-2xl font-black" style={{ color: "var(--primary)" }}>{result.aptitude.percentage}%</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            {result.aptitude.correct} correct · {result.aptitude.wrong} wrong · {result.aptitude.skipped} skipped
          </p>
        </div>
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <Code2 className="w-3.5 h-3.5" /> Coding
          </p>
          <p className="text-2xl font-black" style={{ color: "var(--accent)" }}>
            {result.coding.total > 0 ? `${result.coding.accepted}/${result.coding.total}` : "—"}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            {result.coding.attempted} attempted · accepted solutions shown
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onRetry} className="flex-1 py-3 rounded-xl text-sm font-bold text-white btn-gradient cursor-pointer">
          Take Another Mock OA
        </button>
        <button onClick={onDashboard} className="flex-1 py-3 rounded-xl border text-sm font-bold cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

function Exam({ companyId, companyName, onFinish, onCancel }) {
  const token = getAuthToken();
  const [phase, setPhase] = useState("loading"); // loading | exam | result
  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState({});
  const [tab, setTab] = useState("aptitude");
  const [aptIdx, setAptIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Coding state
  const [codes, setCodes] = useState({});
  const [languages, setLanguages] = useState({});
  const [outputs, setOutputs] = useState({});
  const [runningQ, setRunningQ] = useState(null);
  const [submittingQ, setSubmittingQ] = useState(null);
  const [codeResults, setCodeResults] = useState({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get(`/api/placement/mock-oa/${companyId}/start`, { headers: { Authorization: `Bearer ${token}` } });
        if (!mounted) return;
        setPaper(res.data);
        const duration = res.data.durationMinutes * 60;
        setSecondsLeft(duration);
        setStartAt(Date.now());
        setPhase("exam");
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to start mock OA");
        onCancel();
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Timer
  useEffect(() => {
    if (phase !== "exam" || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          handleSubmit("auto");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const timeTaken = startAt ? Math.floor((Date.now() - startAt) / 1000) : 0;

  const runCode = async (q) => {
    const code = codes[q._id] || STARTER;
    const language = languages[q._id] || "JavaScript";
    setRunningQ(q._id);
    setOutputs((o) => ({ ...o, [q._id]: { type: "running" } }));
    try {
      const res = await api.post("/api/practice/coding/run", { language, code, input: "" }, { headers: { Authorization: `Bearer ${token}` } });
      setOutputs((o) => ({ ...o, [q._id]: res.data }));
    } catch {
      setOutputs((o) => ({ ...o, [q._id]: { type: "error", output: "Run failed — check your code" } }));
    } finally {
      setRunningQ(null);
    }
  };

  const submitCode = async (q) => {
    const code = codes[q._id] || STARTER;
    const language = languages[q._id] || "JavaScript";
    if (!code.trim()) return toast.error("Write some code before submitting");
    setSubmittingQ(q._id);
    try {
      const res = await api.post("/api/practice/coding/submit", {
        questionId: q._id,
        language,
        code,
        timeTakenMs: Date.now() - startAt,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setCodeResults((r) => ({ ...r, [q._id]: res.data }));
      toast[res.data.status === "accepted" ? "success" : "error"](
        res.data.status === "accepted" ? "Solution accepted!" : `${res.data.passedCount}/${res.data.totalCount} tests passed`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed");
    } finally {
      setSubmittingQ(null);
    }
  };

  const handleSubmit = useCallback(async (mode) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const elapsed = startAt ? Math.floor((Date.now() - startAt) / 1000) : secondsLeft;
      const res = await api.post(`/api/placement/mock-oa/${companyId}/submit`, {
        companyId,
        companyName,
        answers,
        aptitudeQuestions: paper.aptitude,
        codingResults: paper.coding.map((q) => ({
          questionId: q._id,
          attempted: Boolean(codeResults[q._id]),
          status: codeResults[q._id]?.status || "failed",
          passedCount: codeResults[q._id]?.passedCount || 0,
          totalCount: codeResults[q._id]?.totalCount || 0,
        })),
        timeTakenSec: elapsed,
        durationSec: paper.durationMinutes * 60,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setResult(res.data);
      setPhase("result");
      toast.success(`Mock OA submitted — ${res.data.overallScore}%`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit mock OA");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, startAt, secondsLeft, companyId, companyName, answers, paper, codeResults, token]);

  if (phase === "loading") {
    return (
      <div className="max-w-xl mx-auto py-24 space-y-4">
        <div className="skeleton h-40 w-full rounded-3xl" />
        <div className="skeleton h-4 w-2/3 mx-auto rounded" />
      </div>
    );
  }

  if (phase === "result") {
    return <ResultScreen result={result} onRetry={onCancel} onDashboard={() => onFinish("dashboard")} />;
  }

  const aptitude = paper.aptitude || [];
  const coding = paper.coding || [];
  const allAnswered = aptitude.every((q) => answers[q.questionId] != null);
  const codingDone = coding.every((q) => codeResults[q._id]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Exam header */}
      <header className="sticky top-[72px] z-40 border-b" style={{ borderColor: "var(--border)", background: "var(--navbar-bg)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: paper.color || "var(--primary)" }}>
              {companyName?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{companyName} Mock OA</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>Aptitude ({aptitude.length}) · Coding ({coding.length})</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl font-black" style={{ color: secondsLeft < 300 ? "var(--error)" : "var(--text-primary)", background: "color-mix(in srgb, var(--card-bg) 60%, transparent)", border: "1px solid var(--border)" }}>
              <Timer className="w-4 h-4" />
              {formatTime(secondsLeft)}
            </div>
            <button
              onClick={() => handleSubmit("manual")}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
              {submitting ? "Submitting..." : "Finish Exam"}
            </button>
          </div>
        </div>
      </header>

      {/* Section tabs */}
      <div className="max-w-7xl mx-auto w-full px-4 pt-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("aptitude")}
            className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
            style={{
              color: tab === "aptitude" ? "var(--primary)" : "var(--text-secondary)",
              background: tab === "aptitude" ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
            }}
          >
            <BrainCircuit className="w-4 h-4" />
            Aptitude
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: "var(--border)" }}>
              {Object.values(answers).filter(Boolean).length}/{aptitude.length}
            </span>
          </button>
          <button
            onClick={() => setTab("coding")}
            className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
            style={{
              color: tab === "coding" ? "var(--primary)" : "var(--text-secondary)",
              background: tab === "coding" ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
            }}
          >
            <Code2 className="w-4 h-4" />
            Coding
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: "var(--border)" }}>
              {Object.values(codeResults).filter(Boolean).length}/{coding.length}
            </span>
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-5">
        {tab === "aptitude" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              {aptitude.length === 0 ? (
                <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>
                  No aptitude questions available for this company yet.
                </div>
              ) : (
                <motion.div key={aptIdx} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                      Question {aptIdx + 1} of {aptitude.length}
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full capitalize" style={{ color: "var(--text-secondary)", background: "var(--border)" }}>
                      {aptitude[aptIdx]?.difficulty}
                    </span>
                  </div>
                  <p className="text-base font-semibold leading-relaxed mb-5" style={{ color: "var(--text-primary)" }}>
                    {aptitude[aptIdx]?.question}
                  </p>
                  <div className="space-y-3">
                    {aptitude[aptIdx]?.options?.map((opt, oi) => {
                      const qid = aptitude[aptIdx].questionId;
                      const selected = answers[qid] === opt;
                      return (
                        <button
                          key={oi}
                          onClick={() => setAnswers((a) => ({ ...a, [qid]: opt }))}
                          className="w-full flex items-center gap-3 p-4 rounded-2xl border text-left cursor-pointer transition-all"
                          style={{
                            borderColor: selected ? "var(--primary)" : "var(--border)",
                            background: selected ? "color-mix(in srgb, var(--primary) 6%, transparent)" : "transparent",
                          }}
                        >
                          <span className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: selected ? "var(--primary)" : "var(--border)", background: selected ? "var(--primary)" : "transparent" }}>
                            {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                          </span>
                          <span className="text-sm" style={{ color: "var(--text-primary)" }}>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-6">
                    <button onClick={() => setAptIdx((i) => Math.max(0, i - 1))} disabled={aptIdx === 0} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1.5" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    {aptIdx < aptitude.length - 1 ? (
                      <button onClick={() => setAptIdx((i) => i + 1)} className="px-5 py-2 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer flex items-center gap-1.5">
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => setTab("coding")} className="px-5 py-2 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer">
                        Go to Coding →
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
            <div className="lg:col-span-1">
              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-5 sticky top-24">
                <p className="text-xs font-bold mb-3" style={{ color: "var(--text-secondary)" }}>Question Navigator</p>
                <div className="grid grid-cols-5 gap-2">
                  {aptitude.map((q, i) => (
                    <button
                      key={q.questionId}
                      onClick={() => setAptIdx(i)}
                      className={`aspect-square rounded-lg text-[10px] font-black cursor-pointer transition-colors ${aptIdx === i ? "ring-2 ring-[var(--primary)]" : ""}`}
                      style={{
                        background: answers[q.questionId] != null ? "var(--primary)" : "var(--border)",
                        color: answers[q.questionId] != null ? "white" : "var(--text-secondary)",
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{Object.values(answers).filter(Boolean).length} answered</p>
                  <button
                    onClick={() => handleSubmit("manual")}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                    {submitting ? "Submitting..." : allAnswered && codingDone ? "Finish Exam" : "Submit Now"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "coding" && (
          <div className="space-y-5">
            {coding.length === 0 && (
              <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>
                No coding questions available for this company yet — you can still finish the aptitude section.
              </div>
            )}
            {coding.map((q, qi) => (
              <motion.div
                key={q._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qi * 0.06 }}
                className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 p-5 border-b flex-wrap" style={{ borderColor: "var(--border)" }}>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {qi + 1}. {q.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full capitalize" style={{
                        color: q.difficulty === "Hard" ? "var(--error)" : q.difficulty === "Medium" ? "#f59e0b" : "var(--success)",
                        background: "var(--border)",
                      }}>
                        {q.difficulty}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ color: "var(--text-secondary)", background: "var(--border)" }}>
                        {q.marks} marks
                      </span>
                      {codeResults[q._id] && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{
                          color: codeResults[q._id].status === "accepted" ? "var(--success)" : "var(--error)",
                          background: "color-mix(in srgb, " + (codeResults[q._id].status === "accepted" ? "var(--success)" : "var(--error)") + " 10%, transparent)",
                        }}>
                          {codeResults[q._id].status === "accepted" ? "Accepted" : `${codeResults[q._id].passedCount}/${codeResults[q._id].totalCount} passed`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={languages[q._id] || "JavaScript"}
                      onChange={(e) => setLanguages((l) => ({ ...l, [q._id]: e.target.value }))}
                      className="px-2.5 py-2 rounded-xl border text-[11px] font-semibold cursor-pointer"
                      style={{ borderColor: "var(--border)", background: "var(--card-bg)", color: "var(--text-primary)" }}
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.id} value={l.label}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                  <div className="p-5 border-b lg:border-b-0 lg:border-r" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{q.problemStatement}</p>
                    {q.inputFormat && <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}><b>Input: </b>{q.inputFormat}</p>}
                    {q.outputFormat && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}><b>Output: </b>{q.outputFormat}</p>}
                    {q.constraints && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}><b>Constraints: </b>{q.constraints}</p>}
                    {(q.sampleInput || q.sampleOutput) && (
                      <div className="mt-4 rounded-xl p-4 space-y-2" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                        {q.sampleInput && (
                          <>
                            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Sample Input</p>
                            <pre className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{q.sampleInput}</pre>
                          </>
                        )}
                        {q.sampleOutput && (
                          <>
                            <p className="text-[9px] font-bold uppercase tracking-wider mt-2" style={{ color: "var(--text-muted)" }}>Sample Output</p>
                            <pre className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{q.sampleOutput}</pre>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-h-[420px]">
                    <textarea
                      value={codes[q._id] || q.starterCode || STARTER}
                      onChange={(e) => setCodes((c) => ({ ...c, [q._id]: e.target.value }))}
                      spellCheck={false}
                      className="flex-1 w-full p-4 font-mono text-xs leading-relaxed resize-none outline-none"
                      style={{ background: "var(--code-bg, #0d1117)", color: "var(--code-fg, #c9d1d9)", minHeight: "260px" }}
                    />
                    <div className="p-3 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--border)" }}>
                      {outputs[q._id]?.type === "success" && (
                        <div className="flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--success)" }}>
                          <Terminal className="w-3.5 h-3.5" /> {String(outputs[q._id].output || "").slice(0, 120)}
                        </div>
                      )}
                      {outputs[q._id]?.type === "error" && (
                        <div className="flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--error)" }}>
                          <XCircle className="w-3.5 h-3.5" /> {String(outputs[q._id].output || "").slice(0, 120)}
                        </div>
                      )}
                      {(outputs[q._id]?.type === "running" || runningQ === q._id) && (
                        <div className="flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...
                        </div>
                      )}
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => runCode(q)}
                          disabled={runningQ === q._id || submittingQ === q._id}
                          className="px-4 py-2 rounded-xl border text-[11px] font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        >
                          <Play className="w-3.5 h-3.5" /> Run
                        </button>
                        <button
                          onClick={() => submitCode(q)}
                          disabled={runningQ === q._id || submittingQ === q._id}
                          className="px-4 py-2 rounded-xl text-[11px] font-bold text-white btn-gradient cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {submittingQ === q._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {submittingQ === q._id ? "Submitting..." : "Submit"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            <div className="flex justify-between pt-2">
              <button onClick={() => setTab("aptitude")} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer flex items-center gap-1.5" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <ChevronLeft className="w-4 h-4" /> Back to Aptitude
              </button>
              <button
                onClick={() => handleSubmit("manual")}
                disabled={submitting}
                className="px-6 py-2 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                {submitting ? "Submitting..." : "Finish Exam"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function MockOA() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const companyParam = searchParams.get("company");
  const [company, setCompany] = useState(companyParam);
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useCachedApi({ url: "/api/placement/mock-oa/history", key: "mock:history", ttlMs: 60 * 1000, enabled: false, lazy: true });
  const companies = useCachedApi({ url: "/api/placement/companies", key: "mock:companies", ttlMs: 5 * 60 * 1000 });

  const companyName = company ? companies.data?.companies?.find((c) => c.id === company)?.name || "" : "";

  const handleSelect = (id) => {
    setSearchParams({ company: id });
    setCompany(id);
  };

  const handleFinish = (dest) => {
    setCompany(null);
    setSearchParams({});
    if (dest === "dashboard") navigate("/placement-dashboard");
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setHistoryOpen(!historyOpen)} className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
          <History className="w-4 h-4" /> Mock OA History
        </button>
      </div>
      {historyOpen && (
        <div className="mb-6 rounded-2xl border p-4 space-y-2" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          {!history.data && (
            <button onClick={() => history.refetch()} className="text-xs font-bold cursor-pointer" style={{ color: "var(--primary)" }}>
              Load history
            </button>
          )}
          {history.data?.attempts?.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No mock OA attempts yet.</p>}
          {history.data?.attempts?.map((a) => (
            <div key={a._id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
              <span className="font-bold" style={{ color: "var(--text-primary)" }}>{a.companyName}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {a.aptitude.percentage}% apt · {a.coding.accepted}/{a.coding.total} cod · {new Date(a.createdAt).toLocaleDateString()}
              </span>
              <span className="font-black" style={{ color: a.overallScore >= 60 ? "var(--success)" : "var(--error)" }}>{a.overallScore}%</span>
            </div>
          ))}
        </div>
      )}

      {company ? (
        <Exam
          key={company}
          companyId={company}
          companyName={companyName}
          onFinish={handleFinish}
          onCancel={() => { setCompany(null); setSearchParams({}); }}
        />
      ) : (
        <CompanyPicker onSelect={handleSelect} />
      )}
    </div>
  );
}

export default MockOA;
