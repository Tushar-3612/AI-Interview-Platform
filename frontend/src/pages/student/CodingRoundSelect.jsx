import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import {
  Code2,
  Loader2,
  Play,
  Hourglass,
  History,
  Building2,
  Timer,
  ArrowRight,
  Search,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  X,
  FileCode,
  Layers,
  Terminal,
  Cpu,
} from "lucide-react";

const ENTERPRISE_COMPANIES = [
  {
    id: "accenture",
    name: "Accenture",
    code: "AC",
    category: "IT Services",
    tag: "Active",
    tagType: "active",
    subtitle: "DSA, String & Array Algorithms",
    duration: "60 Mins",
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
    subtitle: "Data Structures & Business Logic",
    duration: "60 Mins",
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
    subtitle: "Ninja & Digital Coding Tracks",
    duration: "60 Mins",
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
    subtitle: "Pseudocode & Coding Challenges",
    duration: "60 Mins",
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
    subtitle: "GenC & Elevate Algorithm Problems",
    duration: "60 Mins",
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
    subtitle: "Specialist & System Engineer Coding",
    duration: "60 Mins",
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
    subtitle: "Elite NLTH Problem Solving",
    duration: "60 Mins",
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
    subtitle: "Product & Algorithmic Optimization",
    duration: "60 Mins",
    color: "#F59E0B",
    bg: "#451A03",
  },
  {
    id: "celebal",
    name: "Celebal",
    code: "CE",
    category: "Cloud & Data",
    tag: "Cloud",
    tagType: "default",
    subtitle: "Data & Cloud Developer Problem Track",
    duration: "60 Mins",
    color: "#EC4899",
    bg: "#500724",
  },
];

