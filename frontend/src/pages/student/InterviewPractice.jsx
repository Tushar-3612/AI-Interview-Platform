import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { 
  Building2, Search, ArrowRight, BookOpen, Code2, Bookmark, History, Clock, X, BrainCircuit 
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { useTheme } from "../../hooks/useTheme";
import { SkeletonCompanyCard, ErrorState } from "../../components/ui/Skeleton";

import IndividualTechnicalStartModal from "../../components/individualRound/technical/IndividualTechnicalStartModal";
import IndividualProjectStartModal from "../../components/individualRound/project/IndividualProjectStartModal";
import { Zap, FolderGit2 } from "lucide-react";

function InterviewPractice() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [companies, setCompanies] = useState([]);
  const [recent, setRecent] = useState(null);
  const [aptitudeHistory, setAptitudeHistory] = useState([]);
  const [codingHistory, setCodingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errStatus, setErrStatus] = useState(null);

  // Individual Practice Start Modals State
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [isProjModalOpen, setIsProjModalOpen] = useState(false);

  // States for search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedSolvedStatus, setSelectedSolvedStatus] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    setErrStatus(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [res, aptHistoryRes, codingHistoryRes] = await Promise.all([
        api.get("/api/practice/home", { headers }),
        api.get("/api/practice/aptitude/history", { headers, params: { limit: 100 } }).catch(() => null),
        api.get("/api/practice/coding/history", { headers, params: { limit: 100 } }).catch(() => null),
      ]);

      const list = res.data?.companies || [];
      setCompanies(list.filter((c) => c.status !== "inactive"));
      setRecent(res.data?.recent || null);
      setAptitudeHistory(aptHistoryRes?.data?.attempts || []);
      setCodingHistory(codingHistoryRes?.data?.submissions || []);
    } catch (err) {
      setError(true);
      setErrStatus(err.response?.status || "network_failure");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute sets of attempted and solved companies
  const attemptedCompanyIds = useMemo(() => {
    const ids = new Set();
    aptitudeHistory.forEach((a) => { if (a.companyId) ids.add(a.companyId); });
    codingHistory.forEach((s) => { if (s.companyId) ids.add(s.companyId); });
    return ids;
  }, [aptitudeHistory, codingHistory]);

  const solvedCompanyIds = useMemo(() => {
    const ids = new Set();
    codingHistory.forEach((s) => {
      if (s.companyId && s.status === "accepted") ids.add(s.companyId);
    });
    aptitudeHistory.forEach((a) => {
      if (a.companyId && a.percentage >= 60) ids.add(a.companyId);
    });
    return ids;
  }, [aptitudeHistory, codingHistory]);

  const toggleFavorite = async (company, e) => {
    e.stopPropagation();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const companyId = company.id || company._id;
      const res = await api.post("/api/practice/favorite-company", { companyId }, { headers });
      setCompanies((prev) => prev.map((c) => (c.id === companyId || c._id === companyId ? { ...c, isFavorite: res.data.favorited } : c)));
      toast.success(res.data.favorited ? `${company.name} bookmarked` : "Bookmark removed");
    } catch {
      toast.error("Failed to update bookmark");
    }
  };

  // Filter companies
  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const companyId = c.id || c._id;
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesDifficulty = selectedDifficulty ? c.difficulty?.toLowerCase() === selectedDifficulty.toLowerCase() : true;
      
      const matchesDept = selectedDept 
        ? c.eligibleDepartments?.some(d => d.toLowerCase().includes(selectedDept.toLowerCase())) 
        : true;

      let matchesSolved = true;
      if (selectedSolvedStatus === "attempted") {
        matchesSolved = attemptedCompanyIds.has(companyId);
      } else if (selectedSolvedStatus === "not_attempted") {
        matchesSolved = !attemptedCompanyIds.has(companyId);
      } else if (selectedSolvedStatus === "solved") {
        matchesSolved = solvedCompanyIds.has(companyId);
      } else if (selectedSolvedStatus === "unsolved") {
        matchesSolved = !solvedCompanyIds.has(companyId) && attemptedCompanyIds.has(companyId);
      }

      return matchesSearch && matchesDifficulty && matchesDept && matchesSolved;
    });
  }, [companies, searchTerm, selectedDifficulty, selectedDept, selectedSolvedStatus, attemptedCompanyIds, solvedCompanyIds]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDifficulty("");
    setSelectedDept("");
    setSelectedSolvedStatus("");
  };

  const hasFiltersActive = searchTerm || selectedDifficulty || selectedDept || selectedSolvedStatus;
  const lastAttempt = recent?.lastAttempt || aptitudeHistory[0];
  const lastSubmission = recent?.lastSubmission || codingHistory[0];
  const hasActivity = lastAttempt || lastSubmission;
  const continueCompanyId = lastAttempt?.companyId || lastSubmission?.companyId;

  const getCompanyColor = (name = "") => {
    const n = name.toLowerCase();
    if (n.includes("benchmark")) {
      return isDark
        ? { bg: "#2d1a08", text: "#F59E0B", border: "#F59E0B" }
        : { bg: "#FEF3C7", text: "#D97706", border: "#F59E0B" };
    }
    if (n.includes("capgemini")) {
      return isDark
        ? { bg: "#0b2038", text: "#38BDF8", border: "#38BDF8" }
        : { bg: "#E0F2FE", text: "#0284C7", border: "#38BDF8" };
    }
    if (n.includes("celebal")) {
      return isDark
        ? { bg: "#063028", text: "#10B981", border: "#10B981" }
        : { bg: "#D1FAE5", text: "#059669", border: "#10B981" };
    }
    if (n.includes("cognizant")) {
      return isDark
        ? { bg: "#221138", text: "#A855F7", border: "#A855F7" }
        : { bg: "#F3E8FF", text: "#7C3AED", border: "#A855F7" };
    }
    return isDark
      ? { bg: "#1f2937", text: "#FF6B35", border: "#FF6B35" }
      : { bg: "#FFF7ED", text: "#EA580C", border: "#FF6B35" };
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-24 lg:pb-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        
        {/* ── Page Header ── */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight" style={{ color: "#FF6B35" }}>
              Placement Preparation
            </h1>
            <button
              type="button"
              onClick={() => navigate("/practice/aptitude/history")}
              className="self-start sm:self-auto flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border cursor-pointer transition-all shadow-sm active:scale-95"
              style={{
                borderColor: isDark ? "var(--border)" : "rgba(255, 107, 53, 0.25)",
                color: isDark ? "var(--text-secondary)" : "#EA580C",
                background: isDark ? "var(--bg-secondary)" : "#FFF7ED",
              }}
            >
              <History className="w-3.5 h-3.5 text-[#FF6B35]" />
              <span>My Practice History</span>
            </button>
          </div>
          <p className="text-xs sm:text-sm max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            Select a company to begin your placement preparation assessments
          </p>
        </div>

        {/* ── Feature Cards Grid: Company Mock, Technical, Project & Coding Practice ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Company Mock Interview CTA Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 sm:p-6 rounded-[22px] border relative overflow-hidden space-y-4 transition-all flex flex-col justify-between"
            style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(124, 58, 237, 0.18) 0%, rgba(20, 16, 36, 0.95) 100%)"
                : "linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(245, 243, 255, 0.95) 100%)",
              borderColor: isDark
                ? "rgba(139, 92, 246, 0.35)"
                : "rgba(124, 58, 237, 0.25)",
              boxShadow: isDark
                ? "0 8px 30px rgba(0, 0, 0, 0.3)"
                : "0 8px 30px rgba(124, 58, 237, 0.08)",
            }}
          >
            <div className="flex items-start gap-3.5">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
                style={{
                  background: "linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                }}
              >
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className="text-base sm:text-lg font-black tracking-tight"
                    style={{ color: isDark ? "#FFFFFF" : "#1E1B4B" }}
                  >
                    Company Mock Interview
                  </h2>
                  <span
                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border"
                    style={{
                      background: isDark ? "rgba(139, 92, 246, 0.25)" : "rgba(124, 58, 237, 0.12)",
                      color: isDark ? "#D8B4FE" : "#6D28D9",
                      borderColor: isDark ? "rgba(139, 92, 246, 0.45)" : "rgba(124, 58, 237, 0.25)",
                    }}
                  >
                    PRO
                  </span>
                </div>
                <p
                  className="text-xs sm:text-sm mt-1 leading-relaxed"
                  style={{ color: isDark ? "#D1D5DB" : "#4B5563" }}
                >
                  Simulate exact corporate hiring patterns across Aptitude, Technical, and Coding.
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={() => navigate("/mock-interview")}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer flex items-center justify-center gap-2 shadow-lg transition-all"
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)",
                boxShadow: "0 4px 18px rgba(124, 58, 237, 0.35)",
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <span>Start Mock Interview</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>

          {/* Individual Technical Practice CTA Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 sm:p-6 rounded-[22px] border relative overflow-hidden space-y-4 transition-all flex flex-col justify-between"
            style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(249, 115, 22, 0.18) 0%, rgba(24, 18, 16, 0.95) 100%)"
                : "linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(254, 243, 199, 0.5) 100%)",
              borderColor: isDark
                ? "rgba(249, 115, 22, 0.35)"
                : "rgba(249, 115, 22, 0.25)",
              boxShadow: isDark
                ? "0 8px 30px rgba(0, 0, 0, 0.3)"
                : "0 8px 30px rgba(249, 115, 22, 0.08)",
            }}
          >
            <div className="flex items-start gap-3.5">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
                style={{
                  background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 14px rgba(249, 115, 22, 0.3)",
                }}
              >
                <Zap className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className="text-base sm:text-lg font-black tracking-tight"
                    style={{ color: isDark ? "#FFFFFF" : "#431407" }}
                  >
                    Technical Practice
                  </h2>
                  <span
                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border"
                    style={{
                      background: isDark ? "rgba(249, 115, 22, 0.25)" : "rgba(249, 115, 22, 0.12)",
                      color: isDark ? "#FFEDD5" : "#C2410C",
                      borderColor: isDark ? "rgba(249, 115, 22, 0.45)" : "rgba(249, 115, 22, 0.25)",
                    }}
                  >
                    TARGETED
                  </span>
                </div>
                <p
                  className="text-xs sm:text-sm mt-1 leading-relaxed"
                  style={{ color: isDark ? "#D1D5DB" : "#4B5563" }}
                >
                  20 Technical questions tailored to your Resume or Interview Key with /100 score evaluation.
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={() => setIsTechModalOpen(true)}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer flex items-center justify-center gap-2 shadow-lg transition-all"
              style={{
                background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                boxShadow: "0 4px 18px rgba(249, 115, 22, 0.35)",
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <span>Configure Technical Practice</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>

          {/* Individual Project / Resume Practice CTA Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 sm:p-6 rounded-[22px] border relative overflow-hidden space-y-4 transition-all flex flex-col justify-between"
            style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(16, 24, 20, 0.95) 100%)"
                : "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(209, 250, 229, 0.5) 100%)",
              borderColor: isDark
                ? "rgba(16, 185, 129, 0.35)"
                : "rgba(16, 185, 129, 0.25)",
              boxShadow: isDark
                ? "0 8px 30px rgba(0, 0, 0, 0.3)"
                : "0 8px 30px rgba(16, 185, 129, 0.08)",
            }}
          >
            <div className="flex items-start gap-3.5">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
                style={{
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                }}
              >
                <FolderGit2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className="text-base sm:text-lg font-black tracking-tight"
                    style={{ color: isDark ? "#FFFFFF" : "#064E3B" }}
                  >
                    Project / Resume Practice
                  </h2>
                  <span
                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border"
                    style={{
                      background: isDark ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.12)",
                      color: isDark ? "#A7F3D0" : "#047857",
                      borderColor: isDark ? "rgba(16, 185, 129, 0.45)" : "rgba(16, 185, 129, 0.25)",
                    }}
                  >
                    TARGETED (10 Qs)
                  </span>
                </div>
                <p
                  className="text-xs sm:text-sm mt-1 leading-relaxed"
                  style={{ color: isDark ? "#D1D5DB" : "#4B5563" }}
                >
                  10 Deep Project questions testing architecture, DB design, APIs, & trade-offs with /100 score.
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={() => setIsProjModalOpen(true)}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer flex items-center justify-center gap-2 shadow-lg transition-all"
              style={{
                background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                boxShadow: "0 4px 18px rgba(16, 185, 129, 0.35)",
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <span>Configure Project Practice</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>

          {/* Dedicated Coding Round CTA Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 sm:p-6 rounded-[22px] border relative overflow-hidden space-y-4 transition-all flex flex-col justify-between"
            style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(8, 28, 36, 0.95) 100%)"
                : "linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(207, 250, 254, 0.5) 100%)",
              borderColor: isDark
                ? "rgba(6, 182, 212, 0.35)"
                : "rgba(6, 182, 212, 0.25)",
              boxShadow: isDark
                ? "0 8px 30px rgba(0, 0, 0, 0.3)"
                : "0 8px 30px rgba(6, 182, 212, 0.08)",
            }}
          >
            <div className="flex items-start gap-3.5">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
                style={{
                  background: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 14px rgba(6, 182, 212, 0.3)",
                }}
              >
                <Code2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className="text-base sm:text-lg font-black tracking-tight"
                    style={{ color: isDark ? "#FFFFFF" : "#164E63" }}
                  >
                    Coding Round
                  </h2>
                  <span
                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border"
                    style={{
                      background: isDark ? "rgba(6, 182, 212, 0.25)" : "rgba(6, 182, 212, 0.12)",
                      color: isDark ? "#A5F3FC" : "#0E7490",
                      borderColor: isDark ? "rgba(6, 182, 212, 0.45)" : "rgba(6, 182, 212, 0.25)",
                    }}
                  >
                    IDE ROUND
                  </span>
                </div>
                <p
                  className="text-xs sm:text-sm mt-1 leading-relaxed"
                  style={{ color: isDark ? "#D1D5DB" : "#4B5563" }}
                >
                  Live algorithmic challenges evaluated against public & hidden testcases across target companies.
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={() => navigate("/coding-round")}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer flex items-center justify-center gap-2 shadow-lg transition-all"
              style={{
                background: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
                boxShadow: "0 4px 18px rgba(6, 182, 212, 0.35)",
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <span>Start Coding Round</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>

        {/* ── Recent Activity Card ── */}
        {hasActivity && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-[22px] p-5 space-y-4 transition-all"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-[#FF6B35]" />
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  Recent Activity
                </h3>
              </div>
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                In Progress
              </span>
            </div>

            <div className="space-y-3">
              {/* Aptitude Activity Item */}
              {lastAttempt && (
                <div
                  className="flex items-center justify-between p-3.5 rounded-xl border transition-all"
                  style={{
                    background: isDark ? "rgba(245, 158, 11, 0.06)" : "#FFFDF5",
                    borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "#FDE68A",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        background: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                        color: isDark ? "#F59E0B" : "#D97706",
                        borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#FCD34D",
                      }}
                    >
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                        Last Aptitude
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {lastAttempt.companyName || "Aptitude"} Practice
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold text-[#FF6B35]">
                      {lastAttempt.score ?? 1} marks
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {lastAttempt.percentage ?? 7}% accuracy
                    </p>
                  </div>
                </div>
              )}

              {/* Coding Activity Item */}
              {lastSubmission && (
                <div
                  className="flex items-center justify-between p-3.5 rounded-xl border transition-all"
                  style={{
                    background: isDark ? "rgba(6, 182, 212, 0.06)" : "#F0FDFA",
                    borderColor: isDark ? "rgba(6, 182, 212, 0.25)" : "#99F6E4",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        background: isDark ? "rgba(6, 182, 212, 0.15)" : "#CCFBF1",
                        color: isDark ? "#06B6D4" : "#0D9488",
                        borderColor: isDark ? "rgba(6, 182, 212, 0.3)" : "#5EEAD4",
                      }}
                    >
                      <Code2 className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                        Last Coding
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {lastSubmission.title || "Algorithm Problem"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>
                      {lastSubmission.passedCount ?? 0}/{lastSubmission.totalCount ?? 6} passed
                    </p>
                    <p className="text-[10px] font-bold" style={{ color: lastSubmission.status === "accepted" ? "#10B981" : "#EF4444" }}>
                      {lastSubmission.status === "accepted" ? "Accepted" : "Failed testcases"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <motion.button
              type="button"
              onClick={() => navigate(continueCompanyId ? `/interview-practice/${continueCompanyId}` : "/interview-practice")}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all"
              style={{
                background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                boxShadow: "0 6px 20px rgba(255, 107, 53, 0.30)",
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <span>Continue Practice</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}

        {/* ── Search & Filter Controls ── */}
        <section className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by company name, skills or description..."
              className="w-full pl-10 pr-9 py-3 rounded-2xl border text-xs sm:text-sm outline-none transition-all"
              style={{
                borderColor: "var(--border)",
                background: "var(--card-bg)",
                color: "var(--text-primary)",
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Selects — 3-column grid fitting screen */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 w-full">
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              style={{ padding: "8px 20px 8px 10px", fontSize: "11px", backgroundPosition: "right 6px center" }}
              className="w-full truncate rounded-xl border font-semibold outline-none cursor-pointer bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border)] transition-colors hover:border-[#FF6B35]/40"
            >
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            <select
              value={selectedSolvedStatus}
              onChange={(e) => setSelectedSolvedStatus(e.target.value)}
              style={{ padding: "8px 20px 8px 10px", fontSize: "11px", backgroundPosition: "right 6px center" }}
              className="w-full truncate rounded-xl border font-semibold outline-none cursor-pointer bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border)] transition-colors hover:border-[#FF6B35]/40"
            >
              <option value="">All Statuses</option>
              <option value="attempted">Attempted</option>
              <option value="not_attempted">Not Attempted</option>
              <option value="solved">Solved</option>
            </select>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{ padding: "8px 20px 8px 10px", fontSize: "11px", backgroundPosition: "right 6px center" }}
              className="w-full truncate rounded-xl border font-semibold outline-none cursor-pointer bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border)] transition-colors hover:border-[#FF6B35]/40"
            >
              <option value="">All Departments</option>
              <option value="Computer Engineering">Computer Engineering</option>
              <option value="IT Engineering">IT Engineering</option>
              <option value="Electronics Engineering">Electronics Engineering</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
              <option value="AI & DS">AI & DS</option>
            </select>
          </div>

          {hasFiltersActive && (
            <div className="flex justify-end pt-1">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg text-[#FF6B35] cursor-pointer hover:underline"
              >
                <X className="w-3 h-3" /> Clear Filters
              </button>
            </div>
          )}
        </section>

        {/* ── AVAILABLE COMPANIES ── */}
        <section id="available-companies-section" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              AVAILABLE COMPANIES ({filtered.length})
            </h2>
            <span className="text-xs font-bold text-[#FF6B35] cursor-pointer hover:underline">
              Sort by: Popular
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCompanyCard key={i} />
              ))}
            </div>
          ) : error ? (
            <ErrorState statusCode={errStatus} onRetry={fetchData} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 p-8 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <Building2 className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>No Companies Found</h3>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((company, i) => {
                const companyId = company.id || company._id;
                const hasCompanyAttempted = attemptedCompanyIds.has(companyId);
                const solvedCoding = new Set(
                  codingHistory.filter(s => s.companyId === companyId && s.status === "accepted").map(s => s.questionId)
                ).size;
                const totalCoding = company.codingCount || 3;
                const companyColorTheme = getCompanyColor(company.name);

                return (
                  <motion.div
                    key={companyId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                    onClick={() => navigate(`/interview-practice/${companyId}`)}
                    className="p-5 text-left cursor-pointer group rounded-[22px] border transition-all flex flex-col justify-between space-y-3"
                    style={{
                      background: "var(--card-bg)",
                      borderColor: "var(--border)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div>
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg overflow-hidden shrink-0 border"
                            style={{
                              background: companyColorTheme.bg,
                              color: companyColorTheme.text,
                              borderColor: `${companyColorTheme.border}40`,
                            }}
                          >
                            {company.logo ? (
                              <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                            ) : (
                              (company.name || "C")[0]
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                                {company.name}
                              </h3>
                              {hasCompanyAttempted && (
                                <span
                                  className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border"
                                  style={{
                                    background: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                                    color: isDark ? "#F59E0B" : "#D97706",
                                    borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#FCD34D",
                                  }}
                                >
                                  ATTEMPTED
                                </span>
                              )}
                            </div>
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {company.domain || company.track || "Recruitment Process"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(company, e)}
                          className="p-1.5 rounded-xl cursor-pointer transition hover:text-[#FF6B35]"
                          style={{ color: "var(--text-muted)" }}
                          aria-label="Bookmark company"
                        >
                          <Bookmark
                            className="w-4.5 h-4.5"
                            style={{
                              color: company.isFavorite ? "#FF6B35" : "currentColor",
                              fill: company.isFavorite ? "#FF6B35" : "none",
                            }}
                          />
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {company.description || `${company.name} standard placement drive and diagnostic assessments.`}
                      </p>
                    </div>

                    {/* Bottom row badges + CTA */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Aptitude badge */}
                        <div
                          className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border"
                          style={{
                            background: isDark ? "rgba(245, 158, 11, 0.10)" : "#FEF3C7",
                            color: isDark ? "#F59E0B" : "#B45309",
                            borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "#FDE68A",
                          }}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{hasCompanyAttempted ? `1/${company.aptitudeCount || 15} Completed` : `${company.aptitudeCount || 20} Aptitude`}</span>
                        </div>

                        {/* Coding badge */}
                        <div
                          className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border"
                          style={{
                            background: isDark ? "rgba(14, 165, 233, 0.10)" : "#E0F2FE",
                            color: isDark ? "#38BDF8" : "#0369A1",
                            borderColor: isDark ? "rgba(14, 165, 233, 0.25)" : "#BAE6FD",
                          }}
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          <span>{hasCompanyAttempted ? `${solvedCoding}/${totalCoding} Solved` : `${company.codingCount || 5} Coding`}</span>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-[#FF6B35] flex items-center gap-1 shrink-0 group-hover:translate-x-1 transition-transform">
                        {hasCompanyAttempted ? "Continue" : "Prepare"} <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

      </motion.div>

      {/* Individual Technical Start Modal */}
      <IndividualTechnicalStartModal
        isOpen={isTechModalOpen}
        onClose={() => setIsTechModalOpen(false)}
        onStartSuccess={(sessionId) => {
          navigate(`/individual-practice/technical/${sessionId}`);
        }}
      />

      {/* Individual Project Start Modal */}
      <IndividualProjectStartModal
        isOpen={isProjModalOpen}
        onClose={() => setIsProjModalOpen(false)}
        onStartSuccess={(sessionId) => {
          navigate(`/student/individual-project/practice/${sessionId}`);
        }}
      />
    </div>
  );
}

export default InterviewPractice;
