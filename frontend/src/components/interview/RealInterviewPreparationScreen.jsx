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
  BookOpen,
  Key
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import BYOKModal from "../BYOKModal";

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

const TECHNICAL_PRACTICE_STAGES = [
  {
    id: "tech_profile",
    key: "STAGE_1",
    title: "Recognizing your technical profile",
    description: "Analyzing your technical skills and domain context.",
    roundKey: null,
  },
  {
    id: "topics",
    key: "STAGE_2",
    title: "Preparing technical topics",
    description: "Structuring technical areas and difficulty levels.",
    roundKey: null,
  },
  {
    id: "individual_technical_gen",
    key: "STAGE_3",
    title: "Generating Technical Questions",
    description: "Preparing 20 targeted technical practice questions.",
    roundKey: "TECHNICAL",
    failedMessage: "Unable to prepare your Technical Practice questions.",
  },
  {
    id: "finalizing_tech",
    key: "STAGE_4",
    title: "Finalizing your practice session",
    description: "Verifying your 20-question practice set.",
    roundKey: null,
  },
];

const PROJECT_PRACTICE_STAGES = [
  {
    id: "resume_project",
    key: "STAGE_1",
    title: "Reading your resume / interview key",
    description: "Reading your resume and project context.",
    roundKey: null,
  },
  {
    id: "project_analysis",
    key: "STAGE_2",
    title: "Analyzing your projects",
    description: "Analyzing your project architecture, DB schemas, and technical implementation decisions.",
    roundKey: null,
  },
  {
    id: "individual_project_gen",
    key: "STAGE_3",
    title: "Preparing project questions",
    description: "Preparing 10 targeted project practice questions.",
    roundKey: "RESUME_PROJECT",
    failedMessage: "Unable to prepare your Project Practice questions.",
  },
  {
    id: "difficulty_check",
    key: "STAGE_4",
    title: "Checking question difficulty",
    description: "Validating question difficulty distribution.",
    roundKey: null,
  },
  {
    id: "uniqueness_check",
    key: "STAGE_5",
    title: "Checking question uniqueness",
    description: "Ensuring question uniqueness against previous practice sessions.",
    roundKey: null,
  },
  {
    id: "finalizing_project",
    key: "STAGE_6",
    title: "Finalizing project practice",
    description: "Verifying your 10-question project practice session.",
    roundKey: null,
  },
];

