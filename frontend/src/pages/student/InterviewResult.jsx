import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Award, CheckCircle2, XCircle, ChevronRight, BrainCircuit, History, RefreshCw } from "lucide-react";
import { COMPANIES } from "../../data/companies";
import Button from "../../components/ui/Button";

function InterviewResult() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const company = COMPANIES.find((c) => c.id === companyId);
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!companyId) return;

    const sessionKey = `practice-session-${companyId}`;
    const stored = localStorage.getItem(sessionKey);
    const currentSession = stored ? JSON.parse(stored) : null;

    if (!currentSession || !currentSession.rounds.aptitude.completed || !currentSession.rounds.technical.completed || !currentSession.rounds.coding.completed) {
      toast.error("Please complete all three rounds first.");
      navigate(`/interview-practice/${companyId}`);
      return;
    }

    setSession(currentSession);

    // Compute scores
    const { aptitude, technical, coding } = currentSession.rounds;
    const aptPercent = Math.round((aptitude.score / aptitude.maxScore) * 100);
    const techPercent = technical.score; // Already on a 0-100 scale
    const codePercent = Math.round((coding.score / coding.maxScore) * 100);
    const overall = Math.round((aptPercent + techPercent + codePercent) / 3);

    const isPass = overall >= 60;

    // Generate Strengths and Weaknesses dynamically
    const strengths = [];
    const weaknesses = [];

    if (aptitude.score >= 20) {
      strengths.push("Exceptional performance in Aptitude. Shows strong analytical and quantitative reasoning skills.");
    } else {
      weaknesses.push("Aptitude score can be improved. Work on Quantitative and Logical reasoning shortcuts to save time.");
    }

    if (technical.score >= 75) {
      strengths.push("Excellent core technical fundamentals. Explanations are descriptive, concise, and structured.");
    } else {
      weaknesses.push("Technical review indicates gaps. Ensure you explain core concepts with syntax details, architecture diagrams, and real-world examples.");
    }

    if (coding.score >= 2) {
      strengths.push("Solid hands-on programming. Code compiles correctly, passes all predefined test cases, and addresses boundary constraints.");
    } else {
      weaknesses.push("Coding logic needs practice. Work on basic and intermediate algorithms, corner cases, and standard data structure structures.");
    }

    // Pull from actual AI technical evaluation feedback to make it ultra-personalized
    if (technical.evaluations) {
      const feedbacks = Object.values(technical.evaluations).map((ev) => ev.feedback).filter(Boolean);
      // Pick one snippet of corrective AI feedback to show
      const lowScores = Object.values(technical.evaluations).filter((ev) => ev.score <= 5);
      if (lowScores.length > 0) {
        const feedbackSnippet = lowScores[0].feedback;
        weaknesses.push(`AI feedback highlight: "${feedbackSnippet}"`);
      }
    }

    const reportData = {
      aptPercent,
      techPercent,
      codePercent,
      overall,
      isPass,
      strengths,
      weaknesses
    };

    setReport(reportData);

    // Save to Interview History if not already saved
    if (!currentSession.resultSaved) {
      const historyKey = "interview-history-list";
      const existingHistoryStr = localStorage.getItem(historyKey);
      const historyList = existingHistoryStr ? JSON.parse(existingHistoryStr) : [];

      const newHistoryItem = {
        id: `practice-${companyId}-${Date.now()}`,
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        role: `${company.name} Mock Practice`,
        companyId,
        companyName: company.name,
        status: "Completed",
        score: `${overall}%`,
        details: {
          aptitudeScore: `${aptitude.score}/${aptitude.maxScore}`,
          technicalScore: `${technical.score}%`,
          codingScore: `${coding.score}/${coding.maxScore}`,
          overallPercentage: overall,
          result: isPass ? "Pass" : "Fail",
          strengths,
          weaknesses
        }
      };

      // Prepend so it is shown first
      historyList.unshift(newHistoryItem);
      localStorage.setItem(historyKey, JSON.stringify(historyList));

      // Mark saved
      currentSession.resultSaved = true;
      localStorage.setItem(sessionKey, JSON.stringify(currentSession));
    }
  }, [companyId, company]);

  if (!company || !report) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => navigate(`/interview-practice/${companyId}`)}
        className="flex items-center gap-2 text-sm font-medium mb-6 cursor-pointer hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Rounds
      </button>

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="student-card p-8 mb-6 text-center space-y-4"
      >
        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: report.isPass ? "color-mix(in srgb, var(--success) 12%, transparent)" : "color-mix(in srgb, var(--error) 12%, transparent)" }}>
          {report.isPass ? (
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          ) : (
            <XCircle className="w-10 h-10 text-red-500" />
          )}
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Practice Session Completed!
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Evaluated placement assessment for {company.name}.
          </p>
        </div>

        <div className="flex justify-center items-center gap-6 pt-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Aggregate Grade</p>
            <p className="text-4xl font-extrabold mt-1" style={{ color: report.isPass ? "var(--success)" : "var(--error)" }}>
              {report.overall}%
            </p>
          </div>
          <div className="h-10 w-px bg-neutral-800" />
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Status</p>
            <p className={`text-lg font-bold mt-2.5 px-3 py-1 rounded-lg ${report.isPass ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
              {report.isPass ? "PASSED" : "FAILED"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Scores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Aptitude card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="student-card p-5 space-y-3"
        >
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-neutral-300">Aptitude Score</span>
            <span className="font-bold text-green-500">{session?.rounds.aptitude.score} / 30</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full bg-blue-500" style={{ width: `${report.aptPercent}%` }} />
          </div>
          <p className="text-xs text-neutral-400">Score Percentage: {report.aptPercent}%</p>
        </motion.div>

        {/* Technical card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="student-card p-5 space-y-3"
        >
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-neutral-300">Technical AI Score</span>
            <span className="font-bold text-green-500">{report.techPercent}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full bg-purple-500" style={{ width: `${report.techPercent}%` }} />
          </div>
          <p className="text-xs text-neutral-400">AI Response Grading</p>
        </motion.div>

        {/* Coding card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="student-card p-5 space-y-3"
        >
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-neutral-300">Coding Score</span>
            <span className="font-bold text-green-500">{session?.rounds.coding.score} / 3 Solved</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full bg-emerald-500" style={{ width: `${report.codePercent}%` }} />
          </div>
          <p className="text-xs text-neutral-400">Test Cases Passed: {report.codePercent}%</p>
        </motion.div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Strengths */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="student-card p-6 space-y-4 border-t-4"
          style={{ borderTopColor: "var(--success)" }}
        >
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Award className="w-5 h-5 text-green-500" />
            <span>Key Strengths</span>
          </h3>
          <ul className="space-y-3 text-sm text-neutral-300">
            {report.strengths.map((str, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Weaknesses */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="student-card p-6 space-y-4 border-t-4"
          style={{ borderTopColor: "var(--error)" }}
        >
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <BrainCircuit className="w-5 h-5 text-red-500" />
            <span>Areas for Improvement</span>
          </h3>
          <ul className="space-y-3 text-sm text-neutral-300">
            {report.weaknesses.map((weak, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{weak}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Footer Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/interview-history")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer hover:bg-neutral-800 transition"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <History className="w-4 h-4" />
          View in Interview History
        </button>

        <Button
          onClick={() => {
            // Delete localStorage session to allow restarts
            localStorage.removeItem(`practice-session-${companyId}`);
            navigate(`/interview-practice/${companyId}`);
          }}
          className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          Restart Practice
        </Button>
      </div>
    </div>
  );
}

export default InterviewResult;
