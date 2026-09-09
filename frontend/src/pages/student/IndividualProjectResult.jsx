import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Trophy,
  Target,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  FolderGit2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Award,
  Download,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

export default function IndividualProjectResult() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 10;

  const fetchResult = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.get(`/api/individual/project/result/${sessionId}`, { headers });
      setResult(data.result || data);
    } catch (err) {
      console.error("Fetch Individual Project Result Error:", err);
      setError(err.response?.data?.message || err.message || "Failed to load result.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, token]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  const handleRetryEvaluation = async () => {
    setRetrying(true);
    const toastId = toast.loading("Retrying project evaluation...");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.post(
        `/api/individual/project/session/${sessionId}/retry-evaluation`,
        {},
        { headers }
      );

      if (data.result) {
        setResult(data.result);
        toast.success("Evaluation completed!", { id: toastId });
      } else {
        throw new Error("Evaluation did not finish.");
      }
    } catch (err) {
      console.error("Retry Error:", err);
      toast.error(err.response?.data?.message || "Failed to retry evaluation.", { id: toastId });
    } finally {
      setRetrying(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    const toastId = toast.loading("Generating Project Report PDF...");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await api.get(`/api/individual/project/result/${sessionId}/pdf`, {
        headers,
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Individual_Project_Result_${sessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("PDF Downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("PDF Download Error:", err);
      toast.error("Failed to download PDF report. Please try again.", { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-400 font-medium">Loading Project Result...</p>
      </div>
    );
  }

  if (error || result?.status === "EVALUATION_FAILED") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">Evaluation Unavailable</h2>
            <p className="text-sm text-gray-400 mt-2">{error || "AI Evaluation requires a retry."}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/practice")}
              className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold text-sm transition"
            >
              Back to Dashboard
            </button>
            <button
              onClick={handleRetryEvaluation}
              disabled={retrying}
              className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              <RotateCcw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
              <span>Retry Evaluation</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const obtainedScore = Number(result?.obtainedScore || 0);
  const maxScore = 100;
  const percentage = Number(result?.percentage || 0);
  const attemptedCount = Number(result?.attemptedCount || 0);
  const unattemptedCount = Number(result?.unattemptedCount || Math.max(0, 10 - attemptedCount));
  const performanceStatus = result?.performanceStatus || "NOT ASSESSED";
  const questionResults = Array.isArray(result?.questionResults) ? result.questionResults : [];

  const totalPages = Math.ceil(questionResults.length / ITEMS_PER_PAGE) || 1;
  const paginatedQuestions = questionResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/practice")}
              className="p-2.5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Project Round
                </span>
                <span className="text-xs text-gray-400">
                  Difficulty: {result?.difficulty || "Mixed"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
                Individual Project / Resume Practice Result
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPdf}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 font-bold text-sm text-white shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingPdf ? "Generating PDF..." : "Download PDF Report"}</span>
            </button>
          </div>
        </div>

        {/* Score & Stat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Score Banner */}
          <div className="md:col-span-2 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800/80 border border-gray-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden flex flex-col justify-between space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Total Performance Score
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-5xl font-black tracking-tight text-emerald-400">
                    {obtainedScore}
                  </span>
                  <span className="text-xl font-bold text-gray-400">/ 100 Marks</span>
                </div>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Trophy className="w-6 h-6" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800 text-center">
              <div>
                <p className="text-xs text-gray-400">Percentage</p>
                <p className="text-lg font-bold text-white mt-0.5">{percentage}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Attempted</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">{attemptedCount} / 10</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Unattempted</p>
                <p className="text-lg font-bold text-gray-400 mt-0.5">{unattemptedCount} / 10</p>
              </div>
            </div>
          </div>

          {/* Card 2: Performance Status */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Performance Level
              </p>
              <h3 className="text-xl font-extrabold text-white mt-2">{performanceStatus}</h3>
              <p className="text-xs text-gray-400 mt-2">
                Based on overall project architecture evaluation & solution correctness.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-800/50 border border-gray-800 flex items-center gap-3">
              <Award className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs text-gray-300">
                10 Deep Project Questions Scored out of 100.
              </div>
            </div>
          </div>
        </div>

        {/* Executive Feedback Section */}
        {result?.feedback && (
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-lg text-white">Executive AI Performance Feedback</h3>
            </div>

            {result.feedback.performanceInsight && (
              <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/40 p-4 rounded-2xl border border-gray-800">
                {result.feedback.performanceInsight}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.isArray(result.feedback.whatWentWell) &&
                result.feedback.whatWentWell.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Key Strengths
                    </h4>
                    <ul className="space-y-2">
                      {result.feedback.whatWentWell.map((item, idx) => (
                        <li key={idx} className="text-xs text-gray-300 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {Array.isArray(result.feedback.weakAreas) && result.feedback.weakAreas.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Areas for Growth
                  </h4>
                  <ul className="space-y-2">
                    {result.feedback.weakAreas.map((item, idx) => (
                      <li key={idx} className="text-xs text-gray-300 bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Question Results Breakdown (10 Questions) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-extrabold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <span>Detailed Question Breakdown (10 Questions)</span>
            </h3>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {paginatedQuestions.map((q, idx) => {
              const globalNum = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
              const isAnsProvided = Boolean(q.candidateAnswer && q.candidateAnswer !== "(No answer provided)");

              return (
                <div
                  key={q.questionId || idx}
                  className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-xl bg-gray-800 text-xs font-bold text-gray-300">
                        Q{globalNum}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                        {q.difficulty || "Medium"}
                      </span>
                      <span className="text-xs text-gray-400">{q.topic || "Architecture"}</span>
                      {q.projectName && (
                        <span className="text-xs text-emerald-400/80">({q.projectName})</span>
                      )}
                    </div>

                    <div className="text-sm font-black text-emerald-400">
                      Score: {q.rawScore || 0} / {q.rawMaxScore || 10} Marks
                    </div>
                  </div>

                  <p className="text-sm font-bold text-white">{q.question}</p>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-400">Your Answer:</div>
                    <div
                      className={`text-xs p-3.5 rounded-2xl border ${
                        isAnsProvided
                          ? "bg-gray-800/50 border-gray-800 text-gray-200"
                          : "bg-red-500/5 border-red-500/20 text-red-400 italic"
                      }`}
                    >
                      {q.candidateAnswer || "(No answer provided)"}
                    </div>
                  </div>

                  {q.feedback && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-emerald-400">AI Feedback:</div>
                      <p className="text-xs text-gray-300 leading-relaxed">{q.feedback}</p>
                    </div>
                  )}

                  {Array.isArray(q.missingPoints) && q.missingPoints.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-amber-400">Missing Concepts:</div>
                      <ul className="list-disc list-inside text-xs text-gray-400 pl-1">
                        {q.missingPoints.map((mp, mIdx) => (
                          <li key={mIdx}>{mp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {q.improvedAnswer && (
                    <div className="space-y-1 bg-emerald-500/5 border border-emerald-500/20 p-3.5 rounded-2xl">
                      <div className="text-xs font-bold text-emerald-400">Recommended Exemplar Answer:</div>
                      <p className="text-xs text-gray-300 italic">{q.improvedAnswer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