export default function CodingRoundSelect() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [companyQuestions, setCompanyQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
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
    const fetchCompaniesAndActivity = async () => {
      setLoadingCompanies(true);
      try {
        const [compRes, histRes] = await Promise.all([
          api.get("/api/companies", { headers: authHeaders }),
          api.get("/api/practice/coding/history", { headers: authHeaders, params: { limit: 10 } }).catch(() => ({ data: [] })),
        ]);
        setCompanies(Array.isArray(compRes.data) ? compRes.data : []);
        setRecentSubmissions(histRes.data?.submissions || histRes.data || []);
      } catch {
        setCompanies([]);
      } finally {
        setLoadingCompanies(false);
      }
    };

    fetchCompaniesAndActivity();
  }, [authHeaders]);

  // Only display companies added by admin, active in MongoDB, and configured for Coding Round
  const mergedCompanies = useMemo(() => {
    const activeAdminCompanies = (companies || []).filter((c) => {
      if (!c || c.status === "inactive" || c.isDeleted) return false;
      const rounds = c.supportedRounds && c.supportedRounds.length > 0 ? c.supportedRounds : ["aptitude", "coding", "technical", "hr"];
      return rounds.includes("coding");
    });

    return activeAdminCompanies.map((c) => {
      const realId = c.id || c._id;
      // Match against preset enterprise styling if available
      const preset = ENTERPRISE_COMPANIES.find(
        (p) =>
          p.id === realId ||
          p.id === c.id ||
          p.name?.toLowerCase() === c.name?.toLowerCase() ||
          c.name?.toLowerCase().includes(p.name?.toLowerCase()) ||
          p.name?.toLowerCase().includes(c.name?.toLowerCase())
      );

      const code = c.code || (c.name ? c.name.slice(0, 2).toUpperCase() : "CO");
      const category = c.category || preset?.category || "General";
      const subtitle =
        c.subtitle ||
        c.description ||
        preset?.subtitle ||
        `${c.difficulty || "Standard"} Coding Track`;

      const codingCount =
        c.codingCount ??
        (c.coding != null ? c.coding : preset?.codingCount ?? 3);

      const duration = c.duration
        ? (typeof c.duration === "number" ? `${c.duration} Mins` : c.duration)
        : (preset?.duration || "60 Mins");

      const color = c.color || preset?.color || "#06B6D4";
      const bg = preset?.bg || (color ? `${color}22` : "rgba(6,182,212,0.15)");

      return {
        id: realId,
        realId,
        name: c.name,
        code,
        category,
        tag: preset?.tag || (c.status === "active" ? "Active" : "Standard"),
        tagType: preset?.tagType || (c.status === "active" ? "active" : "default"),
        subtitle,
        codingCount,
        duration,
        color,
        bg,
      };
    });
  }, [companies]);

  // Dynamic categories based only on admin-added active companies
  const categories = useMemo(() => {
    const set = new Set();
    mergedCompanies.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return ["All", ...Array.from(set)];
  }, [mergedCompanies]);

  // Keep selected company in sync with available admin companies
  useEffect(() => {
    if (mergedCompanies.length > 0) {
      const exists = mergedCompanies.some(
        (c) => c.id === selectedCompanyId || c.realId === selectedCompanyId
      );
      if (!exists) {
        setSelectedCompanyId(mergedCompanies[0].id || mergedCompanies[0].realId);
      }
    }
  }, [mergedCompanies, selectedCompanyId]);

  // Filter companies based on category & search term
  const filteredCompanies = useMemo(() => {
    return mergedCompanies.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase());

      const isAll = activeCategory === "All" || activeCategory.startsWith("All");
      const matchesCat =
        isAll || c.category.toLowerCase() === activeCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [mergedCompanies, searchTerm, activeCategory]);

  const selectedCompany = useMemo(() => {
    return (
      mergedCompanies.find((c) => c.id === selectedCompanyId || c.realId === selectedCompanyId) ||
      mergedCompanies[0] ||
      null
    );
  }, [mergedCompanies, selectedCompanyId]);

  // Load preview questions for the selected company for the Syllabus Modal
  useEffect(() => {
    if (!selectedCompany) return;
    const fetchCompanyQuestions = async () => {
      setLoadingQuestions(true);
      try {
        const targetId = selectedCompany.realId || selectedCompany.id;
        const res = await api.get("/api/coding-questions", {
          headers: authHeaders,
          params: { companyId: targetId, limit: 10 },
        });
        setCompanyQuestions(res.data?.questions || []);
      } catch {
        setCompanyQuestions([]);
      } finally {
        setLoadingQuestions(false);
      }
    };
    fetchCompanyQuestions();
  }, [selectedCompany, authHeaders]);

  const handleBegin = () => {
    if (!selectedCompany) {
      toast.error("Please select a target company.");
      return;
    }
    setStarting(true);
    const targetId = selectedCompany.realId || selectedCompany.id;
    navigate(`/interview-practice/${encodeURIComponent(targetId)}/coding`);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-24 lg:pb-8">
      {/* ── MAIN CARD CONTAINER ── */}
      <section 
        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 shadow-[var(--shadow-card)] relative overflow-hidden space-y-6"
      >
        {/* Top glowing cyan accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#06B6D4] to-transparent opacity-80" />

        {/* ── Top Header Row ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div 
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border"
              style={{
                background: "rgba(6, 182, 212, 0.12)",
                borderColor: "rgba(6, 182, 212, 0.35)",
                color: "#06B6D4",
              }}
            >
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Start Coding Round
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  IDE-Evaluated
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Solve company-specific algorithmic coding questions in multi-language Monaco IDE with automated testcase scoring.
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>
              {loadingCompanies
                ? "Loading Companies..."
                : `${mergedCompanies.length} Active ${mergedCompanies.length === 1 ? "Track" : "Tracks"}`}
            </span>
          </div>
        </div>

        {/* ── Target Company Header & Search ── */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
              Select Target Company <span className="text-[#06B6D4]">*</span>
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              Choose an active admin-configured company to load tailored coding problems
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
              placeholder="Search active company by name or category..."
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

          {/* Dynamic Category Filter Tabs */}
          {categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-nowrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] mr-1 shrink-0">
                FILTER:
              </span>
              {categories.map((cat) => {
                const active = activeCategory === cat;
                const label = cat === "All" ? `All (${mergedCompanies.length})` : cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? "bg-[#06B6D4] text-white shadow-md shadow-[#06B6D4]/25"
                        : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[#06B6D4]/30 hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Admin Companies Grid ── */}
        {loadingCompanies ? (
          <div className="py-16 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#06B6D4]" />
            <span>Loading active coding tracks...</span>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="py-12 px-4 rounded-2xl border border-dashed border-[var(--border)] text-center bg-[var(--bg-secondary)]/40 space-y-2">
            <Building2 className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-60" />
            <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)]">
              {mergedCompanies.length === 0 ? "No Active Companies Configured" : "No Matching Companies Found"}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              {mergedCompanies.length === 0
                ? "Coding round companies are managed centrally by the administrator. Once an admin activates companies and assigns coding questions, they will automatically appear here."
                : "Try adjusting your search query or switching to another category filter."}
            </p>
          </div>
        ) : (
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
                      ? "bg-[#06B6D4]/5 border-2 border-[#06B6D4] shadow-[0_0_20px_rgba(6,182,212,0.18)]"
                      : "bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[#06B6D4]/40"
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
                              <CheckCircle2 className="w-4 h-4 text-[#06B6D4]" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tag */}
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          c.tagType === "active"
                            ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
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

                  {/* Bottom Row: Coding count + Duration */}
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-[var(--border)]/70">
                    <div className="flex items-center gap-2 text-[11px] font-semibold">
                      <span className="flex items-center gap-1 text-sky-400">
                        <Code2 className="w-3.5 h-3.5" /> {c.codingCount} Coding Problems
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                      <Timer className="w-3 h-3" /> {c.duration}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Bottom Proctored Footer & CTA ── */}
        <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <ShieldCheck className="w-4 h-4 text-[#06B6D4] shrink-0" />
            <span>Interactive multi-language IDE with real-time testcase execution and compilation diagnostics</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSyllabusModal(true)}
              disabled={!selectedCompany}
              className="px-4 py-3 rounded-xl border text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: "var(--border)" }}
            >
              Problem Outline
            </button>

            <motion.button
              type="button"
              onClick={handleBegin}
              disabled={!selectedCompany || starting}
              className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-white cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
                boxShadow: "0 6px 20px rgba(6, 182, 212, 0.35)",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Begin Coding: {selectedCompany ? selectedCompany.name : "Select Company"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </section>

      {/* ── RECENT CODING SUBMISSIONS (IF ANY) ── */}
      {recentSubmissions.length > 0 && (
        <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-5 sm:p-6 space-y-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#06B6D4]" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Recent Coding Activity
              </h2>
            </div>
            <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
              {recentSubmissions.length} Submissions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentSubmissions.slice(0, 4).map((sub) => (
              <div
                key={sub._id || sub.id}
                className="rounded-2xl p-4 flex flex-col justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[var(--text-primary)] truncate max-w-[200px]">
                    {sub.title || "Algorithmic Challenge"}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
                      sub.status === "accepted"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}
                  >
                    {sub.status === "accepted" ? "Accepted" : "Failed Cases"}
                  </span>
                </div>

                <div className="text-xs text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Language: <b className="text-cyan-400 uppercase">{sub.language || "Python"}</b></span>
                  <span>Passed: <b className="text-[var(--text-primary)]">{sub.passedCount ?? 0}/{sub.totalCount ?? 5}</b></span>
                </div>

                <button
                  onClick={() => navigate(`/interview-practice/${sub.companyId || "tcs"}/coding`)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90 shadow-md"
                  style={{ background: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)" }}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Problem in IDE</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── History Link Footer ── */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => navigate("/practice/coding/history")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold border hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <History className="w-4 h-4 text-[#06B6D4]" />
          <span>View All Coding Submissions</span>
        </button>
      </div>

      {/* ── Problem Outline Modal ── */}
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
                  <FileCode className="w-5 h-5 text-[#06B6D4]" />
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {selectedCompany?.name || "Company"} Coding Problem Outline
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
                  <h4 className="font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" /> Key Topics &amp; Patterns
                  </h4>
                  <p>Arrays, HashMaps, Two Pointers, Dynamic Programming, Binary Search, Trees, and Graph Traversal.</p>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <h4 className="font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Evaluation Rigor
                  </h4>
                  <p>Codes are benchmarked against public visible testcases and strict hidden boundary testcases with strict time limit (1000ms) and memory limits.</p>
                </div>

                {loadingQuestions ? (
                  <div className="text-center py-4 text-[var(--text-muted)] flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#06B6D4]" />
                    <span>Loading company problem titles...</span>
                  </div>
                ) : companyQuestions.length > 0 ? (
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                    <h4 className="font-bold text-[var(--text-primary)]">Sample Company Problems:</h4>
                    <ul className="space-y-1.5 list-disc list-inside text-[var(--text-primary)] font-medium">
                      {companyQuestions.slice(0, 5).map((q) => (
                        <li key={q._id || q.questionId} className="truncate">
                          {q.title} <span className="text-[10px] text-cyan-400 font-semibold uppercase">({q.difficulty})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => setShowSyllabusModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#06B6D4] text-white font-bold text-xs cursor-pointer shadow-md"
              >
                Close Outline
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
