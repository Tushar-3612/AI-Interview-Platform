import React, { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Filter,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

/**
 * Reusable helper for Round Performance Status based on Zero Attempt Rule:
 * - if attemptedCount === 0: status is "NOT ATTEMPTED" (neutral, zero judgment)
 * - if attemptedCount > 0: percentage = (score / maxScore) * 100
 *   < 35%: Red ("NEEDS IMPROVEMENT")
 *   35% - 69.99%: Amber ("GOOD PROGRESS")
 *   >= 70%: Green ("STRONG PERFORMANCE")
 */
export function getRoundPerformanceStatus(attemptedCount, score, maxScore) {
  const attempted = Number(attemptedCount) || 0;
  if (attempted === 0) {
    return {
      label: "NOT ATTEMPTED",
      type: "not_attempted",
      badgeBg: "bg-[#1e202c]",
      badgeBorder: "border-[#2d3042]",
      textColor: "text-slate-400",
      barBg: "bg-slate-700",
    };
  }

  const max = Number(maxScore) || 1;
  const percentage = (Number(score) / max) * 100;

  if (percentage < 35) {
    return {
      label: "NEEDS IMPROVEMENT",
      type: "needs_improvement",
      badgeBg: "bg-red-500/10",
      badgeBorder: "border-red-500/30",
      textColor: "text-red-400",
      barBg: "bg-red-500",
    };
  }

  if (percentage < 70) {
    return {
      label: "GOOD PROGRESS",
      type: "good_progress",
      badgeBg: "bg-amber-500/10",
      badgeBorder: "border-amber-500/30",
      textColor: "text-amber-400",
      barBg: "bg-amber-500",
    };
  }

  return {
    label: "STRONG PERFORMANCE",
    type: "strong",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/30",
    textColor: "text-emerald-400",
    barBg: "bg-emerald-500",
  };
}

/**
 * Helper for overall performance status from total percentage score.
 */
export function getOverallPerformanceStatus(percentage) {
  const pct = Number(percentage) || 0;
  if (pct >= 70) {
    return {
      label: "STRONG PERFORMANCE",
      badgeBg: "bg-emerald-500/10",
      badgeBorder: "border-emerald-500/30",
      textColor: "text-emerald-400",
      barBg: "bg-emerald-500",
    };
  }
  if (pct >= 35) {
    return {
      label: "GOOD PROGRESS",
      badgeBg: "bg-amber-500/10",
      badgeBorder: "border-amber-500/30",
      textColor: "text-amber-400",
      barBg: "bg-amber-500",
    };
  }
  return {
    label: "NEEDS IMPROVEMENT",
    badgeBg: "bg-red-500/10",
    badgeBorder: "border-red-500/30",
    textColor: "text-red-400",
    barBg: "bg-red-500",
  };
}

/**
 * Evidence-based performance feedback builder for attempted and unattempted rounds.
 * NO generic AI chatbot filler, NO emojis, NO motivation fluff.
 */
export function buildEvidenceBasedRoundFeedback(roundKey, roundName, attemptedCount, totalQuestions, score, maxScore, questionResults = []) {
  if (!attemptedCount || attemptedCount === 0) {
    return {
      roundName,
      statusLabel: "NOT ASSESSED",
      isAttempted: false,
      insight: `This section was not attempted, so there is not enough response data to evaluate ${roundName.toLowerCase()} performance.`,
      strengths: [],
      focusAreas: [],
      nextStep: "Attempt this round in your next session to receive detailed evaluation metrics.",
    };
  }

  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const roundQuestions = questionResults.filter((q) => {
    if (roundKey === "aptitude") return q.roundType === "APTITUDE";
    if (roundKey === "technical") return q.roundType === "TECHNICAL";
    if (roundKey === "project") return q.roundType === "RESUME_PROJECT";
    if (roundKey === "hr") return q.roundType === "HR";
    if (roundKey === "coding") return q.roundType === "CODING";
    return false;
  });

  const correctCount = roundQuestions.filter((q) => q.status === "CORRECT").length;
  const storedNotes = roundQuestions
    .map((q) => q.feedback)
    .filter((fb) => fb && fb.trim() !== "" && !fb.includes("Incorrect choice") && !fb.includes("Correct answer is"));

  let statusLabel = "NEEDS IMPROVEMENT";
  if (pct >= 70) statusLabel = "STRONG PERFORMANCE";
  else if (pct >= 35) statusLabel = "GOOD PROGRESS";

  let insight = "";
  let strengths = [];
  let focusAreas = [];
  let nextStep = "";

  if (roundKey === "aptitude") {
    if (pct >= 70) {
      insight = `Your responses show strong analytical accuracy and quantitative problem-solving skills (${correctCount}/${totalQuestions} correct).`;
      strengths = ["High calculation precision across attempted numerical problems.", `Successfully solved ${correctCount} aptitude questions.`];
      focusAreas = ["Maintain precision across complex multi-step reasoning problems."];
      nextStep = "Practice advanced timed aptitude sets to maintain consistency under strict time limits.";
    } else if (pct >= 35) {
      insight = `Your responses show that you can solve direct quantitative problems, but accuracy becomes less consistent when multiple reasoning steps are required (${correctCount}/${attemptedCount} correct).`;
      strengths = [`Completed ${attemptedCount} out of ${totalQuestions} aptitude questions.`, "Demonstrated correct methodology on direct calculation problems."];
      focusAreas = ["Improve accuracy in multi-step quantitative problems.", "Verify calculations before finalizing an option choice."];
      nextStep = "Review incorrect questions by identifying where calculation or reasoning first diverged.";
    } else {
      insight = `Response accuracy across the aptitude section indicates fundamental gaps in quantitative methods and logical problem-solving (${correctCount}/${attemptedCount} correct).`;
      strengths = [`Completed ${attemptedCount} questions in the aptitude section.`];
      focusAreas = ["Strengthen core mathematical formulas and shortcut techniques.", "Improve question interpretation and structured problem decomposition."];
      nextStep = "Focus on foundational quantitative topics before attempting full-length timed tests.";
    }
  } else if (roundKey === "technical") {
    if (pct >= 70) {
      insight = `Demonstrates thorough technical domain knowledge and strong conceptual clarity across core engineering topics (${score}/${maxScore} score).`;
      strengths = ["Strong explanation quality and conceptual accuracy.", "Articulates software engineering fundamentals effectively."];
      focusAreas = ["Incorporate architectural trade-offs and edge-case considerations into responses."];
      nextStep = "Practice deeper system design discussions and trade-off analysis for advanced technical rounds.";
    } else if (pct >= 35) {
      insight = `Displays foundational technical knowledge, but responses lack depth when explaining underlying mechanics and architectural trade-offs (${score}/${maxScore} score).`;
      strengths = ["Correctly identified primary technical concepts in attempted questions.", `Completed ${attemptedCount} out of ${totalQuestions} technical evaluation questions.`];
      focusAreas = ["Elaborate on internal workings, data flow, and underlying system mechanics.", "Structure technical responses using definition, mechanism, and use-case frameworks."];
      nextStep = "Deepen understanding of core theoretical concepts and practice explaining technical mechanisms aloud.";
    } else {
      insight = `Technical evaluation indicates limited depth in core engineering concepts and technical reasoning (${score}/${maxScore} score).`;
      strengths = [`Attempted ${attemptedCount} technical questions.`];
      focusAreas = ["Build solid fundamentals in data structures, operating systems, and database internals.", "Avoid superficial definitions; provide concrete technical details and examples."];
      nextStep = "Review fundamental technical subject material and practice answering core interview questions in detail.";
    }
  } else if (roundKey === "project") {
    if (pct >= 70) {
      insight = `Excellent articulation of project architecture, technical stack decisions, and real-world engineering challenges (${score}/${maxScore} score).`;
      strengths = ["Clear explanation of project architecture and personal contributions.", "Strong technical justification for database and API decisions."];
      focusAreas = ["Detail scalability bottlenecks and production deployment monitoring."];
      nextStep = "Prepare deeper metrics and benchmark results for key system bottlenecks in your portfolio projects.";
    } else if (pct >= 35) {
      insight = `Satisfactory overview of portfolio projects, but explanations lacked technical granularity regarding architectural trade-offs (${score}/${maxScore} score).`;
      strengths = ["Clearly stated project objectives and tech stack.", `Answered ${attemptedCount} project questions.`];
      focusAreas = ["Provide specific implementation details rather than generic feature descriptions.", "Explain challenges faced and exact debugging techniques used."];
      nextStep = "Document system architecture diagrams, API schemas, and key technical challenges for all portfolio projects.";
    } else {
      insight = `Project evaluation indicates difficulty in defending architectural decisions and technical implementation details (${score}/${maxScore} score).`;
      strengths = [`Attempted ${attemptedCount} project questions.`];
      focusAreas = ["Revisit project codebases to recall exact implementations, schema designs, and data flows.", "Practice explaining personal contributions vs team contributions clearly."];
      nextStep = "Perform a technical audit of your projects to articulate architecture and implementation details with confidence.";
    }
  } else if (roundKey === "hr") {
    if (pct >= 70) {
      insight = `Strong behavioral responses demonstrating leadership, structured decision-making, and clear professional communication (${score}/${maxScore} score).`;
      strengths = ["Clear, structured behavioral responses highlighting personal accountability.", "Effective demonstration of adaptability, teamwork, and problem resolution."];
      focusAreas = ["Ensure all behavioral answers conclude with quantifiable business impact."];
      nextStep = "Refine behavioral scenarios using the STAR technique with emphasis on measurable results.";
    } else if (pct >= 35) {
      insight = `Good communication style, but behavioral examples could be structured more effectively using situation-action-result frameworks (${score}/${maxScore} score).`;
      strengths = ["Professional demeanor and clear articulation.", `Attempted ${attemptedCount} behavioral questions.`];
      focusAreas = ["Use the STAR method (Situation, Task, Action, Result) to structure answers.", "Highlight personal ownership and specific actions taken."];
      nextStep = "Draft structured story archives mapped to standard behavioral competencies.";
    } else {
      insight = `Behavioral evaluation highlights need for improved response structure and personal accountability narrative (${score}/${maxScore} score).`;
      strengths = [`Completed ${attemptedCount} behavioral questions.`];
      focusAreas = ["Structure responses clearly to avoid vague or overly brief answers.", "Focus on demonstrating ownership and constructive conflict resolution."];
      nextStep = "Practice framing past experiences into structured narratives that demonstrate professional growth.";
    }
  } else if (roundKey === "coding") {
    if (pct >= 70) {
      insight = `Strong algorithmic problem-solving, clean code structure, and successful test case execution (${score}/${maxScore} score).`;
      strengths = ["Correct algorithmic logic and syntax implementation.", "Successful compilation and passing execution across test cases."];
      focusAreas = ["Analyze and state optimal time and space complexity explicitly."];
      nextStep = "Practice hard-level algorithmic problems and focus on time-complexity optimization.";
    } else if (pct >= 35) {
      insight = `Demonstrates basic problem-solving logic, but submitted code encountered edge-case failures or sub-optimal complexity (${score}/${maxScore} score).`;
      strengths = [`Submitted code attempts for ${attemptedCount} coding challenges.`, "Identified correct initial data structures."];
      focusAreas = ["Handle edge cases (empty inputs, boundary conditions) thoroughly before submission.", "Improve code optimization to meet execution time limits."];
      nextStep = "Practice dry-running code against edge-case inputs prior to execution and submission.";
    } else {
      insight = `Coding evaluation indicates difficulty in implementing functional solutions within required syntax and execution constraints (${score}/${maxScore} score).`;
      strengths = [`Submitted code attempts for ${attemptedCount} problem(s).`];
      focusAreas = ["Strengthen mastery of standard language syntax and array manipulation.", "Practice translating logic into clean, compilable code under timed conditions."];
      nextStep = "Focus on easy-to-medium coding problems to build syntax fluency and algorithmic confidence.";
    }
  }

  if (storedNotes.length > 0 && storedNotes[0].length > 15) {
    strengths.push(`Evaluator Note: ${storedNotes[0]}`);
  }

  return {
    roundName,
    statusLabel,
    isAttempted: true,
    insight,
    strengths,
    focusAreas,
    nextStep,
  };
}

/**
 * Single authoritative normalization helper for Real Interview Results.
 */
export function normalizeRealInterviewResult(rawPayload) {
  if (!rawPayload) return null;

  let doc = rawPayload;
  if (rawPayload.result && typeof rawPayload.result === "object") {
    doc = rawPayload.result;
  } else if (rawPayload.data && typeof rawPayload.data === "object" && rawPayload.data.totalObtained !== undefined) {
    doc = rawPayload.data;
  }

  const totalObtained = Number(doc.totalObtained ?? doc.overallScore ?? doc.totalScore ?? 0);
  const maxScore = Number(doc.maximumMarks ?? doc.maxScore ?? doc.maximum ?? 450);
  const percentage = typeof doc.percentage === "number"
    ? doc.percentage
    : maxScore > 0
    ? Number(((totalObtained / maxScore) * 100).toFixed(2))
    : 0;

  const rounds = doc.rounds || {};
  const questionResults = Array.isArray(doc.questionResults) ? doc.questionResults : [];

  const parseRound = (roundKey, defaultTotalQ, defaultMax) => {
    const rObj = rounds[roundKey] || {};
    const qRoundKey = roundKey === "project" ? "RESUME_PROJECT" : roundKey.toUpperCase();
    const roundQuestions = questionResults.filter((q) => q.roundType === qRoundKey || (roundKey === "aptitude" && q.roundType === "APTITUDE"));

    const attemptedCount = typeof rObj.attempted === "number"
      ? rObj.attempted
      : roundQuestions.filter((q) => q.status !== "NOT_ATTEMPTED" && q.candidateAnswer && q.candidateAnswer !== "Not Answered" && q.candidateAnswer !== "Not Submitted").length;

    const score = Number(rObj.obtained ?? 0);
    const max = Number(rObj.maximum ?? defaultMax);

    return {
      score,
      maxScore: max,
      attemptedCount,
      totalQuestions: Number(rObj.totalQuestions ?? defaultTotalQ),
    };
  };

  const apt = parseRound("aptitude", 15, 50);
  const tech = parseRound("technical", 20, 100);
  const proj = parseRound("project", 10, 100);
  const hr = parseRound("hr", 5, 100);
  const coding = parseRound("coding", 3, 100);

  const attemptedCount = typeof doc.attemptedQuestionsCount === "number"
    ? doc.attemptedQuestionsCount
    : (apt.attemptedCount + tech.attemptedCount + proj.attemptedCount + hr.attemptedCount + coding.attemptedCount);

  const totalCount = typeof doc.totalQuestionsCount === "number"
    ? doc.totalQuestionsCount
    : (questionResults.length > 0 ? questionResults.length : 53);

  const unattemptedCount = typeof doc.unattemptedQuestionsCount === "number"
    ? doc.unattemptedQuestionsCount
    : Math.max(0, totalCount - attemptedCount);

  return {
    sessionId: doc.sessionId || "",
    status: doc.status || "COMPLETED",
    candidateName: doc.candidateName || "",
    candidateEmail: doc.candidateEmail || "",
    completedAt: doc.completedAt || doc.createdAt || null,
    totalObtained,
    maxScore,
    percentage,
    rounds: {
      aptitude: apt,
      technical: tech,
      project: proj,
      hr,
      coding,
    },
    attemptedCount,
    unattemptedCount,
    totalCount,
    questionResults,
  };
}

const PAGE_SIZE = 10;

export default function Results({ sessionId: propSessionId, initialResultData }) {
  const token = getAuthToken();
  const { interviewId, sessionId: paramSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeId =
    propSessionId ||
    paramSessionId ||
    interviewId ||
    searchParams.get("session") ||
    searchParams.get("interviewId") ||
    searchParams.get("id");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evalFailed, setEvalFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState("");
  const [roundFilter, setRoundFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedItems, setExpandedItems] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let isCancelled = false;

    const fetchResult = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        if (initialResultData && initialResultData.status === "COMPLETED" && initialResultData.totalObtained !== undefined) {
          const norm = normalizeRealInterviewResult(initialResultData);
          if (norm && !isCancelled) {
            console.log(`[RESULT-FRONTEND] sessionId=${activeId || norm.sessionId} totalObtained=${norm.totalObtained} maxScore=${norm.maxScore} percentage=${norm.percentage} questionCount=${norm.totalCount}`);
            setResult(norm);
            setLoading(false);
            return;
          }
        }

        if (activeId) {
          const res = await api.get(`/api/real-interview/result/${activeId}`, { headers }).catch((err) => {
            console.warn(`[RESULT-FRONTEND] fetch warning:`, err.message);
            return { status: err.response?.status || 500, data: null };
          });

          if (isCancelled) return;

          if (res.data?.status === "EVALUATION_FAILED") {
            setEvalFailed(true);
            setLoading(false);
            return;
          }

          if (res.data?.success && res.data?.result) {
            const norm = normalizeRealInterviewResult(res.data);
            if (norm) {
              console.log(`[RESULT-FRONTEND] sessionId=${activeId} totalObtained=${norm.totalObtained} maxScore=${norm.maxScore} percentage=${norm.percentage} questionCount=${norm.totalCount}`);
              setResult(norm);
              setLoading(false);
              return;
            }
          }

          // Fallback status check
          const { data: statusData } = await api.get(`/api/real-interview/result/${activeId}/status`, { headers }).catch(() => ({ data: null }));
          if (isCancelled) return;

          if (statusData && statusData.status === "EVALUATION_FAILED") {
            setEvalFailed(true);
            setLoading(false);
            return;
          }

          if (statusData && statusData.status === "COMPLETED") {
            const retryRes = await api.get(`/api/real-interview/result/${activeId}`, { headers }).catch(() => null);
            if (!isCancelled && retryRes?.data?.success && retryRes?.data?.result) {
              const norm = normalizeRealInterviewResult(retryRes.data);
              console.log(`[RESULT-FRONTEND] sessionId=${activeId} totalObtained=${norm.totalObtained} maxScore=${norm.maxScore} percentage=${norm.percentage} questionCount=${norm.totalCount}`);
              setResult(norm);
              setLoading(false);
              return;
            }
          }

          setError("Interview evaluation result is not available yet for session: " + activeId);
          setLoading(false);
          return;
        }

        setError("No active interview session ID provided.");
        setLoading(false);
      } catch (err) {
        if (!isCancelled) setError(err.message || "Failed to load result.");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchResult();

    return () => {
      isCancelled = true;
    };
  }, [activeId, initialResultData, token]);

  const handleTryAgain = async () => {
    if (!activeId) return;
    setRetrying(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.post(`/api/real-interview/result/${activeId}/retry`, {}, { headers });
      if (data.success && data.result) {
        const norm = normalizeRealInterviewResult(data);
        setResult(norm);
        setEvalFailed(false);
      } else if (data.status === "EVALUATION_FAILED") {
        setEvalFailed(true);
      }
    } catch (err) {
      console.error("[Results] Retry evaluation failed:", err.message);
      setEvalFailed(true);
    } finally {
      setRetrying(false);
    }
  };

  const handleDownloadPdf = async () => {
    const targetSessionId = result?.sessionId || activeId;
    if (!targetSessionId) return;

    setDownloadingPdf(true);
    try {
      const response = await api.get(`/api/real-interview/result/${targetSessionId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Prephire_Real_Interview_Result_${targetSessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Results] Download PDF error:", err.message);
      alert("Failed to download PDF report. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const toggleExpand = (qId) => {
    setExpandedItems((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  // Computed authoritative values
  const totalObtained = useMemo(() => result?.totalObtained ?? 0, [result]);
  const maxScore = useMemo(() => result?.maxScore ?? 450, [result]);
  const percentage = useMemo(() => {
    if (!result) return 0;
    if (typeof result.percentage === "number") return result.percentage;
    return maxScore > 0 ? Number(((totalObtained / maxScore) * 100).toFixed(2)) : 0;
  }, [result, totalObtained, maxScore]);

  const overallStatus = useMemo(() => getOverallPerformanceStatus(percentage), [percentage]);

  const candidateDisplayName = useMemo(() => {
    if (result?.candidateName) return result.candidateName;
    try {
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      return savedUser.name || savedUser.fullName || "Candidate";
    } catch {
      return "Candidate";
    }
  }, [result]);

  const formattedCompletionDate = useMemo(() => {
    if (!result?.completedAt) return null;
    try {
      return new Date(result.completedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return null;
    }
  }, [result]);

  const roundsData = useMemo(() => {
    const list = [
      { key: "aptitude", name: "APTITUDE", defaultTotalQ: 15, defaultMax: 50 },
      { key: "technical", name: "TECHNICAL", defaultTotalQ: 20, defaultMax: 100 },
      { key: "project", name: "PROJECT", defaultTotalQ: 10, defaultMax: 100 },
      { key: "hr", name: "HR BEHAVIORAL", defaultTotalQ: 5, defaultMax: 100 },
      { key: "coding", name: "CODING", defaultTotalQ: 3, defaultMax: 100 },
    ];

    return list.map((item) => {
      const rInfo = result?.rounds?.[item.key] || {};
      const score = Number(rInfo.score ?? 0);
      const maxScore = Number(rInfo.maxScore ?? item.defaultMax);
      const attemptedCount = Number(rInfo.attemptedCount ?? 0);
      const totalQuestions = Number(rInfo.totalQuestions ?? item.defaultTotalQ);
      const statusInfo = getRoundPerformanceStatus(attemptedCount, score, maxScore);

      const feedbackObj = buildEvidenceBasedRoundFeedback(
        item.key,
        item.name,
        attemptedCount,
        totalQuestions,
        score,
        maxScore,
        result?.questionResults || []
      );

      return {
        key: item.key,
        name: item.name,
        score,
        maxScore,
        attemptedCount,
        totalQuestions,
        statusInfo,
        feedbackObj,
      };
    });
  }, [result]);

  const questionResults = useMemo(() => result?.questionResults || [], [result]);
  const attemptedCount = useMemo(() => result?.attemptedCount ?? 0, [result]);
  const totalCount = useMemo(() => result?.totalCount ?? 53, [result]);
  const unattemptedCount = useMemo(() => result?.unattemptedCount ?? Math.max(0, totalCount - attemptedCount), [result, totalCount, attemptedCount]);

  const filteredQuestions = useMemo(() => {
    return questionResults.filter((item) => {
      const matchRound = roundFilter === "ALL" || item.roundType === roundFilter;
      const isNotAtt = item.status === "NOT_ATTEMPTED" || !item.candidateAnswer || item.candidateAnswer === "Not Answered" || item.candidateAnswer === "Not Submitted";

      let matchStatus = true;
      if (statusFilter === "ATTEMPTED") matchStatus = !isNotAtt;
      else if (statusFilter === "NOT_ATTEMPTED") matchStatus = isNotAtt;
      else if (statusFilter === "CORRECT") matchStatus = item.status === "CORRECT";
      else if (statusFilter === "PARTIAL") matchStatus = item.status === "PARTIALLY_CORRECT" || item.status === "PARTIAL";
      else if (statusFilter === "INCORRECT") matchStatus = item.status === "INCORRECT";

      return matchRound && matchStatus;
    });
  }, [questionResults, roundFilter, statusFilter]);

  const totalPages = Math.ceil(filteredQuestions.length / PAGE_SIZE) || 1;

  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, currentPage]);

  const handleFilterChange = (setter, val) => {
    setter(val);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b10] text-white flex items-center justify-center p-6 font-sans select-none">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Loading interview assessment report...</h2>
            <p className="text-xs text-slate-400 mt-1">Retrieving authoritative evaluation metrics</p>
          </div>
        </div>
      </div>
    );
  }

  if (evalFailed) {
    return (
      <div className="min-h-screen bg-[#0a0b10] text-white flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-lg w-full bg-[#12131d] border border-orange-500/20 rounded-2xl p-8 text-center space-y-6 shadow-xl">
          <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">Interview Evaluation Could Not Be Completed</h2>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Your responses were saved to the database, but automated evaluation is pending or unavailable.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleTryAgain}
              disabled={retrying}
              className="flex-1 py-3 px-5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition"
            >
              {retrying && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{retrying ? "Calculating..." : "Retry Calculation"}</span>
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className="flex-1 py-3 px-5 rounded-xl bg-[#1b1d2b] hover:bg-[#25283b] text-slate-200 font-bold text-xs uppercase tracking-wider cursor-pointer transition border border-white/10"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-[#0a0b10] text-white flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-md w-full bg-[#12131d] border border-white/10 rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-base font-bold text-white">No Assessment Result Available</h2>
          <p className="text-xs text-slate-400">{error || "Please complete an interview session to generate a report."}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b10] text-white py-6 px-4 font-sans select-none">

      {/* FULL-WIDTH CONTAINER (94% Viewport width, max-w-[1600px]) */}
      <div className="w-[94%] max-w-[1600px] mx-auto space-y-6">

        {/* --- 1. COMPACT PROFESSIONAL HEADER --- */}
        <header className="bg-[#12131d] border border-[#252836] rounded-2xl p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3.5">
            <img
              src="/images/metadata.png"
              alt="PrepHire Logo"
              className="h-9 w-9 object-contain shrink-0"
              draggable="false"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-orange-500 uppercase">PREPHIRE</span>
                <span className="text-slate-600 text-xs">•</span>
                <h1 className="text-xs font-bold uppercase tracking-wider text-slate-200">REAL INTERVIEW ASSESSMENT RESULT</h1>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1 font-mono">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <User className="w-3.5 h-3.5 text-orange-400" />
                  Candidate: <strong className="text-white">{candidateDisplayName}</strong>
                </span>
                <span className="text-slate-500">ID: {result.sessionId || activeId}</span>
                {formattedCompletionDate && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {formattedCompletionDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow"
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{downloadingPdf ? "Generating..." : "Download Result PDF"}</span>
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className="py-2 px-4 rounded-xl bg-[#1c1e2c] hover:bg-[#282b3d] text-slate-300 font-bold text-xs uppercase tracking-wider border border-white/10 transition cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
          </div>
        </header>

        {/* --- 2. RESULT SUMMARY SECTION --- */}
        <section className="bg-[#12131d] border border-[#252836] rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

            {/* Overall score */}
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">OVERALL RESULT</span>
              <div className="flex items-baseline gap-3">
                <span className={`text-5xl font-black font-mono tracking-tight ${overallStatus.textColor}`}>
                  {totalObtained}
                </span>
                <span className="text-xl font-bold text-slate-500 font-mono">/ {maxScore}</span>
                <span className="text-2xl font-black font-mono text-white ml-2">({percentage}%)</span>
              </div>
            </div>

            {/* Performance status badge */}
            <div className="flex flex-col items-start md:items-end gap-2">
              <div className={`px-5 py-2.5 rounded-xl border ${overallStatus.badgeBg} ${overallStatus.badgeBorder} flex items-center gap-2`}>
                <span className="text-xs text-slate-400 font-bold uppercase">PERFORMANCE STATUS:</span>
                <span className={`text-sm font-black uppercase tracking-wider ${overallStatus.textColor}`}>
                  {overallStatus.label}
                </span>
              </div>

              {/* Questions attempted breakdown */}
              <div className="flex items-center gap-4 text-xs font-mono bg-[#0a0b10] border border-white/5 rounded-lg px-3.5 py-1.5">
                <span>Questions Attempted: <strong className="text-emerald-400">{attemptedCount} / {totalCount}</strong></span>
                <span className="text-slate-600">|</span>
                <span>Not Attempted: <strong className="text-slate-400">{unattemptedCount} / {totalCount}</strong></span>
              </div>
            </div>

          </div>
        </section>

        {/* --- 3. ROUND PERFORMANCE ASSESSMENT REPORT TABLE --- */}
        <section className="bg-[#12131d] border border-[#252836] rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-300">ROUND PERFORMANCE</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Authoritative performance metrics across all 5 interview stages</p>
            </div>
            <span className="text-xs font-mono text-slate-500">Maximum Marks: 450</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0a0b10] border-b border-[#252836] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">ROUND</th>
                  <th className="py-3 px-4 text-center">QUESTIONS</th>
                  <th className="py-3 px-4 text-center">ATTEMPTED</th>
                  <th className="py-3 px-4 text-center">SCORE</th>
                  <th className="py-3 px-4 text-center">PERFORMANCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {roundsData.map((rd) => {
                  const isZeroAttempt = rd.attemptedCount === 0;

                  return (
                    <tr key={rd.key} className="hover:bg-white/[0.01] transition">
                      {/* Round Name */}
                      <td className="py-3.5 px-4 font-sans font-bold text-white uppercase text-xs tracking-wider">
                        {rd.name}
                      </td>

                      {/* Total Questions */}
                      <td className="py-3.5 px-4 text-center text-slate-400">
                        {rd.totalQuestions} questions
                      </td>

                      {/* Attempted */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={isZeroAttempt ? "text-slate-500" : "text-emerald-400 font-bold"}>
                          {rd.attemptedCount} / {rd.totalQuestions} Attempted
                        </span>
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={isZeroAttempt ? "text-slate-500 font-normal" : `font-bold ${rd.statusInfo.textColor}`}>
                          {isZeroAttempt ? "NOT ATTEMPTED" : `${rd.score} / ${rd.maxScore}`}
                        </span>
                      </td>

                      {/* Performance Status — ZERO ATTEMPT RULE: "NOT ATTEMPTED" if attemptedCount === 0 */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-lg text-[11px] font-sans font-bold uppercase tracking-wider border ${rd.statusInfo.badgeBg} ${rd.statusInfo.badgeBorder} ${rd.statusInfo.textColor}`}
                        >
                          {rd.statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* --- 4. STUDENT PERFORMANCE FEEDBACK (STRUCTURED & EVIDENCE-BASED) --- */}
        <section className="bg-[#12131d] border border-[#252836] rounded-2xl p-6 shadow-md space-y-5">
          <div className="border-b border-white/10 pb-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-300">STUDENT PERFORMANCE FEEDBACK</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Evidence-based evaluation derived from authoritative persisted response data</p>
          </div>

          <div className="space-y-6">
            {roundsData.map((rd) => {
              const fb = rd.feedbackObj;

              if (!fb.isAttempted) {
                return (
                  <div key={rd.key} className="p-4 rounded-xl bg-[#0a0b10] border border-[#252836] space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider font-sans">
                        {rd.name}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase bg-slate-800/40 border-slate-700/60 text-slate-400 font-mono">
                        NOT ASSESSED
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      This section was not attempted, so there is not enough response data to evaluate {rd.name.toLowerCase()} performance.
                    </p>
                  </div>
                );
              }

              return (
                <div key={rd.key} className="p-5 rounded-xl bg-[#0a0b10] border border-[#252836] space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                    <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider font-sans">
                      {rd.name}
                    </h3>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase font-mono ${rd.statusInfo.badgeBg} ${rd.statusInfo.badgeBorder} ${rd.statusInfo.textColor}`}>
                      {fb.statusLabel}
                    </span>
                  </div>

                  {/* Performance Insight */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">Performance Insight</span>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">{fb.insight}</p>
                  </div>

                  {/* What Went Well & Focus Areas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs font-sans">
                    {fb.strengths.length > 0 && (
                      <div className="space-y-1.5 p-3 rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">What Went Well</span>
                        <ul className="space-y-1 text-slate-300">
                          {fb.strengths.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-emerald-400 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {fb.focusAreas.length > 0 && (
                      <div className="space-y-1.5 p-3 rounded-lg bg-orange-500/[0.03] border border-orange-500/10">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block">Focus Areas</span>
                        <ul className="space-y-1 text-slate-300">
                          {fb.focusAreas.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-orange-400 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Recommended Next Step */}
                  {fb.nextStep && (
                    <div className="space-y-1 pt-1 font-sans text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Recommended Next Step</span>
                      <p className="text-slate-300 leading-relaxed">{fb.nextStep}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* --- 5. QUESTION-WISE REVIEW (ALL 53 QUESTIONS ACCESSIBLE VIA PAGINATION) --- */}
        {questionResults.length > 0 && (
          <section className="bg-[#12131d] border border-[#252836] rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-300">QUESTION-WISE REVIEW (ALL {totalCount} QUESTIONS)</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Showing {paginatedQuestions.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
                  {Math.min(currentPage * PAGE_SIZE, filteredQuestions.length)} of {filteredQuestions.length} questions
                </p>
              </div>

              {/* Simple professional filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 bg-[#0a0b10] border border-[#252836] rounded-xl px-3 py-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={roundFilter}
                    onChange={(e) => handleFilterChange(setRoundFilter, e.target.value)}
                    className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs font-medium"
                  >
                    <option value="ALL" className="bg-[#12131d]">All Rounds</option>
                    <option value="APTITUDE" className="bg-[#12131d]">Aptitude</option>
                    <option value="TECHNICAL" className="bg-[#12131d]">Technical</option>
                    <option value="RESUME_PROJECT" className="bg-[#12131d]">Project</option>
                    <option value="HR" className="bg-[#12131d]">HR</option>
                    <option value="CODING" className="bg-[#12131d]">Coding</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-[#0a0b10] border border-[#252836] rounded-xl px-3 py-1.5">
                  <select
                    value={statusFilter}
                    onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
                    className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs font-medium"
                  >
                    <option value="ALL" className="bg-[#12131d]">All Statuses</option>
                    <option value="ATTEMPTED" className="bg-[#12131d]">Attempted</option>
                    <option value="NOT_ATTEMPTED" className="bg-[#12131d]">Not Attempted</option>
                    <option value="CORRECT" className="bg-[#12131d]">Correct</option>
                    <option value="PARTIAL" className="bg-[#12131d]">Partially Correct</option>
                    <option value="INCORRECT" className="bg-[#12131d]">Incorrect</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Questions list for active page */}
            <div className="space-y-3">
              {paginatedQuestions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No questions match the selected filter criteria.
                </div>
              ) : (
                paginatedQuestions.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  const qId = item.questionId || `q_${globalIdx}`;
                  const isExpanded = Boolean(expandedItems[qId]);
                  const isNotAttempted = item.status === "NOT_ATTEMPTED" || !item.candidateAnswer || item.candidateAnswer === "Not Answered" || item.candidateAnswer === "Not Submitted";
                  const isCorrect = item.status === "CORRECT";
                  const isPartial = item.status === "PARTIALLY_CORRECT" || item.status === "PARTIAL";

                  return (
                    <div
                      key={qId}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isNotAttempted
                          ? "bg-[#0a0b10] border-[#252836]"
                          : isCorrect
                          ? "bg-emerald-500/[0.02] border-emerald-500/20"
                          : isPartial
                          ? "bg-amber-500/[0.02] border-amber-500/20"
                          : "bg-red-500/[0.02] border-red-500/20"
                      }`}
                    >
                      <button
                        onClick={() => toggleExpand(qId)}
                        className="w-full p-3.5 flex items-start justify-between gap-3 text-left cursor-pointer hover:bg-white/[0.02] transition"
                      >
                        <div className="flex items-start gap-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/10 border border-orange-500/20 text-orange-400 shrink-0 mt-0.5 font-mono">
                            {item.roundType}
                          </span>

                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-white leading-snug">
                              Q{globalIdx}. {item.question}
                            </p>

                            <div className="flex items-center gap-2 font-mono">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  isNotAttempted
                                    ? "bg-slate-800 text-slate-400"
                                    : isCorrect
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : isPartial
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {isNotAttempted ? "NOT ATTEMPTED" : isCorrect ? "CORRECT" : isPartial ? "PARTIALLY CORRECT" : "INCORRECT"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-xs font-bold text-white">
                            Score: {item.score} / {item.maxScore}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-white/5 space-y-3 pt-3 text-xs font-sans">
                          <div className="p-3 rounded-lg bg-[#07080d] border border-white/10 space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-mono">Candidate Answer:</span>
                            <p className="font-mono text-slate-200 whitespace-pre-wrap">
                              {isNotAttempted ? "NOT ATTEMPTED" : (item.candidateAnswer || "NOT ATTEMPTED")}
                            </p>
                          </div>

                          {item.correctAnswer && item.correctAnswer.trim() !== "" && (
                            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block font-mono">Correct / Expected Answer:</span>
                              <p className="text-slate-300 font-mono whitespace-pre-wrap">{item.correctAnswer}</p>
                            </div>
                          )}

                          {item.feedback && item.feedback.trim() !== "" && (
                            <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 block font-mono">Evaluation Feedback:</span>
                              <p className="text-slate-300">{item.feedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-white/10 text-xs">
                <span className="text-slate-400 font-mono">
                  Page {currentPage} of {totalPages} ({filteredQuestions.length} total questions)
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-[#0a0b10] border border-[#252836] hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg)}
                      className={`w-7 h-7 rounded-lg font-bold font-mono text-xs cursor-pointer transition ${
                        currentPage === pg
                          ? "bg-orange-600 text-white"
                          : "bg-[#0a0b10] border border-[#252836] text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg bg-[#0a0b10] border border-[#252836] hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* --- 6. ACTIONS FOOTER --- */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2 pb-6">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="w-full sm:w-auto py-3 px-8 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow flex items-center justify-center gap-2"
          >
            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{downloadingPdf ? "Generating PDF Report..." : "Download Result PDF"}</span>
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full sm:w-auto py-3 px-8 rounded-xl bg-[#12131d] hover:bg-[#1c1e2c] text-slate-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer border border-[#252836]"
          >
            Back to Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
