import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  BookOpen,
  Search,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  X,
  FileText,
} from "lucide-react";

const ENTERPRISE_COMPANIES = [
  {
    id: "accenture",
    name: "Accenture",
    code: "AC",
    category: "IT Services",
    tag: "Active",
    tagType: "active",
    subtitle: "Cognitive & Tech Assessment",
    aptitudeCount: 45,
    aptitudeLabel: "Aptitude",
    codingCount: 2,
    codingLabel: "Coding",
    duration: "90 Mins",
    color: "#9333EA",
    bg: "#2A154A",
  },
  {
    id: "deloitte",
    name: "Deloitte",
    code: "DT",
    category: "Big 4 & Consulting",
    tag: "Consulting",
    tagType: "default",
    subtitle: "Versant & Quantitative Round",
    aptitudeCount: 50,
    aptitudeLabel: "Aptitude",
    codingCount: 1,
    codingLabel: "Coding",
    duration: "75 Mins",
    color: "#10B981",
    bg: "#063028",
  },
  {
    id: "tcs",
    name: "TCS (NQT)",
    code: "TCS",
    category: "IT Services",
    tag: "Popular",
    tagType: "popular",
    subtitle: "Ninja & Digital Tier Patterns",
    aptitudeCount: 60,
    aptitudeLabel: "Aptitude",
    codingCount: 2,
    codingLabel: "Coding",
    duration: "110 Mins",
    color: "#3B82F6",
    bg: "#0F284E",
  },
  {
    id: "capgemini",
    name: "Capgemini",
    code: "CG",
    category: "IT Services",
    tag: "IT",
    tagType: "default",
    subtitle: "Pseudocode & Game-based",
    aptitudeCount: 40,
    aptitudeLabel: "MCQ",
    codingCount: 25,
    codingLabel: "Pseudo",
    duration: "80 Mins",
    color: "#06B6D4",
    bg: "#083344",
  },
  {
    id: "cognizant",
    name: "Cognizant",
    code: "CTS",
    category: "IT Services",
    tag: "IT",
    tagType: "default",
    subtitle: "GenC & GenC Elevate Round",
    aptitudeCount: 35,
    aptitudeLabel: "Aptitude",
    codingCount: 2,
    codingLabel: "Coding",
    duration: "90 Mins",
    color: "#6366F1",
    bg: "#1E1B4B",
  },
  {
    id: "infosys",
    name: "Infosys",
    code: "INF",
    category: "IT Services",
    tag: "IT",
    tagType: "default",
    subtitle: "Specialist & SE Assessment",
    aptitudeCount: 54,
    aptitudeLabel: "Aptitude",
    codingCount: 3,
    codingLabel: "Coding",
    duration: "100 Mins",
    color: "#0284C7",
    bg: "#082F49",
  },
  {
    id: "wipro",
    name: "Wipro",
    code: "WIP",
    category: "IT Services",
    tag: "IT",
    tagType: "default",
    subtitle: "Elite NLTH Assessment",
    aptitudeCount: 48,
    aptitudeLabel: "Aptitude",
    codingCount: 2,
    codingLabel: "Coding",
    duration: "95 Mins",
    color: "#A855F7",
    bg: "#3B0764",
  },
  {
    id: "benchmark",
    name: "Benchmark",
    code: "BM",
    category: "Big 4 & Consulting",
    tag: "Product",
    tagType: "default",
    subtitle: "Product & Algorithm Track",
    aptitudeCount: 30,
    aptitudeLabel: "Aptitude",
    codingCount: 3,
    codingLabel: "Coding",
    duration: "85 Mins",
    color: "#F59E0B",
    bg: "#451A03",
  },
  {
    id: "celebal",
    name: "Celebal",
    code: "CT",
    category: "Cloud & Data",
    tag: "Cloud",
    tagType: "default",
    subtitle: "Data & Cloud Developer Test",
    aptitudeCount: 35,
    aptitudeLabel: "Aptitude",
    codingCount: 2,
    codingLabel: "Coding",
    duration: "75 Mins",
    color: "#EC4899",
    bg: "#500724",
  },
];

const CATEGORIES = ["All (9)", "IT Services", "Big 4 & Consulting", "Cloud & Data"];

