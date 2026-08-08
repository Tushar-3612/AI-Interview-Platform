import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { 
  Building2, Search, ArrowRight, BookOpen, Code2, Heart, History, Clock, X
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { SkeletonCompanyCard, ErrorState } from "../../components/ui/Skeleton";
import { timeAgo } from "../../utils/dateUtils";

function InterviewPractice() {
  const navigate = useNavigate();
  const token = getAuthToken();

  const [companies, setCompanies] = useState([]);
  const [recent, setRecent] = useState(null);
  const [aptitudeHistory, setAptitudeHistory] = useState([]);
  const [codingHistory, setCodingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errStatus, setErrStatus] = useState(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Calculate progress stats for each company
  const companyProgress = useMemo(() => {
    const progressMap = {};
    companies.forEach((company) => {
      const companyId = company.id || company._id;
      // Coding solved percentage
      const companySubmissions = codingHistory.filter(s => s.companyId === companyId);
      const uniqueCodingSolved = new Set(companySubmissions.filter(s => s.status === "accepted").map(s => s.questionId)).size;
      const totalCodingCount = company.codingCount || 1;
      const codingPct = Math.min((uniqueCodingSolved / totalCodingCount) * 100, 100);

      // Aptitude score percentage
      const companyAptAttempts = aptitudeHistory.filter(a => a.companyId === companyId);
      const bestAptAttempt = companyAptAttempts.reduce((max, cur) => cur.percentage > max ? cur.percentage : max, 0);
      
      const overall = Math.round((codingPct + bestAptAttempt) / 2);
      progressMap[companyId] = {
        codingPct,
        bestAptAttempt,
        overall: Math.min(overall, 100)
      };
    });
    return progressMap;
  }, [companies, codingHistory, aptitudeHistory]);

  const toggleFavorite = async (company, e) => {
    e.stopPropagation();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const companyId = company.id || company._id;
      const res = await api.post("/api/practice/favorite-company", { companyId }, { headers });
      setCompanies((prev) => prev.map((c) => (c.id === companyId || c._id === companyId ? { ...c, isFavorite: res.data.favorited } : c)));
      toast.success(res.data.favorited ? `${company.name} added to favorites` : "Removed from favorites");
    } catch {
      toast.error("Failed to update favorite");
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

  const favorites = useMemo(() => {
    return companies.filter(c => c.isFavorite);
  }, [companies]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDifficulty("");
    setSelectedDept("");
    setSelectedSolvedStatus("");
  };

  const hasFiltersActive = searchTerm || selectedDifficulty || selectedDept || selectedSolvedStatus;
  const lastAttempt = recent?.lastAttempt;
  const lastSubmission = recent?.lastSubmission;
  const hasActivity = lastAttempt || lastSubmission;
  const continueCompanyId = lastAttempt?.companyId || lastSubmission?.companyId;

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#FF9800" }}>
            Placement Preparation
          </h1>
          <button
            type="button"
            onClick={() => navigate("/practice/aptitude/history")}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-[10px] border cursor-pointer transition"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--card-bg)" }}
          >
            <History className="w-3.5 h-3.5" /> My Practice History
          </button>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Select a company to begin your placement preparation assessments
        </p>

        {/* Recent Activity bar */}
        {hasActivity && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 mb-8 flex flex-wrap items-center gap-4 rounded-[14px] border"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}>
              <Clock className="w-3.5 h-3.5" /> Recent Activity
            </div>
            {lastAttempt && (
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="font-semibold" style={{ color: "#FF9800" }}>Last Aptitude:</span>{" "}
                {lastAttempt.companyName} — {lastAttempt.score} marks · {lastAttempt.percentage}% · {timeAgo(lastAttempt.createdAt)}
              </div>
            )}
            {lastSubmission && (
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="font-semibold" style={{ color: "#FB6C00" }}>Last Coding:</span>{" "}
                {lastSubmission.title} — {lastSubmission.status === "accepted" ? "Accepted" : `${lastSubmission.passedCount}/${lastSubmission.totalCount} passed`} · {timeAgo(lastSubmission.createdAt)}
              </div>
            )}
            {continueCompanyId && (
              <button
                type="button"
                onClick={() => navigate(`/interview-practice/${continueCompanyId}`)}
                className="ml-auto flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-[10px] text-white cursor-pointer transition hover:opacity-90"
                style={{
                  background: "#FB6C00",
                  boxShadow: "0 4px 14px rgba(230, 8, 8, 0.54)",
                }}
              >
                Continue Practice <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </motion.div>
        )}

        {/* Favorite Companies Section */}
        {favorites.length > 0 && !loading && (
          <section className="mb-8 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <Heart className="w-3.5 h-3.5" style={{ color: "rgb(170, 107, 228)" }} /> Favorite Companies
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {favorites.map((company) => {
                const companyId = company.id || company._id;
                const progress = companyProgress[companyId] || { overall: 0 };
                return (
                  <motion.div
                    key={`fav-${companyId}`}
                    layoutId={`fav-card-${companyId}`}
                    className="p-5 relative overflow-hidden flex flex-col justify-between rounded-[18px] border transition-all duration-200"
                    style={{
                      background: "var(--card-bg)",
                      borderColor: "var(--border)",
                      boxShadow: "var(--shadow-card)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                          style={{ background: company.color }}
                        >
                          {company.logo ? (
                            <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                          ) : (
                            company.name[0]
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{company.name}</h3>
                          <span className="text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>{company.difficulty} Prep</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => toggleFavorite(company, e)}
                        className="p-1 rounded-lg cursor-pointer transition hover:opacity-80"
                      >
                        <Heart className="w-4 h-4" style={{ color: "rgb(170, 107, 228)" }} />
                      </button>
                    </div>

                    {/* Progress details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span style={{ color: "var(--text-secondary)" }}>Practice Progress</span>
                        <span style={{ color: "var(--text-primary)" }}>{progress.overall}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progress.overall}%`,
                            background: "rgb(170, 107, 228)",
                          }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/interview-practice/${companyId}`)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-xs font-semibold border cursor-pointer transition duration-200"
                      style={{ borderColor: "#FB6C00", color: "#000080", background: "#EF6905" }}
                    >
                      Continue Practice <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Filter and Search Section */}
        <section className="p-4 sm:p-5 mb-8 space-y-4 rounded-[14px] border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search field */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by company name, skills or description..."
                className="w-full pl-9 pr-8 py-2.5 rounded-[10px] border text-xs outline-none transition"
                style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Difficulty Filter */}
            <div className="relative min-w-[130px]">
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 rounded-[10px] border text-xs font-medium outline-none cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-secondary)" }}
              >
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {/* Solved Status Filter */}
            <div className="relative min-w-[140px]">
              <select
                value={selectedSolvedStatus}
                onChange={(e) => setSelectedSolvedStatus(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 rounded-[10px] border text-xs font-medium outline-none cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-secondary)" }}
              >
                <option value="">All Statuses</option>
                <option value="attempted">Attempted</option>
                <option value="not_attempted">Not Attempted</option>
                <option value="solved">Solved (Target Passed)</option>
                <option value="unsolved">Unsolved (In Progress)</option>
              </select>
            </div>

            {/* Department Filter */}
            <div className="relative min-w-[140px]">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 rounded-[10px] border text-xs font-medium outline-none cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-secondary)" }}
              >
                <option value="">All Departments</option>
                <option value="computer">Computer Engineering</option>
                <option value="it">IT Engineering</option>
                <option value="electronics">Electronics</option>
                <option value="mechanical">Mechanical</option>
                <option value="civil">Civil Engineering</option>
                <option value="entc">ENTC Engineering</option>
                <option value="ai">AI & DS</option>
              </select>
            </div>

            {hasFiltersActive && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-[10px] cursor-pointer transition ml-auto"
                style={{ color: "#FF9800" }}
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>
        </section>

        {/* Main Content Layout */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCompanyCard key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState statusCode={errStatus} onRetry={fetchData} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 p-10 rounded-[18px] border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
            <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>No Companies Found</h2>
            <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>
              {hasFiltersActive 
                ? "No placement preparation plans match your active filter or search keywords." 
                : "Placement preparation plans are currently being configured by placement coordinators."}
            </p>
            {hasFiltersActive && (
              <button
                onClick={clearFilters}
                className="px-5 py-2.5 rounded-[10px] text-xs font-bold text-white cursor-pointer"
                style={{
                  background: "rgb(170, 107, 228)",
                  boxShadow: "0 4px 14px rgba(170, 107, 228, 0.3)",
                }}
              >
                Reset Search Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((company, i) => {
              const companyId = company.id || company._id;
              const hasCompanyAttempted = attemptedCompanyIds.has(companyId);
              const solvedCoding = new Set(
                codingHistory.filter(s => s.companyId === companyId && s.status === "accepted").map(s => s.questionId)
              ).size;
              const totalCoding = company.codingCount || 0;
              return (
                <motion.div
                  key={companyId}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  onClick={() => navigate(`/interview-practice/${companyId}`)}
                  className="p-5 text-left cursor-pointer group relative overflow-hidden flex flex-col justify-between rounded-[18px] border transition-all duration-200"
                  style={{
                    background: "var(--card-bg)",
                    borderColor: "var(--border)",
                    boxShadow: "var(--shadow-card)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "color-mix(in srgb, var(--border) 50%, rgb(170, 107, 228) 20%)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div className="relative w-full">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-11 h-11 rounded-[12px] flex items-center justify-center text-white font-bold text-base overflow-hidden"
                        style={{ background: company.color }}
                      >
                        {company.logo ? (
                          <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                        ) : (
                          company.name[0]
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(company, e)}
                        className="p-1.5 rounded-lg cursor-pointer transition hover:opacity-80"
                        aria-label="Toggle favorite"
                      >
                        <Heart
                          className="w-4 h-4"
                          style={{ color: company.isFavorite ? "rgb(170, 107, 228)" : "var(--text-muted)", fill: company.isFavorite ? "rgb(170, 107, 228)" : "none" }}
                        />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {company.name}
                      </h3>
                      {hasCompanyAttempted && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ background: "rgba(77, 163, 255, 0.1)", color: "#4DA3FF" }}>
                          Attempted
                        </span>
                      )}
                    </div>

                    <p className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                      {company.description || `${company.name} recruitment process`}
                    </p>

                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(255, 152, 0, 0.08)", color: "#FF9800" }}>
                        <BookOpen className="w-2.5 h-2.5" /> {company.aptitudeCount || 0} Aptitude
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(77, 163, 255, 0.08)", color: "#4DA3FF" }}>
                          <Code2 className="w-2.5 h-2.5" /> {solvedCoding} / {totalCoding} Coding
                        </div>
                        {totalCoding > 0 && (
                          <div className="w-full h-1 rounded-full overflow-hidden mx-2" style={{ background: "var(--border)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min((solvedCoding / totalCoding) * 100, 100)}%`,
                                background: "#EF6905",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t w-full" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{
                          background: company.difficulty === "Easy" ? "rgba(34,197,94,0.08)" : company.difficulty === "Hard" ? "rgba(239,68,68,0.08)" : "rgba(234,179,8,0.08)",
                          color: company.difficulty === "Easy" ? "#22c55e" : company.difficulty === "Hard" ? "#ef4444" : "#eab308",
                        }}
                      >
                        {company.difficulty}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }} title="Last updated">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo(company.lastUpdated)}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 transition-all duration-200 group-hover:translate-x-0.5" style={{ color: "var(--text-muted)" }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default InterviewPractice;
