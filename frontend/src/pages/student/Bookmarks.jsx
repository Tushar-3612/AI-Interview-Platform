import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, BookmarkX, ArrowLeft, Search, Code2, BrainCircuit, Play, ExternalLink } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { SkeletonList, ErrorState } from "../../components/ui/Skeleton";
import toast from "react-hot-toast";

const DIFFICULTY_COLORS = { easy: "#22c55e", medium: "#eab308", hard: "#ef4444" };

function Bookmarks() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("aptitude"); // "aptitude" | "coding"
  const [aptitudeQuestions, setAptitudeQuestions] = useState([]);
  const [codingQuestions, setCodingQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errStatus, setErrStatus] = useState(null);
  
  // Reveals answers for aptitude questions
  const [revealed, setRevealed] = useState(new Set());
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");

  const fetchAptitudeBookmarks = useCallback(async () => {
    setLoading(true);
    setError(false);
    setErrStatus(null);
    try {
      const res = await api.get("/api/practice/bookmarks", { headers });
      setAptitudeQuestions(res.data?.questions || []);
    } catch (err) {
      setError(true);
      setErrStatus(err.response?.status || "network_failure");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCodingBookmarks = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("coding_bookmarks") || "[]");
      setCodingQuestions(saved);
    } catch {
      setCodingQuestions([]);
    }
  };

  useEffect(() => {
    fetchAptitudeBookmarks();
    loadCodingBookmarks();
  }, [fetchAptitudeBookmarks]);

  const handleRemoveAptitude = async (questionId) => {
    try {
      await api.post("/api/practice/bookmark", { questionId }, { headers });
      setAptitudeQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
      toast.success("Aptitude bookmark removed");
    } catch {
      toast.error("Failed to remove bookmark");
    }
  };

  const handleRemoveCoding = (qId) => {
    try {
      const saved = JSON.parse(localStorage.getItem("coding_bookmarks") || "[]");
      const updated = saved.filter(q => q._id !== qId);
      localStorage.setItem("coding_bookmarks", JSON.stringify(updated));
      setCodingQuestions(updated);
      // Optional: keep DB preferences in sync (although filtered out on fetch)
      api.post("/api/practice/bookmark", { questionId: qId }, { headers }).catch(() => null);
      toast.success("Coding bookmark removed");
    } catch {
      toast.error("Failed to remove bookmark");
    }
  };

  // Filter aptitude questions
  const filteredAptitude = useMemo(() => {
    return aptitudeQuestions.filter((q) => {
      const matchesSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
        q.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDifficulty = difficultyFilter ? q.difficulty?.toLowerCase() === difficultyFilter.toLowerCase() : true;
      return matchesSearch && matchesDifficulty;
    });
  }, [aptitudeQuestions, searchTerm, difficultyFilter]);

  // Filter coding questions
  const filteredCoding = useMemo(() => {
    return codingQuestions.filter((q) => {
      const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (q.problemStatement && q.problemStatement.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (q.companyName && q.companyName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesDifficulty = difficultyFilter ? q.difficulty?.toLowerCase() === difficultyFilter.toLowerCase() : true;
      return matchesSearch && matchesDifficulty;
    });
  }, [codingQuestions, searchTerm, difficultyFilter]);

  const hasFiltersActive = searchTerm || difficultyFilter;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm("");
    setDifficultyFilter("");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <Link
        to="/interview-practice"
        className="inline-flex items-center gap-2 text-sm font-medium mb-6 hover:opacity-80 transition"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Companies
      </Link>

      {/* Header Banner */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: "rgba(99,102,241,0.12)" }}>
            <Bookmark className="w-6 h-6" style={{ color: "#6366f1" }} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>My Bookmarks</h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Saved questions for interview revision and placement practice
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Segment Control Tabs */}
      <div className="flex border-b mb-6" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => handleTabChange("aptitude")}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === "aptitude"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <BrainCircuit className="w-4.5 h-4.5" />
          Aptitude Bookmarks ({aptitudeQuestions.length})
        </button>
        <button
          onClick={() => handleTabChange("coding")}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === "coding"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Code2 className="w-4.5 h-4.5" />
          Coding Bookmarks ({codingQuestions.length})
        </button>
      </div>

      {/* Search & Filter Inputs */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeTab === "aptitude" ? "Search questions or categories..." : "Search coding titles, companies..."}
            className="w-full pl-9 pr-4 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="relative min-w-[130px]">
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 rounded-xl border text-xs font-medium outline-none bg-[var(--input-bg)] cursor-pointer text-[var(--text-secondary)] select"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {hasFiltersActive && (
          <button
            onClick={() => { setSearchTerm(""); setDifficultyFilter(""); }}
            className="text-xs font-semibold px-2 py-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Bookmarks Render Area */}
      {loading && activeTab === "aptitude" ? (
        <SkeletonList count={3} />
      ) : error && activeTab === "aptitude" ? (
        <ErrorState statusCode={errStatus} message="Could not load your bookmarks." onRetry={fetchAptitudeBookmarks} />
      ) : activeTab === "aptitude" ? (
        filteredAptitude.length === 0 ? (
          <div className="student-card p-10 text-center bg-[var(--card-bg)]">
            <Bookmark className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {hasFiltersActive ? "No matching bookmarks" : "No Aptitude Bookmarks Yet"}
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-5">
              {hasFiltersActive 
                ? "Try adjusting your search query or difficulty dropdown values." 
                : "Bookmark challenging multiple-choice questions during aptitude tests to see them here."}
            </p>
            <button
              onClick={() => navigate("/interview-practice")}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer"
            >
              Continue Practice
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAptitude.map((q, idx) => (
              <motion.div key={q.questionId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                <div className="student-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                          {q.category}
                        </span>
                        {q.difficulty && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded capitalize"
                            style={{ background: `${DIFFICULTY_COLORS[q.difficulty]}15`, color: DIFFICULTY_COLORS[q.difficulty] }}
                          >
                            {q.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium mb-3 leading-relaxed text-[var(--text-primary)]">{q.question}</p>
                      
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`px-3 py-2 rounded-xl text-xs ${revealed.has(q.questionId) && opt === q.correctAnswer ? "font-semibold" : ""}`}
                            style={{
                              background: revealed.has(q.questionId) && opt === q.correctAnswer
                                ? "rgba(34,197,94,0.1)"
                                : "var(--input-bg)",
                              color: revealed.has(q.questionId) && opt === q.correctAnswer ? "#22c55e" : "var(--text-secondary)",
                            }}
                          >
                            {opt}
                            {revealed.has(q.questionId) && opt === q.correctAnswer && " ✓"}
                          </div>
                        ))}
                      </div>
                      
                      {revealed.has(q.questionId) && q.explanation && (
                        <p className="text-xs mt-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                          <span className="font-semibold text-[var(--text-primary)]">Explanation: </span>
                          {q.explanation}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAptitude(q.questionId)}
                      className="p-2 rounded-lg cursor-pointer text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0 transition"
                      title="Remove bookmark"
                    >
                      <BookmarkX className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-4 border-t pt-3 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>ID: {q.questionId}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setRevealed((prev) => {
                          const next = new Set(prev);
                          next.has(q.questionId) ? next.delete(q.questionId) : next.add(q.questionId);
                          return next;
                        })
                      }
                      className="text-xs font-semibold cursor-pointer hover:opacity-85 text-[var(--primary)]"
                    >
                      {revealed.has(q.questionId) ? "Hide Explanation" : "Reveal Answer & Explanation"}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      ) : (
        /* Coding Bookmarks Tab Render */
        filteredCoding.length === 0 ? (
          <div className="student-card p-10 text-center bg-[var(--card-bg)]">
            <Code2 className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {hasFiltersActive ? "No matching coding questions" : "No Coding Bookmarks Yet"}
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-5">
              {hasFiltersActive
                ? "Try adjusting your search query or difficulty filters."
                : "Bookmark complex algorithmic tasks in the code editor to view and solve them here."}
            </p>
            <button
              onClick={() => navigate("/interview-practice")}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer"
            >
              Start Coding Prep
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCoding.map((q, idx) => (
              <motion.div key={q._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                <div className="student-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {q.companyName && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                            {q.companyName}
                          </span>
                        )}
                        {q.difficulty && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded capitalize"
                            style={{ background: `${DIFFICULTY_COLORS[q.difficulty.toLowerCase()]}15`, color: DIFFICULTY_COLORS[q.difficulty.toLowerCase()] }}
                          >
                            {q.difficulty}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="font-bold text-base text-[var(--text-primary)] mb-1">{q.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-3 mb-4 leading-relaxed">
                        {q.problemStatement}
                      </p>

                      {q.tags && q.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {q.tags.map((tag, tIdx) => (
                            <span key={tIdx} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--border)] text-[var(--text-secondary)]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCoding(q._id)}
                      className="p-2 rounded-lg cursor-pointer text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0 transition"
                      title="Remove coding bookmark"
                    >
                      <BookmarkX className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <div className="mt-3 border-t pt-3 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>ID: {q._id}</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/interview-practice/${q.companyId}/coding`)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
                    >
                      Continue Solving <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default Bookmarks;