export default function MockInterview() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("accenture");
  const [activeCategory, setActiveCategory] = useState("All (9)");
  const [searchTerm, setSearchTerm] = useState("");
  const [unfinished, setUnfinished] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [resumingId, setResumingId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const searchInputRef = useRef(null);

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data } = await api.get("/api/companies", { headers: authHeaders });
        setCompanies(data || []);
      } catch {
        // Fallback gracefully
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

  // Combine API companies with enterprise patterns
  const mergedCompanies = useMemo(() => {
    return ENTERPRISE_COMPANIES.map((preset) => {
      const match = companies.find(
        (c) =>
          c.id === preset.id ||
          c._id === preset.id ||
          c.name?.toLowerCase().includes(preset.name.toLowerCase())
      );
      return {
        ...preset,
        realId: match?.id || match?._id || preset.id,
      };
    });
  }, [companies]);

  // Filter companies based on category & search term
  const filteredCompanies = useMemo(() => {
    return mergedCompanies.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat =
        activeCategory === "All (9)" ||
        c.category.toLowerCase() === activeCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [mergedCompanies, searchTerm, activeCategory]);

  const selectedCompany = useMemo(() => {
    return (
      mergedCompanies.find((c) => c.id === selectedCompanyId || c.realId === selectedCompanyId) ||
      mergedCompanies[0]
    );
  }, [mergedCompanies, selectedCompanyId]);

  const unfinishedCount = unfinished.length;
  const maxUnfinished = 2;
  const limitReached = unfinishedCount >= maxUnfinished;

  const handleBegin = () => {
    if (!selectedCompany) {
      toast.error("Please select a target company.");
      return;
    }
    if (limitReached) {
      toast.error("You have 2 unfinished mock interviews. Complete one before starting another.");
      return;
    }
    setStarting(true);
    const targetId = selectedCompany.realId || selectedCompany.id;
    window.open(`/company-mock?companyId=${encodeURIComponent(targetId)}`, "_blank");
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
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-24 lg:pb-8">
      
      {/* ── MAIN CARD CONTAINER ── */}
      <section 
        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 shadow-[var(--shadow-card)] relative overflow-hidden space-y-6"
      >
        {/* Top glowing orange accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF6B35] to-transparent opacity-80" />

        {/* ── Top Header Row ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div 
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border"
              style={{
                background: "rgba(255, 107, 53, 0.12)",
                borderColor: "rgba(255, 107, 53, 0.35)",
                color: "#FF6B35",
              }}
            >
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Start Mock Interview
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  AI-Assessed
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Practice verified hiring assessment patterns designed specifically for global tech enterprises.
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>9 Enterprise Patterns Active</span>
          </div>
        </div>

        {/* ── Target Company Header & Search ── */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
              Select Target Company <span className="text-[#FF6B35]">*</span>
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              Choose a company to load realistic aptitude &amp; coding patterns
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search company by name (e.g., Accenture, TCS, Deloitte, Infosys)..."
              className="w-full pl-10 pr-20 py-3 rounded-2xl border text-xs sm:text-sm outline-none transition-all"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-muted)] shadow-xs">
                Ctrl K
              </kbd>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-nowrap">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] mr-1 shrink-0">
              FILTER:
            </span>
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/25"
                      : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[#FF6B35]/30 hover:text-[var(--text-primary)]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 9 Company Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredCompanies.map((c) => {
            const isSelected = selectedCompanyId === c.id || selectedCompanyId === c.realId;
            return (
              <motion.div
                key={c.id}
                onClick={() => setSelectedCompanyId(c.id)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                className={`p-4 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-3.5 ${
                  isSelected
                    ? "bg-[#FF6B35]/5 border-2 border-[#FF6B35] shadow-[0_0_20px_rgba(255,107,53,0.18)]"
                    : "bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[#FF6B35]/40"
                }`}
              >
                <div>
                  {/* Top Row: Avatar + Name + Badge */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shrink-0 shadow-xs"
                        style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}33` }}
                      >
                        {c.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)]">
                            {c.name}
                          </h3>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#FF6B35]" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tag */}
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        c.tagType === "active"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : c.tagType === "popular"
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-[var(--card-bg)] text-[var(--text-muted)] border-[var(--border)]"
                      }`}
                    >
                      {c.tag}
                    </span>
                  </div>

                  {/* Subtitle */}
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                    {c.subtitle}
                  </p>
                </div>

                {/* Bottom Row: Badges + Duration */}
                <div className="flex items-center justify-between text-xs pt-2.5 border-t border-[var(--border)]/70">
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <span className="flex items-center gap-1 text-amber-400">
                      <BookOpen className="w-3 h-3" /> {c.aptitudeCount} {c.aptitudeLabel}
                    </span>
                    <span className="flex items-center gap-1 text-sky-400">
                      <Code2 className="w-3 h-3" /> {c.codingCount} {c.codingLabel}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                    {c.duration}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Bottom Proctored Footer & CTA ── */}
        <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <ShieldCheck className="w-4 h-4 text-[#FF6B35] shrink-0" />
            <span>Assessment environment is locked with proctored timer simulation</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSyllabusModal(true)}
              className="px-4 py-3 rounded-xl border text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              Assessment Syllabus
            </button>

            <motion.button
              type="button"
              onClick={handleBegin}
              disabled={limitReached || starting}
              className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-white cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                boxShadow: "0 6px 20px rgba(255, 107, 53, 0.35)",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Begin Test: {selectedCompany.name}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </section>

      {/* ── RESUME IN-PROGRESS MOCKS (IF ANY) ── */}
      {unfinishedCount > 0 && (
        <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-5 sm:p-6 space-y-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hourglass className="w-5 h-5 text-[#FF6B35]" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Resume Mock Interview
              </h2>
            </div>
            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              {unfinishedCount} Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {unfinished.map((u) => {
              const apt = u.progress?.aptitude || {};
              const tech = u.progress?.technical || {};
              const cod = u.progress?.coding || {};
              return (
                <div
                  key={u.attemptId}
                  className="rounded-2xl p-4 flex flex-col gap-3 bg-[var(--bg-secondary)] border border-[var(--border)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[var(--text-primary)]">
                      {u.companyName}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      In Progress
                    </span>
                  </div>

                  <div className="text-xs text-[var(--text-secondary)] flex items-center gap-3">
                    <span>Aptitude: <b className="text-[#FF6B35]">{apt.answered || 0}</b>/{apt.total || 15}</span>
                    <span>Technical: <b className="text-purple-400">{tech.answered || 0}</b>/{tech.total || 15}</span>
                    <span>Coding: <b className="text-emerald-400">{cod.answered || 0}</b>/{cod.total || 3}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                    <Timer className="w-3.5 h-3.5 text-[#FF6B35]" />
                    <span>Time left: <b className="text-[var(--text-primary)]">{fmtTime(u.remainingSeconds)}</b></span>
                  </div>

                  <button
                    onClick={() => handleResume(u.attemptId)}
                    disabled={resumingId === u.attemptId}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)" }}
                  >
                    {resumingId === u.attemptId ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>Resume Interview</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── History Link Footer ── */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => navigate("/mock-interview/history")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold border hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <History className="w-4 h-4 text-[#FF6B35]" />
          <span>View Mock Interview History</span>
        </button>
      </div>

      {/* ── Assessment Syllabus Modal ── */}
      <AnimatePresence>
        {showSyllabusModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#FF6B35]" />
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {selectedCompany.name} Assessment Syllabus
                  </h3>
                </div>
                <button
                  onClick={() => setShowSyllabusModal(false)}
                  className="p-1 rounded-lg hover:bg-neutral-800/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[var(--text-secondary)] max-h-80 overflow-y-auto pr-1">
                <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <h4 className="font-bold text-[var(--text-primary)] mb-1">1. Aptitude &amp; Cognitive</h4>
                  <p>Quantitative Ability, Logical Reasoning, Verbal Comprehension, Data Interpretation, and Pseudocode analysis.</p>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <h4 className="font-bold text-[var(--text-primary)] mb-1">2. Technical &amp; Core CS</h4>
                  <p>Data Structures, Algorithms, DBMS, SQL, Operating Systems, Computer Networks, and OOPS concepts.</p>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <h4 className="font-bold text-[var(--text-primary)] mb-1">3. Live Coding IDE</h4>
                  <p>Algorithmic challenges evaluated against public and hidden unit testcases with time &amp; space complexity constraints.</p>
                </div>
              </div>

              <button
                onClick={() => setShowSyllabusModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#FF6B35] text-white font-bold text-xs cursor-pointer shadow-md"
              >
                Close Syllabus
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}