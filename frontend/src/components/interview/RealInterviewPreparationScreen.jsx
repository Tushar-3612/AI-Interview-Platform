import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  BrainCircuit,
  FileText,
  Code2,
  UserCheck,
  Building,
  Star,
  AlertCircle,
  Home,
  BookOpen
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

const PREPARATION_STAGES = [
  {
    id: "resume",
    key: "STAGE_1",
    title: "Recognizing your resume",
    description: "Reading your resume and identifying your professional background.",
    roundKey: null,
  },
  {
    id: "tech_profile",
    key: "STAGE_2",
    title: "Analyzing your technical profile",
    description: "Identifying the technologies, languages, frameworks, databases and tools found in your profile.",
    roundKey: null,
  },
  {
    id: "aptitude",
    key: "STAGE_3",
    title: "Preparing your aptitude assessment",
    description: "Preparing a balanced quantitative and logical reasoning assessment.",
    roundKey: "APTITUDE",
    failedMessage: "Interview preparation stopped while preparing your Aptitude Assessment.",
  },
  {
    id: "technical",
    key: "STAGE_4",
    title: "Preparing your technical interview",
    description: "Building technical questions around the skills actually found in your profile.",
    roundKey: "TECHNICAL",
    failedMessage: "Interview preparation stopped while preparing your Technical Interview.",
  },
  {
    id: "project",
    key: "STAGE_5",
    title: "Analyzing your projects",
    description: "Preparing questions around your actual project experience and implementation decisions.",
    roundKey: "RESUME_PROJECT",
    failedMessage: "Interview preparation stopped while preparing your Project Interview.",
  },
  {
    id: "hr",
    key: "STAGE_6",
    title: "Preparing your behavioral interview",
    description: "Preparing realistic workplace scenarios to evaluate decision-making, ownership, teamwork and professional judgment.",
    roundKey: "HR",
    failedMessage: "Interview preparation stopped while preparing your Behavioral Interview.",
  },
  {
    id: "coding",
    key: "STAGE_7",
    title: "Preparing your coding assessment",
    description: "Preparing realistic DSA problems for the coding interview.",
    roundKey: "CODING",
    failedMessage: "Interview preparation stopped while preparing your Coding Assessment.",
  },
  {
    id: "finalizing",
    key: "STAGE_8",
    title: "Finalizing your interview",
    description: "Checking question availability and preparing your interview session.",
    roundKey: null,
  },
];

