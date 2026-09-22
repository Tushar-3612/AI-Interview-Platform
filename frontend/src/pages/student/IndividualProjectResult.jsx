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
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Award,
  Download,
  FolderGit2,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";
import EvaluationLoadingScreen from "../../components/interview/EvaluationLoadingScreen";

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
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center space-y-4 font-sans select-none">
        <FolderGit2 className="w-10 h-10 text-orange-500 animate-bounce" />
        <p className="text-sm font-bold text-gray-400">Loading Project Practice Report...</p>
      </div>
    );
  }

  if (result?.status === "CALCULATING" || result?.status === "IN_PROGRESS") {
    return (
      <EvaluationLoadingScreen
        sessionId={sessionId}
        isIndividualProject={true}
        onCompleted={(completedData) => {
          setResult(completedData);
        }}
      />
    );
  }

  if (error || result?.status === "EVALUATION_FAILED") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans select-none">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold">Result Unavailable</h2>
        <p className="text-sm text-gray-400 max-w-md">{error || "AI Evaluation encountered an error or requires a retry."}</p>

        <div className="flex gap-3">
          <button
            onClick={handleRetryEvaluation}
            disabled={retrying}
            className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-xs uppercase cursor-pointer hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
          >
            <RotateCcw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
            <span>{retrying ? "Evaluating..." : "Retry Evaluation"}</span>
          </button>
          <button
            onClick={() => navigate("/interview-practice")}
            className="px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 font-bold text-xs uppercase cursor-pointer hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const obtainedScore = Number(result?.obtainedScore || 0);
  const percentage = Number(result?.percentage || 0);
  const attemptedCount = Number(result?.attemptedCount || 0);
  const unattemptedCount = Number(result?.unattemptedCount || Math.max(0, 10 - attemptedCount));

  // Performance Status Badge Config — Exact match with IndividualTechnicalResult
  let rawStatus = result?.performanceStatus || "NOT ASSESSED";
  if (attemptedCount === 0) {
    rawStatus = "NOT ASSESSED";
  } else if (percentage >= 70) {
    rawStatus = "STRONG";
  } else if (percentage >= 35) {
    rawStatus = "DEVELOPING";
  } else {
    rawStatus = "NEEDS IMPROVEMENT";
  }

  let statusBg = "bg-gray-800 text-gray-400 border-gray-700";
  if (rawStatus === "STRONG" || rawStatus === "Strong Performance") {
    statusBg = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  } else if (rawStatus === "DEVELOPING") {
    statusBg = "bg-amber-500/15 text-amber-400 border-amber-500/30";
  } else if (rawStatus === "NEEDS IMPROVEMENT" || rawStatus === "Needs Significant Improvement") {
    statusBg = "bg-red-500/15 text-red-400 border-red-500/30";
  }

  const questionResults = Array.isArray(result?.questionResults) ? result.questionResults : [];
  const totalPages = Math.ceil(questionResults.length / ITEMS_PER_PAGE) || 1;
  const paginatedQuestions = questionResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans select-none pb-20">
      {/* ── HEADER (Identical Prephire Technical Result System) ── */}
      <header className="sticky top-0 z-30 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 px-6 sm:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/interview-practice")}
            className="p-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
              PROJECT / RESUME PRACTICE RESULT REPORT
            </h1>
            <p className="text-[11px] text-gray-400">
              Session ID: <span className="font-mono text-orange-400">{sessionId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase cursor-pointer flex items-center gap-2 border border-gray-700 disabled:opacity-50 transition"
          >
            <Download className="w-4 h-4 text-orange-400" />
            <span>{downloadingPdf ? "Generating PDF..." : "Download PDF"}</span>
          </button>

          <button
            onClick={() => navigate("/interview-practice")}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase cursor-pointer shadow-lg shadow-orange-500/20"
          >
            New Practice Session
          </button>
        </div>
      </header>

      {/* ── CONTAINER (Standalone Full-Width max-w-[1600px]) ── */}
      <main className="w-[94%] max-w-[1600px] mx-auto pt-8 space-y-8">
        {/* ── METRICS SCORE HERO ── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-gray-900 border border-gray-800 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-6">
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                OVERALL PROJECT & RESUME PERFORMANCE
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Score Summary
              </h2>
            </div>

            <div className={`px-4 py-2 rounded-2xl border text-sm font-extrabold ${statusBg}`}>
              {rawStatus}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-gray-950 border border-gray-800 space-y-1">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Score</div>
              <div className="text-3xl font-black text-white">
                {obtainedScore} <span className="text-sm font-bold text-gray-500">/ 100</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gray-950 border border-gray-800 space-y-1">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Percentage</div>
              <div className="text-3xl font-black text-orange-400">
                {percentage}%
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gray-950 border border-gray-800 space-y-1">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Attempted</div>
              <div className="text-3xl font-black text-emerald-400">
                {attemptedCount} <span className="text-sm font-bold text-gray-500">/ 10</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gray-950 border border-gray-800 space-y-1">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Unattempted</div>
              <div className="text-3xl font-black text-gray-400">
                {unattemptedCount} <span className="text-sm font-bold text-gray-500">/ 10</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── EVIDENCE-BASED FEEDBACK SECTION ── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-gray-900 border border-gray-800 space-y-6 shadow-2xl">
          <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <span>EVIDENCE-BASED EVALUATION FEEDBACK</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance Insight */}
            <div className="p-5 rounded-2xl bg-gray-950 border border-gray-800 space-y-2 md:col-span-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                Performance Insight
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                {result?.feedback?.performanceInsight || "Evaluation analysis based on submitted responses."}
              </p>
            </div>

            {/* What Went Well */}
            <div className="p-5 rounded-2xl bg-gray-950 border border-gray-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> What Went Well
              </h4>
              {result?.feedback?.whatWentWell?.length > 0 ? (
                <ul className="space-y-2 text-xs text-gray-300">
                  {result.feedback.whatWentWell.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500 italic">No specific strengths recorded.</p>
              )}
            </div>

            {/* Focus Areas / Weak Areas */}
            <div className="p-5 rounded-2xl bg-gray-950 border border-gray-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Focus Areas
              </h4>
              {result?.feedback?.weakAreas?.length > 0 ? (
                <ul className="space-y-2 text-xs text-gray-300">
                  {result.feedback.weakAreas.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500 italic">No major weak areas identified.</p>
              )}
            </div>

            {/* Recommended Next Step */}
            <div className="p-5 rounded-2xl bg-gray-950 border border-gray-800 space-y-2 md:col-span-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Recommended Next Step
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                {result?.feedback?.recommendedNextStep || "Review incorrect questions and attempt another practice set."}
              </p>
            </div>
          </div>
        </section>

        {/* ── QUESTION-WISE DETAILED REVIEW (ALL 10 QUESTIONS) ── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-gray-900 border border-gray-800 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-4">
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-orange-500" />
              <span>QUESTION-WISE DETAILED REVIEW ({questionResults.length} QUESTIONS)</span>
            </h3>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs font-bold">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-lg bg-gray-800 border border-gray-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 rounded-lg bg-gray-800 border border-gray-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {paginatedQuestions.map((q, idx) => {
              const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
              const isAttempted = q.attempted;

              return (
                <div
                  key={q.questionId || idx}
                  className="p-5 rounded-2xl bg-gray-950 border border-gray-800 space-y-4"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-orange-400">
                        QUESTION {String(globalIdx).padStart(2, "0")}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                        {q.difficulty}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                        Topic: {q.topic || "Architecture"}
                      </span>
                      {q.projectName && (
                        <span className="text-[11px] font-bold text-orange-400/80">
                          ({q.projectName})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {isAttempted ? (
                        <span className="text-xs font-bold text-emerald-400 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                          ATTEMPTED
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-gray-400 px-2.5 py-0.5 rounded bg-gray-800 border border-gray-700">
                          NOT ATTEMPTED
                        </span>
                      )}
                      <span className="text-xs font-extrabold text-white">
                        Raw Score: {q.rawScore || 0} / {q.rawMaxScore || 10}
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="text-sm font-bold text-white">
                    Question: {q.question}
                  </div>

                  {/* Candidate Answer */}
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Candidate Original Answer:
                    </div>
                    <div
                      className={`p-3.5 rounded-xl border text-xs leading-relaxed font-mono ${
                        isAttempted
                          ? "bg-gray-900 border-gray-800 text-gray-200"
                          : "bg-gray-900/50 border-gray-800 text-gray-500 italic"
                      }`}
                    >
                      {isAttempted ? q.candidateAnswer : "NOT ATTEMPTED"}
                    </div>
                  </div>

                  {/* AI Evaluation / Feedback (Attempted only) */}
                  {isAttempted && q.feedback && (
                    <div className="space-y-1 pt-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-orange-400">
                        Evaluation Feedback:
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{q.feedback}</p>
                    </div>
                  )}

                  {/* Missing Concepts */}
                  {isAttempted && Array.isArray(q.missingPoints) && q.missingPoints.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Missing Concepts:
                      </div>
                      <ul className="list-disc list-inside text-xs text-gray-400 pl-1">
                        {q.missingPoints.map((mp, mIdx) => (
                          <li key={mIdx}>{mp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improved Answer */}
                  {q.improvedAnswer && (
                    <div className="space-y-1 pt-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Improved / Key Concepts Answer:
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed">
                        {q.improvedAnswer}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
