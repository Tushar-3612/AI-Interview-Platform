import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import {
  Building2,
  Loader2,
  Play,
  Hourglass,
  History,
  Lock,
  Inbox,
  ListChecks,
  Timer,
  ArrowRight,
  BrainCircuit,
  Code2,
} from "lucide-react";

const btnGradient = {
  background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
};

function SectionPill({ icon: Icon, label, count, color }) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 flex-1 min-w-0"
      style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)" }}
    >
      <Icon className="w-4 h-4" style={{ color }} />
      <span className="text-xs font-bold truncate w-full text-center" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        {count} Questions
      </span>
    </div>
  );
}

export default function MockInterview() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [unfinished, setUnfinished] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [resumingId, setResumingId] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const fetchCompanies = async () => {
      setCompaniesLoading(true);
      setCompaniesError(false);
      try {
        const { data } = await api.get("/api/companies", { headers: authHeaders });
        setCompanies(data || []);
      } catch {
        setCompaniesError(true);
      } finally {
        setCompaniesLoading(false);
      }
    };

    const fetchUnfinished = async () => {
      setLoadingRows(true);
      try {
        const { data } = await api.get("/api/mock-interview/unfinished", { headers: authHeaders });
        setUnfinished(data.rows || []);
      } catch {
        setUnfinished([]);
      } finally {
        setLoadingRows(false);
      }
    };

    fetchCompanies();
    fetchUnfinished();
  }, [authHeaders]);

  const unfinishedCount = unfinished.length;
  const maxUnfinished = 2;
  const limitReached = unfinishedCount >= maxUnfinished;

  const handleBegin = () => {
    if (!selectedCompanyId) {
      toast.error("Please select a company first.");
      return;
    }
    if (limitReached) {
      toast.error("You have 2 unfinished mock interviews. Complete one before starting another.");
      return;
    }
    setStarting(true);
    window.open(`/company-mock?companyId=${encodeURIComponent(selectedCompanyId)}`, "_blank");
    setTimeout(() => setStarting(false), 800);
  };

  const handleResume = (attemptId) => {
    setResumingId(attemptId);
    window.open(`/company-mock?resume=${attemptId}`, "_blank");
    setTimeout(() => setResumingId(null), 800);
  };

  const fmtTime = (totalSeconds) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  return (
    <div
      className="flex flex-col items-center min-h-[70vh] px-4 py-10"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <div className="w-full max-w-2xl flex flex-col gap-8">
        {/* Hero header */}
        <header className="flex flex-col items-center text-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={btnGradient}
          >
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">Company Mock Interview</h1>
          <p className="max-w-md text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            A complete placement-style assessment: Aptitude, Technical, and Coding —
            delivered in one secured, fullscreen session.
          </p>
        </header>

        {/* ── Start Mock Interview ── */}
        <section className="rounded-3xl p-5 md:p-6 flex flex-col gap-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <h2 className="text-lg font-bold">Start Mock Interview</h2>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Select a Company
            </label>
            {companiesLoading ? (
              <div className="w-full p-2.5 border rounded-xl flex items-center gap-2 text-sm" style={{ background: "var(--input-bg)", color: "var(--text-muted)", borderColor: "var(--border)" }}>
                <Loader2 className="w-4 h-4 animate-spin" /> Loading companies…
              </div>
            ) : companiesError ? (
              <div className="w-full p-2.5 border rounded-xl text-sm" style={{ borderColor: "var(--error)", background: "var(--admin-error-bg)", color: "var(--error)" }}>
                Could not load companies. Please refresh and try again.
              </div>
            ) : (
              <select
                className="w-full p-2.5 border rounded-xl text-sm"
                style={{ background: "var(--input-bg)", color: "var(--text-primary)", borderColor: "var(--border)" }}
                value={selectedCompanyId || ""}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
              >
                <option value="" disabled>-- Select a Company --</option>
                {companies.map((company) => (
                  <option key={company.id || company._id} value={company.id || company._id}>
                    {company.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <SectionPill icon={BrainCircuit} label="Aptitude" count={15} color="#38BDF8" />
            <SectionPill icon={ListChecks} label="Technical" count={15} color="#A78BFA" />
            <SectionPill icon={Code2} label="Coding" count={3} color="#34D399" />
          </div>

          <button
            onClick={handleBegin}
            disabled={limitReached || starting}
            className="btn-gradient w-full px-6 py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={btnGradient}
          >
            {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Begin Assessment
          </button>

          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
            Opens the mock interview in a new, secured fullscreen tab.
          </p>

          {limitReached && (
            <div className="rounded-xl p-3 text-xs font-semibold flex items-start gap-2" style={{ background: "rgba(239,68,68,0.1)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>You have 2 unfinished mock interviews. Complete one before starting another.</span>
            </div>
          )}
        </section>

        {/* ── Resume Mock Interview ── */}
        <section className="flex flex-col gap-4">
          <div className="text-center flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Hourglass className="w-5 h-5" style={{ color: "var(--primary)" }} />
              <h2 className="text-2xl font-bold">Resume Mock Interview</h2>
            </div>
            <p className="text-sm max-w-md" style={{ color: "var(--text-secondary)" }}>
              Finish any in-progress assessments where you left off. You may keep up to 2 unfinished
              mock interviews at a time.
            </p>
          </div>

          {loadingRows ? (
            <div className="rounded-2xl p-6 flex items-center justify-center gap-2 text-sm" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
              <span style={{ color: "var(--text-muted)" }}>Checking for unfinished mocks…</span>
            </div>
          ) : unfinishedCount === 0 ? (
            <div className="rounded-2xl p-6 flex flex-col items-center text-center gap-2" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
                <Inbox className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="font-semibold text-sm">No unfinished mock interviews</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Start a new assessment above to begin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {unfinished.map((u) => {
                const apt = u.progress?.aptitude || {};
                const tech = u.progress?.technical || {};
                const cod = u.progress?.coding || {};
                return (
                  <div
                    key={u.attemptId}
                    className="rounded-2xl p-4 flex flex-col gap-3 h-full"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                          style={{ background: "color-mix(in srgb, var(--primary) 14%, transparent)" }}
                        >
                          <Building2 className="w-4.5 h-4.5" style={{ color: "var(--primary)" }} />
                        </div>
                        <span className="font-bold text-sm truncate">{u.companyName}</span>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}
                      >
                        In Progress
                      </span>
                    </div>

                    <div
                      className="text-xs rounded-xl px-3 py-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-relaxed"
                      style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-secondary)" }}
                    >
                      <span>
                        Aptitude <b className="tabular-nums" style={{ color: "var(--primary)" }}>{apt.answered || 0}</b>/{apt.total || 15}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>·</span>
                      <span>
                        Technical <b className="tabular-nums" style={{ color: "var(--primary)" }}>{tech.answered || 0}</b>/{tech.total || 15}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>·</span>
                      <span>
                        Coding <b className="tabular-nums" style={{ color: "var(--primary)" }}>{cod.answered || 0}</b>/{cod.total || 3}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      <Timer className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                      Time left: <span className="tabular-nums font-bold" style={{ color: "var(--text-primary)" }}>{fmtTime(u.remainingSeconds)}</span>
                    </div>

                    <button
                      onClick={() => handleResume(u.attemptId)}
                      disabled={resumingId === u.attemptId}
                      className="btn-gradient w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
                      style={btnGradient}
                    >
                      {resumingId === u.attemptId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      Resume Interview
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* History link */}
        <button
          onClick={() => navigate("/mock-interview/history")}
          className="self-center flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--card-bg)" }}
        >
          <History className="w-4 h-4" style={{ color: "var(--primary)" }} /> View Mock Interview History
        </button>
      </div>
    </div>
  );
}