export default function RealInterviewPreparationScreen({
  sessionId,
  candidateProfile = {},
  token,
  onPreparationSuccess,
  onReturnToPlatform,
  onPracticeMock,
}) {
  // Stage States: 'pending' | 'in_progress' | 'completed' | 'failed'
  const [stageStatuses, setStageStatuses] = useState(() =>
    PREPARATION_STAGES.reduce((acc, stage) => {
      acc[stage.id] = "pending";
      return acc;
    }, {})
  );

  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isPreparationComplete, setIsPreparationComplete] = useState(false);
  const [failedStageId, setFailedStageId] = useState(null);
  const [friendlyErrorMessage, setFriendlyErrorMessage] = useState("");

  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    issueType: "Question generation failed",
    failedStage: "",
    rating: 3,
    comments: "",
  });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Completed Stages Ref for Idempotency & Retry
  const completedStagesRef = useRef(new Set());
  const isRunningRef = useRef(false);
  const preparedSessionIdRef = useRef(null);

  // Friendly Error Mapper
  const mapApiErrorToFriendlyMessage = (error) => {
    if (!error?.response) {
      return "We couldn't connect to the interview service. Please check your connection and try again.";
    }
    const status = error.response.status;
    if (status === 404) {
      return "Interview preparation service is temporarily unavailable.";
    }
    if (status === 429) {
      return "The interview service is temporarily busy. Please try again shortly.";
    }
    if (status === 401) {
      return "Interview preparation could not be authorized. Please try again.";
    }
    if (status === 500 || status === 503) {
      return "We couldn't complete this stage right now.";
    }
    return "Something interrupted the interview preparation. Please try again.";
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Store candidateProfile in ref to prevent object reference changes from re-triggering execution
  const candidateProfileRef = useRef(candidateProfile);
  useEffect(() => {
    candidateProfileRef.current = candidateProfile;
  }, [candidateProfile]);

  // Run Real Backend Generation for specified stage
  const runBackendStage = async (stage) => {
    if (!sessionId || sessionId === "undefined" || sessionId === "null") {
      throw new Error("Interview session could not be initialized. Invalid or missing session ID.");
    }

    const activeToken = token || getAuthToken();
    const headers = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
    const payload = { sessionId, candidateProfile: candidateProfileRef.current };

    console.log(`[PREP] stage=${stage.id} START sessionId=${sessionId ? `${sessionId.slice(0, 6)}...` : "NONE"}`);

    if (stage.id === "resume") {
      await delay(1000);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "tech_profile") {
      await delay(1000);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "aptitude") {
      console.log(`[PREP] round=aptitude sessionIdPresent=${Boolean(sessionId)}`);
      const res = await api.post("/api/real-interview/aptitude/generate", { sessionId }, { headers });
      console.log(`[PREP] stage=${stage.id} RESPONSE status=${res.status}`);
      await delay(1200);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "technical") {
      console.log(`[PREP] round=technical sessionIdPresent=${Boolean(sessionId)}`);
      const res = await api.post("/api/real-interview/technical/generate", payload, { headers });
      console.log(`[PREP] stage=${stage.id} RESPONSE status=${res.status}`);
      await delay(1200);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "project") {
      console.log(`[PREP] round=project sessionIdPresent=${Boolean(sessionId)}`);
      const res = await api.post("/api/real-interview/project/generate", payload, { headers });
      console.log(`[PREP] stage=${stage.id} RESPONSE status=${res.status}`);
      await delay(1200);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "hr") {
      console.log(`[PREP] round=hr sessionIdPresent=${Boolean(sessionId)}`);
      const res = await api.post("/api/real-interview/hr/generate", payload, { headers });
      console.log(`[PREP] stage=${stage.id} RESPONSE status=${res.status}`);
      await delay(1200);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "coding") {
      console.log(`[PREP] round=coding sessionIdPresent=${Boolean(sessionId)}`);
      const res = await api.post("/api/real-interview/coding/generate", payload, { headers });
      console.log(`[PREP] stage=${stage.id} RESPONSE status=${res.status}`);
      await delay(1200);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "finalizing") {
      console.log(`[PREP] round=finalizing sessionIdPresent=${Boolean(sessionId)} URL=/api/student/interviews/${sessionId}`);
      // Perform final session validation from database
      const res = await api.get(`/api/student/interviews/${sessionId}`, { headers });
      console.log(`[PREP] stage=${stage.id} RESPONSE status=${res.status} valid=${res.data?.isValidRealInterview} count=${res.data?.totalQuestionsCount}`);
      const data = res.data || {};
      const qs = data.generatedQuestions || [];

      const aptitudeCount = qs.filter((q) => q.section === "APTITUDE").length;
      const technicalCount = qs.filter((q) => q.section === "TECHNICAL").length;
      const projectCount = qs.filter((q) => q.section === "RESUME_PROJECT").length;
      const hrCount = qs.filter((q) => q.section === "HR").length;
      const codingCount = qs.filter((q) => q.section === "CODING").length;

      const isValid =
        aptitudeCount === 15 &&
        technicalCount === 20 &&
        projectCount === 10 &&
        hrCount === 5 &&
        codingCount === 3 &&
        qs.length === 53;

      if (!isValid) {
        throw new Error(
          `Interview session validation failed. Expected 53 total questions (15 Aptitude, 20 Technical, 10 Project, 5 HR, 3 Coding). Received: ${qs.length} (Aptitude:${aptitudeCount}, Technical:${technicalCount}, Project:${projectCount}, HR:${hrCount}, Coding:${codingCount}).`
        );
      }

      // Check Aptitude questions options (must have exactly 4 choices each)
      const aptitudeQs = qs.filter((q) => q.section === "APTITUDE");
      const invalidAptitude = aptitudeQs.some((q) => !q.options || q.options.length !== 4);
      if (invalidAptitude) {
        throw new Error("Aptitude section validation failed: one or more Aptitude questions do not have 4 choices (A/B/C/D).");
      }

      await delay(1000);
      console.log(`[PREP] stage=${stage.id} COMPLETE - 53 questions validated`);
      return true;
    }

    return true;
  };

  // Main Preparation Workflow Sequence
  const executePreparationSequence = useCallback(async () => {
    const isSessionValid = Boolean(sessionId && sessionId !== "undefined" && sessionId !== "null");

    // If sessionId is not yet available, wait silently without triggering failure or error logs
    if (!isSessionValid) {
      return;
    }

    // StrictMode / duplicate call guard: if already preparing or already prepared this session, skip
    if (isRunningRef.current) return;
    if (preparedSessionIdRef.current === sessionId) return;

    isRunningRef.current = true;
    console.log(`[PREP] preparation START sessionIdPresent=${isSessionValid} sessionId=${sessionId ? `${sessionId.slice(0, 6)}...` : "NONE"}`);

    setFailedStageId(null);
    setFriendlyErrorMessage("");

    for (let i = 0; i < PREPARATION_STAGES.length; i++) {
      const stage = PREPARATION_STAGES[i];

      // Skip already completed stages (used for Retry idempotency)
      if (completedStagesRef.current.has(stage.id)) {
        setStageStatuses((prev) => ({ ...prev, [stage.id]: "completed" }));
        continue;
      }

      setCurrentStageIndex(i);
      setStageStatuses((prev) => ({ ...prev, [stage.id]: "in_progress" }));

      try {
        await runBackendStage(stage);
        completedStagesRef.current.add(stage.id);
        setStageStatuses((prev) => ({ ...prev, [stage.id]: "completed" }));
      } catch (err) {
        console.error(`[PREP] preparation ERROR stage=${stage.id}:`, err);
        setStageStatuses((prev) => ({ ...prev, [stage.id]: "failed" }));
        setFailedStageId(stage.id);

        const userFriendlyMsg = mapApiErrorToFriendlyMessage(err);
        setFriendlyErrorMessage(userFriendlyMsg);

        setFeedbackForm((prev) => ({
          ...prev,
          failedStage: stage.title,
        }));

        isRunningRef.current = false;
        return; // STOP Sequence immediately on failure!
      }
    }

    console.log(`[PREP] preparation SUCCESS sessionId=${sessionId}`);
    preparedSessionIdRef.current = sessionId;
    setIsPreparationComplete(true);
    isRunningRef.current = false;
  }, [sessionId, token]);

  useEffect(() => {
    executePreparationSequence();
  }, [executePreparationSequence]);

  // Auto-transition to interview room 1.2s after 100% preparation completion
  useEffect(() => {
    if (isPreparationComplete && !failedStageId) {
      const timer = setTimeout(() => {
        onPreparationSuccess?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isPreparationComplete, failedStageId, onPreparationSuccess]);

  // Calculate Progress Percentage
  const completedCount = Object.values(stageStatuses).filter((s) => s === "completed").length;
  const progressPercentage = Math.round((completedCount / PREPARATION_STAGES.length) * 100);

  // Handle Retry
  const handleRetry = () => {
    if (failedStageId) {
      completedStagesRef.current.delete(failedStageId);
    }
    preparedSessionIdRef.current = null;
    isRunningRef.current = false;
    executePreparationSequence();
  };

  // Handle Submit Feedback
  const handleSubmitFeedback = (e) => {
    e.preventDefault();
    setFeedbackSubmitted(true);
    setShowFeedbackModal(false);
  };

  // Current active stage
  const currentStage = PREPARATION_STAGES[currentStageIndex];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content Container */}
      <div className="w-full max-w-3xl z-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            AI Real Interview Platform
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            {failedStageId
              ? "INTERVIEW PREPARATION PAUSED"
              : isPreparationComplete
              ? "Your Interview is Ready"
              : "Preparing Your Interview..."}
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto">
            {failedStageId
              ? "We couldn't complete your interview preparation at this time."
              : isPreparationComplete
              ? "Your personalized multi-round AI assessment has been fully assembled."
              : currentStage?.description || "Personalizing your interview from your profile."}
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
          {/* Progress Percentage Display */}
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Preparation Progress
            </span>
            <span className="text-2xl font-black text-blue-400">{progressPercentage}%</span>
          </div>

          {/* Track Bar */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Stages Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {PREPARATION_STAGES.map((stage) => {
              const status = stageStatuses[stage.id];
              const isCurrent = stage.id === currentStage?.id && status === "in_progress";
              const isFailed = status === "failed";
              const isDone = status === "completed";

              return (
                <div
                  key={stage.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-xs md:text-sm transition-all duration-300 ${
                    isFailed
                      ? "bg-red-500/10 border-red-500/30 text-red-300"
                      : isDone
                      ? "bg-emerald-500/5 border-emerald-500/20 text-slate-200"
                      : isCurrent
                      ? "bg-blue-500/10 border-blue-500/40 text-blue-300 font-medium"
                      : "bg-slate-950/40 border-slate-800/80 text-slate-500"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {isFailed && <XCircle className="w-4 h-4 text-red-400" />}
                    {isCurrent && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
                        <RefreshCw className="w-4 h-4 text-blue-400" />
                      </motion.div>
                    )}
                    {!isDone && !isFailed && !isCurrent && (
                      <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px] text-slate-600">
                        ●
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <p className="font-semibold leading-tight">{stage.title}</p>
                    {isCurrent && (
                      <p className="text-[11px] text-blue-400/90 leading-tight">In Progress...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stage Failure Info Banner */}
          {failedStageId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-red-200 text-xs md:text-sm space-y-2"
            >
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {PREPARATION_STAGES.find((s) => s.id === failedStageId)?.failedMessage ||
                  "Interview preparation encountered an issue."}
              </div>
              <p className="text-slate-300 text-xs">{friendlyErrorMessage}</p>
              <p className="text-slate-400 text-xs">We're sorry for the interruption. Please try again.</p>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* SUCCESS BUTTON */}
            {isPreparationComplete && !failedStageId && (
              <button
                onClick={onPreparationSuccess}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                ENTER INTERVIEW
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* FAILURE BUTTONS */}
            {failedStageId && (
              <>
                <button
                  onClick={handleRetry}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  TRY AGAIN
                </button>
                <button
                  onClick={() => setShowFeedbackModal(true)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs md:text-sm flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  GIVE FEEDBACK
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FEEDBACK MODAL */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 text-slate-200 shadow-2xl"
            >
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  Help Us Improve Your Interview Experience
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  We're sorry that your interview could not be completed. Your feedback helps us identify and improve the issue.
                </p>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs md:text-sm">
                {/* Field 1: What happened */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">1. What happened?</label>
                  <select
                    value={feedbackForm.issueType}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, issueType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Interview did not start">Interview did not start</option>
                    <option value="Question generation failed">Question generation failed</option>
                    <option value="Interview stopped unexpectedly">Interview stopped unexpectedly</option>
                    <option value="Technical issue">Technical issue</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Field 2: Which stage */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">2. Which stage?</label>
                  <select
                    value={feedbackForm.failedStage}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, failedStage: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    {PREPARATION_STAGES.map((s) => (
                      <option key={s.id} value={s.title}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 3: Experience rating */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">3. Experience rating</label>
                  <div className="flex items-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                        className={`p-2 rounded-lg border transition ${
                          feedbackForm.rating >= star
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                            : "bg-slate-950 border-slate-800 text-slate-600"
                        }`}
                      >
                        <Star className="w-5 h-5 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 4: Additional comments */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">4. Additional comments</label>
                  <textarea
                    rows={3}
                    value={feedbackForm.comments}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, comments: e.target.value })}
                    placeholder="Describe any specific details..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    SUBMIT FEEDBACK
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POST-FEEDBACK APOLOGY / RECOVERY SCREEN */}
      <AnimatePresence>
        {feedbackSubmitted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 text-center text-slate-200 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-white">THANK YOU FOR YOUR FEEDBACK</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  We sincerely apologize that your Real Interview could not be completed.
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your feedback has been recorded and will help us improve the interview experience.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                Before attempting the Real Interview again, we recommend strengthening your technical preparation through the Mock Interview and practice sections.
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={onPracticeMock}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  PRACTICE MOCK INTERVIEW
                </button>
                <button
                  onClick={onReturnToPlatform}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  RETURN TO PLATFORM
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