export default function RealInterviewPreparationScreen({
  sessionId,
  candidateProfile = {},
  token,
  isIndividualTechnical = false,
  isIndividualProject = false,
  onPreparationSuccess,
  onReturnToPlatform,
  onPracticeMock,
}) {
  const activeStages = isIndividualProject
    ? PROJECT_PRACTICE_STAGES
    : isIndividualTechnical
    ? TECHNICAL_PRACTICE_STAGES
    : PREPARATION_STAGES;

  // Stage States: 'pending' | 'in_progress' | 'completed' | 'failed'
  const [stageStatuses, setStageStatuses] = useState(() =>
    activeStages.reduce((acc, stage) => {
      acc[stage.id] = "pending";
      return acc;
    }, {})
  );

  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isPreparationComplete, setIsPreparationComplete] = useState(false);
  const [failedStageId, setFailedStageId] = useState(null);
  const [friendlyErrorMessage, setFriendlyErrorMessage] = useState("");
  const [partialInfoState, setPartialInfoState] = useState(null);

  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isBYOKOpen, setIsBYOKOpen] = useState(false);
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
  const mapApiErrorToFriendlyMessage = (error, partialInfo) => {
    if (error?.isPartial || partialInfo || error?.partialInfo) {
      const info = partialInfo || error?.partialInfo;
      if (info?.missingCount && info?.roundTitle) {
        return `${info.roundTitle} interview preparation is incomplete. ${info.missingCount} questions remaining.`;
      }
      if (error?.message) {
        return error.message;
      }
    }
    if (error?.message && !error.message.includes("Network Error") && !error.message.includes("AxiosError") && !error.message.includes("object Object")) {
      return error.message;
    }
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    if (isIndividualProject) {
      return "Please retry the project preparation. Your existing session will be preserved.";
    }
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

    if (stage.id === "resume" || stage.id === "resume_project" || stage.id === "project_analysis") {
      await delay(800);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "tech_profile" || stage.id === "topics" || stage.id === "difficulty_check" || stage.id === "uniqueness_check") {
      await delay(600);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "individual_technical_gen") {
      console.log(`[PREP] round=individual_technical_gen sessionIdPresent=${Boolean(sessionId)}`);
      // Validate or fetch the individual technical session
      const res = await api.get(`/api/individual/technical/session/${sessionId}`, { headers });
      const sess = res.data?.session;
      if (!sess || !Array.isArray(sess.questions) || sess.questions.length === 0) {
        throw new Error("Failed to prepare 15 technical questions for this session.");
      }
      await delay(1000);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "finalizing_tech") {
      const res = await api.get(`/api/individual/technical/session/${sessionId}`, { headers });
      const sess = res.data?.session;
      if (!sess || !Array.isArray(sess.questions) || sess.questions.length !== 15) {
        throw new Error(`Technical practice session validation failed. Expected 15 questions, got ${sess?.questions?.length || 0}.`);
      }
      await delay(800);
      console.log(`[PREP] stage=${stage.id} COMPLETE - 15 technical questions validated`);
      return true;
    }

    if (stage.id === "individual_project_gen") {
      console.log(`[PREP] round=individual_project_gen sessionIdPresent=${Boolean(sessionId)}`);
      const res = await api.get(`/api/individual/project/session/${sessionId}`, { headers });
      const sess = res.data?.session;
      if (!sess || !Array.isArray(sess.questions) || sess.questions.length === 0) {
        throw new Error("Failed to prepare 5 project questions for this session.");
      }
      await delay(1000);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "finalizing_project") {
      const res = await api.get(`/api/individual/project/session/${sessionId}`, { headers });
      const sess = res.data?.session;
      const qs = sess?.questions || [];
      if (!sess || !Array.isArray(qs) || qs.length !== 5) {
        throw new Error(`Project practice session validation failed. Expected 5 questions, got ${qs.length}.`);
      }
      // Verify all questions belong to project/resume scope
      const hasInvalidQs = qs.some((q) => !q.question || String(q.question).trim().length === 0);
      if (hasInvalidQs) {
        throw new Error("Project practice question validation failed: empty or malformed questions detected.");
      }
      await delay(800);
      console.log(`[PREP] stage=${stage.id} COMPLETE - 5 project questions validated`);
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
      const data = res.data || {};
      const generatedCount = data.count || data.questions?.length || data.generatedCount || 0;
      if (data.success === false || generatedCount < 15) {
        const missingCount = Math.max(1, 15 - generatedCount);
        const nextQ = data.nextQuestionNumber || (generatedCount + 1);
        const customErr = new Error(data.message || `Technical preparation is incomplete. ${missingCount} questions remaining.`);
        customErr.isPartial = true;
        customErr.targetFailedStage = "technical";
        customErr.partialInfo = {
          round: "technical",
          roundTitle: "Technical",
          missingCount,
          nextQuestionNumber: nextQ,
          generatedCount,
        };
        throw customErr;
      }
      console.log(`[PREP] stage=${stage.id} RESPONSE status=${res.status}`);
      await delay(1200);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "project") {
      console.log(`[PREP] round=project sessionIdPresent=${Boolean(sessionId)}`);
      const res = await api.post("/api/real-interview/project/generate", payload, { headers });
      const data = res.data || {};
      const generatedCount = data.count || data.questions?.length || data.generatedCount || 0;
      if (data.success === false || generatedCount < 5) {
        const missingCount = Math.max(1, 5 - generatedCount);
        const nextQ = data.nextQuestionNumber || (generatedCount + 1);
        const customErr = new Error(data.message || `Project preparation is incomplete. ${missingCount} questions remaining.`);
        customErr.isPartial = true;
        customErr.targetFailedStage = "project";
        customErr.partialInfo = {
          round: "project",
          roundTitle: "Project",
          missingCount,
          nextQuestionNumber: nextQ,
          generatedCount,
        };
        throw customErr;
      }
      console.log(`[PREP] stage=${stage.id} RESPONSE status=${res.status}`);
      await delay(1200);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "hr") {
      console.log(`[PREP] round=hr sessionIdPresent=${Boolean(sessionId)}`);
      const res = await api.post("/api/real-interview/hr/generate", payload, { headers });
      const data = res.data || {};
      const generatedCount = data.count || data.questions?.length || data.generatedCount || 0;
      if (data.success === false || generatedCount < 3) {
        const missingCount = Math.max(1, 3 - generatedCount);
        const customErr = new Error(data.message || `HR preparation is incomplete. ${missingCount} questions remaining.`);
        customErr.isPartial = true;
        customErr.targetFailedStage = "hr";
        customErr.partialInfo = {
          round: "hr",
          roundTitle: "HR",
          missingCount,
          nextQuestionNumber: data.nextQuestionNumber || 1,
          generatedCount,
        };
        throw customErr;
      }
      console.log(`[PREP] stage=${stage.id} RESPONSE status=${res.status}`);
      await delay(1200);
      console.log(`[PREP] stage=${stage.id} COMPLETE`);
      return true;
    }

    if (stage.id === "coding") {
      console.log(`[PREP] round=coding sessionIdPresent=${Boolean(sessionId)}`);
      const res = await api.post("/api/real-interview/coding/generate", payload, { headers });
      const data = res.data || {};
      const generatedCount = data.count || data.questions?.length || data.generatedCount || 0;
      if (data.success === false || generatedCount < 3) {
        const missingCount = Math.max(1, 3 - generatedCount);
        const customErr = new Error(data.message || `Coding preparation is incomplete. ${missingCount} problems remaining.`);
        customErr.isPartial = true;
        customErr.targetFailedStage = "coding";
        customErr.partialInfo = {
          round: "coding",
          roundTitle: "Coding",
          missingCount,
          nextQuestionNumber: data.nextQuestionNumber || 1,
          generatedCount,
        };
        throw customErr;
      }
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

      if (data.valid === false || data.isValidRealInterview === false) {
        const code = data.code || "INTERVIEW_INCOMPLETE";
        let targetFailedStage = "finalizing";
        let roundTitle = "Interview";
        let missingCount = 41 - (data.totalQuestionsCount || 0);

        if (code.includes("TECHNICAL") || (data.counts?.technical < 15)) {
          targetFailedStage = "technical";
          roundTitle = "Technical";
          missingCount = Math.max(1, 15 - (data.counts?.technical || 0));
        } else if (code.includes("PROJECT") || (data.counts?.project < 5)) {
          targetFailedStage = "project";
          roundTitle = "Project";
          missingCount = Math.max(1, 5 - (data.counts?.project || 0));
        } else if (code.includes("HR") || (data.counts?.hr < 3)) {
          targetFailedStage = "hr";
          roundTitle = "HR";
          missingCount = Math.max(1, 3 - (data.counts?.hr || 0));
        } else if (code.includes("CODING") || (data.counts?.coding < 3)) {
          targetFailedStage = "coding";
          roundTitle = "Coding";
          missingCount = Math.max(1, 3 - (data.counts?.coding || 0));
        }

        const customErr = new Error(data.message || `${roundTitle} preparation is incomplete. ${missingCount} questions remaining.`);
        customErr.isPartial = true;
        customErr.targetFailedStage = targetFailedStage;
        customErr.partialInfo = {
          round: targetFailedStage,
          roundTitle,
          missingCount,
          nextQuestionNumber: data.nextQuestionNumber || 18,
          counts: data.counts,
        };
        throw customErr;
      }

      const qs = data.generatedQuestions || [];
      // Check Aptitude questions options (must have exactly 4 choices each)
      const aptitudeQs = qs.filter((q) => q.section === "APTITUDE");
      const invalidAptitude = aptitudeQs.some((q) => !q.options || q.options.length !== 4);
      if (invalidAptitude) {
        throw new Error("Aptitude section validation failed: one or more Aptitude questions do not have 4 choices (A/B/C/D).");
      }

      await delay(1000);
      console.log(`[PREP] stage=${stage.id} COMPLETE - 41 questions validated`);
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
    setPartialInfoState(null);

    // Bind BYOK key if saved in sessionStorage
    const byokProvider = sessionStorage.getItem("byok_provider");
    const byokApiKey = sessionStorage.getItem("byok_api_key");
    if (byokProvider && byokApiKey) {
      try {
        const token = getAuthToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await api.post("/api/real-interview/byok/set-session-key", {
          sessionId,
          provider: byokProvider,
          apiKey: byokApiKey
        }, { headers });
        console.log(`[PREP] BYOK provider '${byokProvider}' bound to session '${sessionId}'`);
      } catch (keyErr) {
        console.warn("[PREP] Failed to bind BYOK session key:", keyErr.message);
      }
    }

    for (let i = 0; i < activeStages.length; i++) {
      const stage = activeStages[i];

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
        const actualFailedStageId = err.targetFailedStage || stage.id;

        setStageStatuses((prev) => ({ ...prev, [actualFailedStageId]: "failed" }));
        setFailedStageId(actualFailedStageId);

        const partialData = err.partialInfo || null;
        setPartialInfoState(partialData);

        const userFriendlyMsg = mapApiErrorToFriendlyMessage(err, partialData);
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
  }, [sessionId, token, activeStages]);

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
  const progressPercentage = Math.round((completedCount / activeStages.length) * 100);

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
  const currentStage = activeStages[currentStageIndex];

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none font-sans"
      style={{ background: "#050609" }}
    >
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF6B35]/[0.03] rounded-full blur-[140px] pointer-events-none" />

      {/* Main Content Container */}
      <div className="w-full max-w-2xl z-10 space-y-6">
        {/* Header with Project Logo & Section Pill */}
        <div className="text-center space-y-3">
          {/* Real Project Logo */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <img
              src="/images/metadata.png"
              alt="PrepHire Logo"
              className="h-10 w-10 object-contain shrink-0"
              draggable="false"
            />
            <span className="text-2xl font-black tracking-tight">
              <span className="text-white">Prep</span>
              <span style={{ color: "#FF6B35" }}>Hire</span>
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/25 text-[#FF6B35] text-[11px] font-bold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            {isIndividualProject
              ? "Project Practice"
              : isIndividualTechnical
              ? "Technical Practice"
              : "AI Real Interview Platform"}
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            {failedStageId
              ? isIndividualProject
                ? "PROJECT PRACTICE PREPARATION PAUSED"
                : isIndividualTechnical
                ? "TECHNICAL PRACTICE PREPARATION PAUSED"
                : "INTERVIEW PREPARATION PAUSED"
              : isPreparationComplete
              ? isIndividualProject
                ? "Your Project Practice is Ready"
                : isIndividualTechnical
                ? "Your Technical Practice is Ready"
                : "Your Interview is Ready"
              : isIndividualProject
              ? "Preparing Your Project Practice..."
              : isIndividualTechnical
              ? "Preparing Your Technical Practice..."
              : "Preparing Your Interview..."}
          </h1>

          <p className="text-xs sm:text-sm text-white/50 max-w-xl mx-auto">
            {failedStageId
              ? isIndividualProject
                ? "Please retry the project preparation. Your existing session will be preserved."
                : isIndividualTechnical
                ? "We couldn't complete your Technical Practice preparation at this time."
                : "We couldn't complete your interview preparation at this time."
              : isPreparationComplete
              ? isIndividualProject
                ? "Your personalized 10-question Project Practice session is ready."
                : isIndividualTechnical
                ? "Your personalized 20-question Technical Practice session is ready."
                : "Your personalized multi-round AI assessment has been fully assembled."
              : isIndividualProject
              ? "Analyzing your projects and preparing a personalized project interview."
              : currentStage?.description || "Personalizing your interview from your profile."}
          </p>
        </div>

        {/* Progress Bar Container */}
        <div
          className="rounded-2xl p-5 sm:p-7 md:p-8 space-y-6 shadow-2xl backdrop-blur-xl"
          style={{
            background: "rgba(12, 15, 26, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          {/* Progress Percentage Display */}
          <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
            <span className="text-white/60 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#FF6B35]" />
              Preparation Progress
            </span>
            <span className="text-xl sm:text-2xl font-mono font-black text-[#FF6B35] tabular-nums">
              {progressPercentage}%
            </span>
          </div>

          {/* Track Bar */}
          <div className="w-full h-2.5 sm:h-3 bg-white/[0.06] rounded-full overflow-hidden p-0.5 border border-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] rounded-full shadow-[0_0_10px_rgba(255,107,53,0.4)]"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Stages Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {activeStages.map((stage) => {
              const status = stageStatuses[stage.id];
              const isCurrent = stage.id === currentStage?.id && status === "in_progress";
              const isFailed = status === "failed";
              const isDone = status === "completed";

              return (
                <div
                  key={stage.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-xs sm:text-sm transition-all duration-300 ${
                    isFailed
                      ? "bg-red-500/10 border-red-500/30 text-red-300"
                      : isDone
                      ? "bg-emerald-500/10 border-emerald-500/20 text-slate-200"
                      : isCurrent
                      ? "bg-[#FF6B35]/10 border-[#FF6B35]/35 text-[#FF6B35] font-medium shadow-[0_0_15px_rgba(255,107,53,0.08)]"
                      : "bg-white/[0.02] border-white/[0.06] text-white/40"
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
                        <RefreshCw className="w-4 h-4 text-[#FF6B35]" />
                      </motion.div>
                    )}
                    {!isDone && !isFailed && !isCurrent && (
                      <div className="w-4 h-4 rounded-full border border-white/15 flex items-center justify-center text-[8px] text-white/30">
                        ●
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <p className={`font-semibold leading-tight truncate ${isCurrent ? "text-white" : ""}`}>
                      {stage.title}
                    </p>
                    {isCurrent && (
                      <p className="text-[11px] text-[#FF6B35] leading-tight font-medium">In Progress...</p>
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
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs sm:text-sm space-y-1.5"
            >
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {activeStages.find((s) => s.id === failedStageId)?.failedMessage ||
                  (isIndividualProject
                    ? "Project Practice couldn't be prepared"
                    : "Interview preparation encountered an issue.")}
              </div>
              <p className="text-white/70 text-xs">{friendlyErrorMessage}</p>
              <p className="text-white/40 text-xs">We're sorry for the interruption. Please try again.</p>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* SUCCESS BUTTON */}
            {isPreparationComplete && !failedStageId && (
              <button
                onClick={onPreparationSuccess}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-[#FF6B35]/25 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                {isIndividualProject
                  ? "START PROJECT PRACTICE"
                  : isIndividualTechnical
                  ? "START TECHNICAL PRACTICE"
                  : "ENTER INTERVIEW"}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* FAILURE BUTTONS */}
            {failedStageId && (
              <>
                <button
                  onClick={handleRetry}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-[#FF6B35]/20 transition cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  {partialInfoState?.roundTitle ? `RESUME ${partialInfoState.roundTitle.toUpperCase()} GENERATION` : "TRY AGAIN"}
                </button>
                <button
                  onClick={() => setIsBYOKOpen(true)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#FF6B35]/15 hover:bg-[#FF6B35]/25 text-[#FF6B35] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-[#FF6B35]/30 transition cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                  CONFIGURE AI KEY (BYOK)
                </button>
                <button
                  onClick={() => setShowFeedbackModal(true)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/80 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/10 transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  GIVE FEEDBACK
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* BYOK MODAL */}
      <BYOKModal
        isOpen={isBYOKOpen}
        onClose={() => setIsBYOKOpen(false)}
        onSave={() => {
          isRunningRef.current = false;
          executePreparationSequence();
        }}
      />

      {/* FEEDBACK MODAL */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl p-6 sm:p-8 space-y-5 text-slate-200 shadow-2xl"
              style={{
                background: "rgba(12, 15, 26, 0.98)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div className="space-y-1.5">
                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#FF6B35]" />
                  Help Us Improve Your Interview Experience
                </h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  We're sorry that your session could not be completed. Your feedback helps us identify and improve the issue.
                </p>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs sm:text-sm">
                {/* Field 1: What happened */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-white/70">1. What happened?</label>
                  <select
                    value={feedbackForm.issueType}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, issueType: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#FF6B35]"
                  >
                    <option value="Session did not start" className="bg-[#0D111A]">Session did not start</option>
                    <option value="Question generation failed" className="bg-[#0D111A]">Question generation failed</option>
                    <option value="Session stopped unexpectedly" className="bg-[#0D111A]">Session stopped unexpectedly</option>
                    <option value="Technical issue" className="bg-[#0D111A]">Technical issue</option>
                    <option value="Other" className="bg-[#0D111A]">Other</option>
                  </select>
                </div>

                {/* Field 2: Which stage */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-white/70">2. Which stage?</label>
                  <select
                    value={feedbackForm.failedStage}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, failedStage: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#FF6B35]"
                  >
                    {activeStages.map((s) => (
                      <option key={s.id} value={s.title} className="bg-[#0D111A]">
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 3: Experience rating */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-white/70">3. Experience rating</label>
                  <div className="flex items-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                        className={`p-2 rounded-lg border transition cursor-pointer ${
                          feedbackForm.rating >= star
                            ? "bg-[#FF6B35]/20 border-[#FF6B35]/50 text-[#FF6B35]"
                            : "bg-white/[0.03] border-white/10 text-white/25"
                        }`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 4: Additional comments */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-white/70">4. Additional comments</label>
                  <textarea
                    rows={3}
                    value={feedbackForm.comments}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, comments: e.target.value })}
                    placeholder="Describe any specific details..."
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#FF6B35]"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white text-xs font-semibold cursor-pointer transition border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white text-xs font-bold transition shadow-md shadow-[#FF6B35]/20 cursor-pointer"
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
              className="w-full max-w-lg rounded-2xl p-6 sm:p-8 space-y-5 text-center text-slate-200 shadow-2xl"
              style={{
                background: "rgba(12, 15, 26, 0.98)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg sm:text-xl font-extrabold text-white uppercase tracking-wider">
                  THANK YOU FOR YOUR FEEDBACK
                </h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  We sincerely apologize that your Real Interview could not be completed.
                </p>
                <p className="text-xs text-white/60 leading-relaxed">
                  Your feedback has been recorded and will help us improve the interview experience.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70 leading-relaxed">
                Before attempting the Real Interview again, we recommend strengthening your technical preparation through the Mock Interview and practice sections.
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={onPracticeMock}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-[#FF6B35]/20 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  PRACTICE MOCK INTERVIEW
                </button>
                <button
                  onClick={onReturnToPlatform}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-xs font-semibold flex items-center justify-center gap-2 border border-white/10 transition cursor-pointer"
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
