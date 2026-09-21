import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Bot, Sparkles, Mic, MicOff, CheckCircle2, Keyboard, Loader2, Play, Code2, AlertTriangle, UserCheck, Target, BrainCircuit, Maximize2, RotateCcw, Radio, Send, Volume2, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";

import api from "../../utils/api";
import { getAuthToken, useStudentProfile } from "../../hooks/useStudentProfile";
import { useTextToSpeech } from "../../hooks/useTextToSpeech";
import { getVoiceProfile, selectOptimalVoice } from "../../config/voiceProfiles";

// Import reusable components
import InterviewLayout from "../../components/interview/InterviewLayout";
import AIInterviewerCard from "../../components/interview/AIInterviewerCard";
import AudioVisualizer from "../../components/interview/AudioVisualizer";
import QuestionCard from "../../components/interview/QuestionCard";
import WebcamCard from "../../components/interview/WebcamCard";
import ConversationPanel from "../../components/interview/ConversationPanel";
import NavigationControls from "../../components/interview/NavigationControls";
import ConfirmExitDialog from "../../components/interview/ConfirmExitDialog";
import CompletionScreen from "../../components/interview/CompletionScreen";
import SectionNavigationPanel from "../../components/interview/SectionNavigationPanel";
import FullscreenExitOverlay from "../../components/interview/FullscreenExitOverlay";
import InterviewSettingsModal from "../../components/interview/InterviewSettingsModal";
import RealInterviewPreparationScreen from "../../components/interview/RealInterviewPreparationScreen";
import EvaluationLoadingScreen from "../../components/interview/EvaluationLoadingScreen";
import BYOKModal from "../../components/BYOKModal";

// Import Monaco editor & Output panel for Coding questions
import MonacoCodeEditor from "../../components/coding/MonacoCodeEditor";
import OutputPanel from "../../components/coding/OutputPanel";
import { getStarterCode } from "../../utils/coding/starterGenerator";



/**
 * SignalRow — compact live signal indicator (used in the right-side context).
 */
function SignalRow({ label, on }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span
        className="flex items-center gap-1.5 text-[11px] font-bold"
        style={{ color: on ? "#34d399" : "#f87171" }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: on ? "#34d399" : "#f87171", boxShadow: on ? "0 0 6px rgba(52,211,153,0.8)" : "none" }}
        />
        {on ? "Active" : "Off"}
      </span>
    </div>
  );
}

/**
 * StartInterview Page Component — Phase 2E Fullscreen + Interview Integrity
 */
function StartInterview({
  isIndividualTechnical: propIsIndividualTechnical = false,
  isIndividualProject: propIsIndividualProject = false,
}) {
  const { sessionId: paramSessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const routerState = location.state || {};
  const isIndividualTechnical =
    propIsIndividualTechnical ||
    location.pathname.includes("/individual-practice/technical") ||
    routerState.mode === "INDIVIDUAL_TECHNICAL";

  const isIndividualProject =
    propIsIndividualProject ||
    location.pathname.includes("/individual-project") ||
    routerState.mode === "INDIVIDUAL_PROJECT";

  const { profile } = useStudentProfile();
  const token = getAuthToken();

  // Canonical Session ID State & Ref (Single Source of Truth)
  const initialSessionId = paramSessionId || routerState.sessionId || routerState.interviewId || profile?.interviewId || null;
  const [sessionId, setSessionId] = useState(initialSessionId);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Session State
  const [questions, setQuestions] = useState(routerState.generatedQuestions || []);
  const [currentIndex, setCurrentIndex] = useState(1); // 1-indexed
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [finalResultDoc, setFinalResultDoc] = useState(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [aiStatus, setAiStatus] = useState("SPEAKING"); // "SPEAKING" | "LISTENING" | "THINKING" | "READY"

  // Phase 2E Integrity State
  const [isFullscreenExited, setIsFullscreenExited] = useState(false);
  const [isInFullscreen, setIsInFullscreen] = useState(false);
  const [fullscreenRequested, setFullscreenRequested] = useState(false);
  const everEnteredFsRef = useRef(false);
  const sessionEndTimeRef = useRef(null);

  // Intro state
  const hasIntroducedRef = useRef(false);

  // Response content state
  const [inputMode, setInputMode] = useState("speak"); // 'speak' | 'type'
  const [typedResponse, setTypedResponse] = useState("");
  const [savedAnswers, setSavedAnswers] = useState([]);
  const [dialogueLogs, setDialogueLogs] = useState([]);
  const [showTranscript, setShowTranscript] = useState(false);

  const CODING_STARTERS = {
    cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    int a, b;\n    if (cin >> a >> b) {\n        cout << a + b;\n    }\n    return 0;\n}`,
    c: `#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d", a + b);\n    }\n    return 0;\n}`,
    java: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) {\n            int a = sc.nextInt();\n            int b = sc.nextInt();\n            System.out.println(a + b);\n        }\n    }\n}`,
    python: `import sys\n\n# Read input from stdin\nlines = sys.stdin.read().split()\nif len(lines) >= 2:\n    a, b = int(lines[0]), int(lines[1])\n    print(a + b)\n`,
    javascript: `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\nif (input.length >= 2) {\n    const [a, b] = input.map(Number);\n    console.log(a + b);\n}\n`,
  };

  const [codingLanguage, setCodingLanguage] = useState("python");
  const [currentCode, setCurrentCode] = useState("");
  const codingCodeByLangRef = useRef({});
  const [customInput, setCustomInput] = useState("");
  const [compilerOutput, setCompilerOutput] = useState(null);
  const [codingSubmissionResult, setCodingSubmissionResult] = useState(null);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [outputTab, setOutputTab] = useState("Testcase");

  // Target Round State ("all", "aptitude", "technical", "coding", "hr")
  const queryParams = new URLSearchParams(location.search);
  const initialTargetRound = routerState.targetRound || queryParams.get("round") || "all";
  const [targetRound, setTargetRound] = useState(initialTargetRound);

  // Candidate Info State
  const [candidateInfo, setCandidateInfo] = useState({
    name: routerState.candidateName || profile.name || MOCK_CANDIDATE.name,
    resumeName: routerState.resumeFileName || profile.resumeFileName || MOCK_CANDIDATE.resumeName,
    interviewType: "Real AI Interview Room",
    difficulty: "Adaptive",
    totalTimeMinutes: 150,
  });

  const memoizedCandidateProfile = useMemo(() => {
    const cats = profile?.categorizedSkills || {};
    return {
      fullName: candidateInfo.name,
      resumeName: candidateInfo.resumeName,
      skills: profile?.skills || profile?.all_skills || [],
      categorizedSkills: cats,
      programmingLanguages: cats.programming_languages || profile?.programmingLanguages || [],
      frameworks: cats.frameworks || profile?.frameworks || [],
      databases: cats.databases || profile?.databases || [],
      cloud: cats.cloud || profile?.cloud || [],
      tools: cats.tools || profile?.tools || [],
      projects: profile?.projects || [],
      experience: profile?.experience || [],
      certifications: profile?.certifications || [],
      education: profile?.education || [],
    };
  }, [candidateInfo.name, candidateInfo.resumeName, profile]);

  const [isLoadingInterview, setIsLoadingInterview] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  // Media & STT state
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const isMicOnRef = useRef(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const isSpeakerOnRef = useRef(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  // Webcam stream
  const [webcamStream, setWebcamStream] = useState(null);
  const webcamStreamRef = useRef(null);

  // Session timer (dynamic minutes based on round: 150m for all, 30m for aptitude, 45m for technical/coding, 15m for hr)
  const [interviewDurationMin, setInterviewDurationMin] = useState(150);
  const totalSeconds = interviewDurationMin * 60;
  const [timerSeconds, setTimerSeconds] = useState(totalSeconds);

  // Speech Recognition & Silence Buffer
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const isListeningSpeechRef = useRef(false);
  const recognitionRef = useRef(null);
  const speechBaseTextRef = useRef("");
  const silenceTimerRef = useRef(null);
  const isManualStopRef = useRef(false);

  // Voice Customization Settings
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_interview_voice_settings");
      return saved ? JSON.parse(saved) : { persona: "auto", voiceURI: "", rate: 0.92, pitch: 0.90 };
    } catch (e) {
      return { persona: "auto", voiceURI: "", rate: 0.92, pitch: 0.90 };
    }
  });
  const voiceSettingsRef = useRef(voiceSettings);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);

  const handleSaveVoiceSettings = useCallback((newSettings) => {
    setVoiceSettings(newSettings);
    voiceSettingsRef.current = newSettings;
    try {
      localStorage.setItem("ai_interview_voice_settings", JSON.stringify(newSettings));
    } catch (e) {}
  }, []);

  // Synchronized state refs for callbacks
  const aiStatusRef = useRef("SPEAKING");
  const inputModeRef = useRef("speak");
  const typedResponseRef = useRef("");
  const isCompletedRef = useRef(false);
  const isFullscreenExitedRef = useRef(false);
  const currentSectionRef = useRef("APTITUDE");
  // Track when TTS last finished — used to discard mic bleed within 600ms of AI speech ending
  const ttsEndedAtRef = useRef(0);

  // TTS Hook
  const { speak: ttsSpeak, stop: ttsStop } = useTextToSpeech();

  const currentQuestion = questions[currentIndex - 1] || {};
  const currentSection = currentQuestion.section || "APTITUDE";

  // Keep refs in sync
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isListeningSpeechRef.current = isListeningSpeech; }, [isListeningSpeech]);
  useEffect(() => { aiStatusRef.current = aiStatus; }, [aiStatus]);
  useEffect(() => { inputModeRef.current = inputMode; }, [inputMode]);
  useEffect(() => { typedResponseRef.current = typedResponse; }, [typedResponse]);
  useEffect(() => { isCompletedRef.current = isCompleted; }, [isCompleted]);
  useEffect(() => { isFullscreenExitedRef.current = isFullscreenExited; }, [isFullscreenExited]);
  useEffect(() => { currentSectionRef.current = currentSection; }, [currentSection]);

  // ─── PHASE 2E: LOG INTEGRITY EVENT TO BACKEND ───
  const logIntegrityEvent = useCallback(async (eventType, details = "") => {
    const currentSessionId = sessionIdRef.current || sessionId;
    if (!currentSessionId) return;
    try {
      await api.post(`/api/student/interviews/${currentSessionId}/integrity-event`, {
        eventType,
        questionId: currentQuestion.id || currentQuestion.questionId || "",
        questionIndex: currentIndex,
        section: currentSection,
        details
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.warn("Failed to log integrity event:", err);
    }
  }, [sessionId, currentQuestion, currentIndex, currentSection, token]);

  // ─── PHASE 2E: FULLSCREEN ENFORCEMENT & PAUSE OVERLAY ───
  const handleReenterFullscreen = useCallback(() => {
    const el = document.documentElement;
    const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (rfs) {
      rfs.call(el).then(() => {
        setIsFullscreenExited(false);
      }).catch((err) => console.warn("Fullscreen request error:", err));
    }
  }, []);

  useEffect(() => {
    if (isLoadingInterview || isCompleted) return;

    // Request fullscreen on startup (user-initiated Start Interview gesture)
    const timer = setTimeout(() => {
      handleReenterFullscreen();
      setFullscreenRequested(true);
    }, 400);

    return () => clearTimeout(timer);
  }, [isLoadingInterview, isCompleted, handleReenterFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      setIsInFullscreen(isFS);
      if (isFS) {
        everEnteredFsRef.current = true;
        setIsFullscreenExited(false);
      } else if (everEnteredFsRef.current && !isCompleted && !isLoadingInterview) {
        // Only treat as an integrity "exit" pause once the candidate has been
        // in fullscreen at least once (otherwise it's the initial requirement).
        setIsFullscreenExited(true);
        window.self?.speechSynthesis?.cancel();
        logIntegrityEvent("FULLSCREEN_EXIT", "Candidate exited browser fullscreen mode");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, [isCompleted, isLoadingInterview, logIntegrityEvent]);

  // ─── Hide the website navbar while inside the dedicated interview room ───
  useEffect(() => {
    document.body.classList.add("interview-active");
    return () => document.body.classList.remove("interview-active");
  }, []);

  // Blocking fullscreen-required gate: shown only before the candidate has
  // entered fullscreen and the browser refused the automatic request.
  const showFullscreenGate =
    fullscreenRequested && !isInFullscreen && !isFullscreenExited && !isCompleted && !isLoadingInterview;

  // ─── PHASE 2E: TAB VISIBILITY SWITCH DETECTION ───
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isCompleted && !isLoadingInterview) {
        logIntegrityEvent("TAB_SWITCH", "Candidate switched active tab or minimized browser window");
      } else if (!document.hidden && !isCompleted && !isLoadingInterview) {
        toast("Security Event Logged: Tab switch detected during session.", { id: "tab-switch-toast", duration: 3000 });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isCompleted, isLoadingInterview, logIntegrityEvent]);

  // ─── PHASE 2E: COPY / PASTE / RIGHT-CLICK PROTECTION (PRESERVING MONACO EDITOR) ───
  useEffect(() => {
    const isMonacoTarget = (target) => {
      if (!target) return false;
      return !!(
        target.closest?.(".monaco-editor") ||
        target.closest?.(".monaco-aria-container") ||
        (target.tagName === "TEXTAREA" && target.classList?.contains("inputarea"))
      );
    };

    const handleCopy = (e) => {
      if (isMonacoTarget(e.target)) return; // Allow Monaco IDE copy!
      e.preventDefault();
      toast.error("Copy action restricted for interview security.", { id: "copy-toast" });
      logIntegrityEvent("COPY_ATTEMPT", "Copy attempted outside code editor");
    };

    const handlePaste = (e) => {
      if (isMonacoTarget(e.target)) return; // Allow Monaco IDE paste!
      e.preventDefault();
      toast.error("Paste action restricted for interview security.", { id: "paste-toast" });
      logIntegrityEvent("PASTE_ATTEMPT", "Paste attempted outside code editor");
    };

    const handleContextMenu = (e) => {
      if (isMonacoTarget(e.target)) return; // Allow Monaco IDE right-click context menu!
      e.preventDefault();
      toast.error("Right-click context menu restricted.", { id: "contextmenu-toast" });
      logIntegrityEvent("CONTEXT_MENU_ATTEMPT", "Right-click context menu attempted outside code editor");
    };

    window.addEventListener("copy", handleCopy);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [logIntegrityEvent]);

  // ─── Speaker Toggle ───
  const handleToggleSpeaker = useCallback(() => {
    const next = !isSpeakerOnRef.current;
    isSpeakerOnRef.current = next;
    setIsSpeakerOn(next);

    if (!next) {
      ttsStop();
      window.speechSynthesis?.cancel();
      setAiStatus("LISTENING");
      aiStatusRef.current = "LISTENING";
      toast("Interviewer audio muted", { id: "speaker-toggle-status", duration: 1500, icon: "🔇" });
    } else {
      toast.success("Interviewer audio unmuted", { id: "speaker-toggle-status", duration: 1500, icon: "🔊" });
    }
  }, [ttsStop]);

  // ─── Webcam acquisition ───
  const hasAttemptedWebcamRef = useRef(false);
  const webcamDeniedRef = useRef(false);

  const startWebcam = useCallback(async () => {
    if (webcamDeniedRef.current || hasAttemptedWebcamRef.current) {
      return;
    }
    hasAttemptedWebcamRef.current = true;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsCameraOn(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      webcamStreamRef.current = stream;
      setWebcamStream(stream);
      setIsCameraOn(true);

      const vTrack = stream.getVideoTracks?.()[0];
      if (vTrack) {
        vTrack.onended = () => {
          setIsCameraOn(false);
          logIntegrityEvent("CAMERA_DISCONNECTED", "Candidate camera track ended unexpectedly");
        };
      }
    } catch (err) {
      webcamDeniedRef.current = true;
      setIsCameraOn(false);
      console.warn("Webcam access warning (permission denied or unavailable):", err?.name || err);
    }
  }, [logIntegrityEvent]);

  const stopWebcam = useCallback(() => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      webcamStreamRef.current = null;
      setWebcamStream(null);
    }
    setIsCameraOn(false);
  }, []);

  const startSpeechRecognitionRef = useRef(null);

  const stopSpeechRecognition = useCallback((immediateAbort = true) => {
    isManualStopRef.current = true;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      const recInstance = recognitionRef.current;
      recognitionRef.current = null;
      recInstance.onend = null;
      recInstance.onerror = null;
      recInstance.onresult = null;
      recInstance.onstart = null;
      try {
        if (immediateAbort) {
          recInstance.abort();
        } else {
          recInstance.stop();
        }
      } catch (e) {}
    }
    setIsListeningSpeech(false);
    isListeningSpeechRef.current = false;
  }, []);

  const handleToggleCamera = useCallback(() => {
    if (webcamDeniedRef.current) {
      toast("Camera permission was denied in browser settings", { id: "camera-denied-toast", icon: "📷" });
      return;
    }
    setIsCameraOn((prev) => {
      const next = !prev;
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = next; });
      }
      return next;
    });
  }, []);

  const handleToggleMic = useCallback(() => {
    const next = !isMicOnRef.current;
    isMicOnRef.current = next;
    setIsMicOn(next);

    if (!next) {
      stopSpeechRecognition(true);
      toast("Microphone muted", { duration: 1500, id: "mic-toggle-status", icon: "🔇" });
    } else {
      isManualStopRef.current = false;
      toast.success("Microphone active", { duration: 1500, id: "mic-toggle-status", icon: "🎙️" });
      if (
        aiStatusRef.current === "LISTENING" &&
        inputModeRef.current === "speak" &&
        currentSectionRef.current !== "APTITUDE" &&
        currentSectionRef.current !== "CODING"
      ) {
        setTimeout(() => {
          if (isMicOnRef.current) {
            startSpeechRecognitionRef.current?.();
          }
        }, 50);
      }
    }
  }, [stopSpeechRecognition]);

  useEffect(() => {
    if (!hasAttemptedWebcamRef.current && !webcamDeniedRef.current) {
      startWebcam();
    }
    return () => {
      stopWebcam();
      stopSpeechRecognition();
      window.speechSynthesis?.cancel();
    };
  }, [startWebcam, stopWebcam, stopSpeechRecognition]);

  // Shut down camera & mic hardware immediately when interview completes
  useEffect(() => {
    if (isCompleted) {
      stopWebcam();
      stopSpeechRecognition();
      window.speechSynthesis?.cancel();
    }
  }, [isCompleted, stopWebcam, stopSpeechRecognition]);

  // ─── FETCH & RECOVER SESSION DATA FROM BACKEND ───
  const fetchSessionData = useCallback(async () => {
    try {
      let storedSessionId = "";
      try {
        storedSessionId = localStorage.getItem(
          isIndividualProject
            ? "active_individual_project_session_id"
            : isIndividualTechnical
            ? "active_individual_technical_session_id"
            : "active_real_interview_session_id"
        ) || "";
      } catch (e) {}

      let targetId = sessionIdRef.current || sessionId || paramSessionId || routerState.sessionId || routerState.interviewId || storedSessionId || profile?.interviewId;

      const activeToken = token || getAuthToken();
      const authHeaderOptions = activeToken ? { headers: { Authorization: `Bearer ${activeToken}` } } : {};

      if (isIndividualProject) {
        if (!targetId || targetId === "undefined" || targetId === "null") {
          throw new Error("Missing Individual Project session ID");
        }
        setSessionId(targetId);
        sessionIdRef.current = targetId;
        try {
          localStorage.setItem("active_individual_project_session_id", targetId);
        } catch (e) {}

        const { data } = await api.get(`/api/individual/project/session/${targetId}`, authHeaderOptions);
        const sess = data.session || data;

        const isDbCompleted = sess.status === "COMPLETED";
        if (isDbCompleted) {
          setIsCompleted(true);
          try {
            localStorage.removeItem("active_individual_project_session_id");
          } catch (e) {}
        } else {
          setIsCompleted(false);
        }

        setTargetRound("resume_project");
        setInterviewDurationMin(30);

        const loadedQs = (sess.questions || []).map((q, idx) => ({
          id: String(q.questionId || `Q-${idx + 1}`),
          questionId: String(q.questionId || `Q-${idx + 1}`),
          questionNumber: idx + 1,
          section: "RESUME_PROJECT",
          topic: q.topic || "Project Architecture",
          projectName: q.projectName || "Project",
          difficulty: q.difficulty || "Medium",
          type: "project",
          questionType: "project",
          category: "resume_project",
          question: q.question,
          aiSpeechText: q.question,
          marks: q.marks || 10,
        }));

        if (loadedQs.length > 0) {
          setQuestions(loadedQs);
        }

        if (sess.answers && Array.isArray(sess.answers)) {
          const savedAnswersList = sess.answers.map((ans) => ({
            questionId: String(ans.questionId),
            questionText: ans.questionText || "",
            section: "RESUME_PROJECT",
            answer: ans.candidateAnswer || "",
            transcript: ans.candidateAnswer || "",
            inputMethod: ans.inputMethod || "TEXT",
            status: ans.candidateAnswer ? "answered" : "unanswered",
          }));
          setSavedAnswers(savedAnswersList);
        }

        setCandidateInfo({
          name: profile?.name || MOCK_CANDIDATE.name,
          resumeName: profile?.resumeFileName || "Uploaded_Resume.pdf",
          interviewType: "Project / Resume Practice",
          difficulty: sess.difficulty || "Medium",
          totalTimeMinutes: 30,
        });

        setTimerSeconds(30 * 60);
        return { isIndividualProject: true, session: sess, generatedQuestions: loadedQs, status: sess.status };
      }

      if (isIndividualTechnical) {
        if (!targetId || targetId === "undefined" || targetId === "null") {
          throw new Error("Missing Individual Technical session ID");
        }
        setSessionId(targetId);
        sessionIdRef.current = targetId;
        try {
          localStorage.setItem("active_individual_technical_session_id", targetId);
        } catch (e) {}

        const { data } = await api.get(`/api/individual/technical/session/${targetId}`, authHeaderOptions);
        const sess = data.session || data;

        const isDbCompleted = sess.status === "COMPLETED";
        if (isDbCompleted) {
          setIsCompleted(true);
          try {
            localStorage.removeItem("active_individual_technical_session_id");
          } catch (e) {}
        } else {
          setIsCompleted(false);
        }

        setTargetRound("technical");
        setInterviewDurationMin(45);

        const loadedQs = (sess.questions || []).map((q, idx) => ({
          id: String(q.questionId || `Q-${idx + 1}`),
          questionId: String(q.questionId || `Q-${idx + 1}`),
          questionNumber: idx + 1,
          section: "TECHNICAL",
          topic: q.topic || "Technical",
          skill: q.skill || "General",
          difficulty: q.difficulty || "Medium",
          type: "technical",
          questionType: "technical",
          category: "technical",
          question: q.question,
          aiSpeechText: q.question,
        }));

        if (loadedQs.length > 0) {
          setQuestions(loadedQs);
        }

        if (sess.answers && Array.isArray(sess.answers)) {
          const savedAnswersList = sess.answers.map((ans) => ({
            questionId: String(ans.questionId),
            questionText: ans.questionText || "",
            section: "TECHNICAL",
            answer: ans.candidateAnswer || "",
            transcript: ans.candidateAnswer || "",
            inputMethod: ans.inputMethod || "TEXT",
            status: ans.candidateAnswer ? "answered" : "unanswered",
          }));
          setSavedAnswers(savedAnswersList);
        }

        setCandidateInfo({
          name: profile?.name || MOCK_CANDIDATE.name,
          resumeName: profile?.resumeFileName || "Uploaded_Resume.pdf",
          interviewType: "Technical Practice",
          difficulty: sess.difficulty || "Medium",
          totalTimeMinutes: 45,
        });

        setTimerSeconds(45 * 60);
        return { isIndividualTechnical: true, session: sess, generatedQuestions: loadedQs, status: sess.status };
      }

      if (!targetId || targetId === "undefined" || targetId === "null") {
        const { data: newSession } = await api.post(
          "/api/student/interviews",
          { interviewType: "actual" },
          authHeaderOptions
        );
        targetId = newSession.sessionId || newSession.interviewId || newSession._id;
        if (targetId) {
          setSessionId(targetId);
          sessionIdRef.current = targetId;
          try {
            localStorage.setItem("active_real_interview_session_id", targetId);
          } catch (e) {}
        }
      } else {
        setSessionId(targetId);
        sessionIdRef.current = targetId;
        try {
          localStorage.setItem("active_real_interview_session_id", targetId);
        } catch (e) {}
      }

      if (!targetId || targetId === "undefined" || targetId === "null") {
        throw new Error("Could not initialize interview session ID");
      }

      const { data } = await api.get(`/api/student/interviews/${targetId}`, authHeaderOptions);

      const isDbCompleted = (data.status === "completed" || data.status === "COMPLETED");
      if (isDbCompleted) {
        setIsCompleted(true);
        try {
          localStorage.removeItem("active_real_interview_session_id");
        } catch (e) {}
      } else {
        setIsCompleted(false);
      }

      const activeTarget = data.targetRound || initialTargetRound || "all";
      setTargetRound(activeTarget);

      const durMin = data.durationMinutes || (activeTarget === "aptitude" ? 20 : activeTarget === "technical" ? 30 : activeTarget === "coding" ? 35 : activeTarget === "hr" ? 20 : 105);
      setInterviewDurationMin(durMin);

      let loadedQs = data.generatedQuestions || [];

      if (loadedQs && loadedQs.length > 0) {
        setQuestions(loadedQs);
      }

      if (data.answers && Array.isArray(data.answers)) {
        setSavedAnswers(data.answers);
      }

      if (data.currentQuestionIndex) {
        setCurrentIndex(Number(data.currentQuestionIndex) || 1);
      }

      const roundTitles = {
        all: "Real AI Interview Room (All 5 Rounds)",
        aptitude: "Aptitude Round (MCQs)",
        resume_project: "Resume / Project Round (AI)",
        technical: "Technical Stack Round (Alex)",
        coding: "Coding IDE Round (Compiler)",
        hr: "HR & Behavioral Round (Sarah)"
      };

      if (data.candidateProfile) {
        setCandidateInfo({
          name: data.candidateProfile.candidateName || profile.name || MOCK_CANDIDATE.name,
          resumeName: data.resumeFileName || profile.resumeFileName || "Uploaded_Resume.pdf",
          interviewType: roundTitles[activeTarget] || "Real AI Interview Room",
          difficulty: "Adaptive",
          totalTimeMinutes: durMin,
        });
      }

      if (isDbCompleted && data.startedAt) {
        const startTs = new Date(data.startedAt).getTime();
        sessionEndTimeRef.current = startTs + durMin * 60000;
        const remaining = Math.max(0, Math.round((sessionEndTimeRef.current - Date.now()) / 1000));
        setTimerSeconds(remaining);
      } else {
        setTimerSeconds(durMin * 60);
      }
      return data;
    } catch (err) {
      console.error("Session load error:", err);
      const d = err.response?.data || {};
      const safeMsg =
        d.message || err.message || "Failed to initialize interview questions";
      const errType = d.errorType || "AI_GENERATION_FAILED";
      const provider = d.provider || "groq";
      setSessionError(`${safeMsg}\n[Provider: ${provider}] [${errType}]`);
      toast.error(safeMsg, { duration: 8000, id: "session-load-error" });
      return null;
    }
  }, [sessionId, paramSessionId, token, initialTargetRound, profile, isIndividualTechnical]);

  useEffect(() => {
    const initSession = async () => {
      const data = await fetchSessionData();
      const st = String(data?.status || data?.session?.status || "").toUpperCase();
      const isDbCompleted = (st === "COMPLETED");
      const isDbEvaluating = (st === "SUBMITTED" || st.startsWith("EVALUATING_") || st === "CALCULATING_RESULT");

      if (isIndividualTechnical) {
        if (isDbCompleted) {
          setIsLoadingInterview(false);
          setIsEvaluating(false);
          setIsCompleted(true);
          navigate(`/individual-practice/technical/result/${sessionIdRef.current || sessionId}`);
        } else if (data?.generatedQuestions?.length === 20 || data?.session?.questions?.length === 20) {
          setIsLoadingInterview(false);
          setIsEvaluating(false);
          setIsCompleted(false);
        } else {
          setIsLoadingInterview(true);
          setIsEvaluating(false);
          setIsCompleted(false);
        }
        return;
      }

      if (isDbCompleted) {
        setIsLoadingInterview(false);
        setIsEvaluating(false);
        setIsCompleted(true);
      } else if (isDbEvaluating) {
        setIsLoadingInterview(false);
        setIsEvaluating(true);
        setIsCompleted(false);
      } else if (data?.generatedQuestions && data.generatedQuestions.length >= 41) {
        // Active session with questions already prepared (e.g. page refresh)
        setIsLoadingInterview(false);
        setIsEvaluating(false);
        setIsCompleted(false);
      } else {
        // Preparation needed
        setIsLoadingInterview(true);
        setIsEvaluating(false);
        setIsCompleted(false);
      }
    };
    initSession();
  }, [paramSessionId, fetchSessionData, isIndividualTechnical, navigate, sessionId]);


  // ─── SINGLE SOURCE OF TRUTH: SESSION PROGRESS ───
  // Every progress readout (sidebar, overall, section headers, completion
  // stats) is derived from this one memoized object so no UI shows a
  // different number. Progress = actually-submitted (non-empty) answers only.
  const sessionProgress = useMemo(() => {
    const answeredIds = new Set(
      savedAnswers
        .filter((a) => a.answer && String(a.answer).trim().length > 0)
        .map((a) => String(a.questionId))
    );

    if (isIndividualProject) {
      const qList = (questions || []).filter((q) => q.section === "RESUME_PROJECT");
      const total = qList.length > 0 ? qList.length : 5;
      let completed = 0;
      qList.forEach((q) => {
        if (answeredIds.has(String(q.id || q.questionId))) completed += 1;
      });
      return {
        RESUME_PROJECT: { completed, total },
        totalCompleted: completed,
        totalQuestions: total,
      };
    }

    if (isIndividualTechnical) {
      const qList = (questions || []).filter((q) => q.section === "TECHNICAL");
      const total = qList.length > 0 ? qList.length : (questions.length || 20);
      let completed = 0;
      qList.forEach((q) => {
        if (answeredIds.has(String(q.id || q.questionId))) completed += 1;
      });
      return {
        TECHNICAL: { completed, total },
        totalCompleted: completed,
        totalQuestions: total,
      };
    }

    // Full 5-round real interview mode
    const counts = {
      APTITUDE: { completed: 0, total: 0 },
      RESUME_PROJECT: { completed: 0, total: 0 },
      TECHNICAL: { completed: 0, total: 0 },
      CODING: { completed: 0, total: 0 },
      HR: { completed: 0, total: 0 },
      totalCompleted: 0,
      totalQuestions: 0,
    };

    // Calculate actual total loaded per section from questions array
    (questions || []).forEach((q) => {
      const sec = q.section || "TECHNICAL";
      if (counts[sec]) {
        counts[sec].total += 1;
        const qId = String(q.id || q.questionId);
        if (answeredIds.has(qId)) {
          counts[sec].completed += 1;
          counts.totalCompleted += 1;
        }
      }
    });

    // Baseline fallbacks if section questions are loaded on-demand
    if (counts.APTITUDE.total === 0) counts.APTITUDE.total = 15;
    if (counts.RESUME_PROJECT.total === 0) counts.RESUME_PROJECT.total = 5;
    if (counts.TECHNICAL.total === 0) counts.TECHNICAL.total = 20;
    if (counts.CODING.total === 0) counts.CODING.total = 3;
    if (counts.HR.total === 0) counts.HR.total = 5;

    counts.totalQuestions = (questions && questions.length > 0)
      ? questions.length
      : (counts.APTITUDE.total + counts.RESUME_PROJECT.total + counts.TECHNICAL.total + counts.CODING.total + counts.HR.total);

    return counts;
  }, [questions, savedAnswers, isIndividualProject, isIndividualTechnical]);

  // ─── CONTEXTUAL AI FOLLOW-UP (backend-only, no keys exposed) ───
  const triggerFollowUp = useCallback(async (section, baseQuestion, answerText) => {
    try {
      const previousQuestions = (questions || [])
        .filter((q) => q.section === section)
        .map((q) => q.question);
      const currentSessionId = sessionIdRef.current || sessionId;
      const { data } = await api.post(
        `/api/interview/${currentSessionId}/follow-up`,
        {
          section,
          currentQuestion: baseQuestion?.question || "",
          answer: answerText,
          previousQuestions,
          topicsCovered: [],
          interviewContext: "Live interview round",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data && data.shouldFollowUp && data.question && String(data.question).trim()) {
        const followUpQ = {
          id: `FU-${Date.now()}`,
          questionId: `FU-${Date.now()}`,
          questionNumber: (questions?.length || 0) + 1,
          section,
          topic: data.topic || section,
          difficulty: "medium",
          type: section.toLowerCase(),
          questionType: section.toLowerCase(),
          category: section.toLowerCase(),
          question: data.question,
          aiSpeechText: data.question,
          source: "ai_followup",
          _isFollowUp: true,
        };
        setQuestions((prev) => {
          const idx = prev.findIndex(
            (q) => (q.id || q.questionId) === (baseQuestion?.id || baseQuestion?.questionId)
          );
          const insertAt = idx === -1 ? prev.length : idx + 1;
          const copy = [...prev];
          copy.splice(insertAt, 0, followUpQ);
          return copy;
        });
      }
    } catch (e) {
      // Follow-up is best-effort; never break the interview on failure.
    }
  }, [sessionId, questions, token]);

  // ─── SAVE ANSWER TO BACKEND ───
  const handleSaveAnswer = useCallback(async (statusType = "answered", customAns = null) => {
    stopSpeechRecognition();
    const section = currentQuestion.section || "APTITUDE";
    const finalAnswerText = customAns !== null ? customAns : (section === "CODING" ? currentCode : typedResponse);

    const qId = String(currentQuestion.id || currentQuestion.questionId || `Q-${currentIndex}`);
    const actualStatus = (finalAnswerText && String(finalAnswerText).trim().length > 0) ? "answered" : statusType;

    const answerRecord = {
      questionId: qId,
      questionText: currentQuestion.question,
      category: currentQuestion.category || section.toLowerCase(),
      section,
      answer: finalAnswerText,
      transcript: finalAnswerText,
      inputMethod: inputMode === "speak" ? "VOICE" : "TEXT",
      status: actualStatus
    };

    const currentSessionId = sessionIdRef.current || sessionId;
    if (currentSessionId) {
      try {
        if (isIndividualProject) {
          await api.post(`/api/individual/project/session/${currentSessionId}/answer`, {
            questionId: qId,
            candidateAnswer: finalAnswerText,
            inputMethod: inputMode === "speak" ? "voice" : "text",
          }, { headers: { Authorization: `Bearer ${token}` } });
        } else if (isIndividualTechnical) {
          await api.post(`/api/individual/technical/session/${currentSessionId}/answer`, {
            questionId: qId,
            candidateAnswer: finalAnswerText,
            inputMethod: inputMode === "speak" ? "voice" : "text",
          }, { headers: { Authorization: `Bearer ${token}` } });
        } else {
          await api.post(`/api/student/interviews/${currentSessionId}/answer`, {
            questionId: qId,
            question: currentQuestion.question,
            category: currentQuestion.category || section.toLowerCase(),
            section,
            answer: finalAnswerText,
            transcript: finalAnswerText,
            inputMethod: inputMode === "speak" ? "VOICE" : "TEXT",
            mode: inputMode === "speak" ? "voice" : "text",
            status: actualStatus,
            currentQuestionIndex: currentIndex,
          }, { headers: { Authorization: `Bearer ${token}` } });
        }
      } catch (err) {
        console.error("Save answer error:", err);
      }
    }

    setSavedAnswers((prev) => {
      const filtered = prev.filter((ans) => String(ans.questionId) !== qId && String(ans.questionId) !== String(currentQuestion.id) && String(ans.questionId) !== String(currentQuestion.questionId));
      return [...filtered, answerRecord];
    });

    if (finalAnswerText && inputMode === "speak") {
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDialogueLogs((prev) => [
        ...prev,
        { sender: "YOU", text: finalAnswerText, time: timeNow }
      ]);
    }

    // Trigger a contextual AI follow-up for spoken/typed answers on AI sections.
    if (
      finalAnswerText &&
      finalAnswerText.trim().length > 15 &&
      (section === "TECHNICAL" || section === "HR" || section === "RESUME_PROJECT") &&
      !currentQuestion._isFollowUp &&
      !isIndividualTechnical
    ) {
      triggerFollowUp(section, currentQuestion, finalAnswerText);
    }
  }, [stopSpeechRecognition, currentQuestion, currentIndex, currentCode, typedResponse, inputMode, sessionId, token, triggerFollowUp, isIndividualTechnical]);

  // ─── SECTION NAVIGATION & ON-DEMAND LAZY LOAD HANDLER ───
  const handleSelectSection = async (targetSection) => {
    let currentQuestions = [...questions];
    let sectionQuestions = currentQuestions.filter((q) => q.section === targetSection);

    const currentSessionId = sessionIdRef.current || sessionId;
    if (!sectionQuestions.length && currentSessionId) {
      const toastId = toast.loading(`Preparing ${targetSection} round questions…`);
      try {
        const normSec = targetSection.toLowerCase();
        const { data } = await api.get(`/api/interview/${currentSessionId}/round/${normSec}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const newRoundQs = data.questions || [];
        if (newRoundQs.length > 0) {
          const existingIds = new Set(currentQuestions.map(q => String(q.id || q.questionId)));
          const toAdd = newRoundQs.filter(q => !existingIds.has(String(q.id || q.questionId)));
          currentQuestions = [...currentQuestions, ...toAdd];
          setQuestions(currentQuestions);
          sectionQuestions = currentQuestions.filter((q) => q.section === targetSection);
          toast.success(`${targetSection} round ready!`, { id: toastId });
        } else {
          toast.error(`No questions found for ${targetSection}`, { id: toastId });
          return;
        }
      } catch (err) {
        console.error(`Error loading ${targetSection} round:`, err);
        toast.error(`Failed to load ${targetSection} round`, { id: toastId });
        return;
      }
    }

    if (!sectionQuestions.length) return;

    const answeredIds = new Set(
      savedAnswers
        .filter((a) => a.answer && String(a.answer).trim().length > 0)
        .map((a) => String(a.questionId))
    );

    const firstUnanswered = sectionQuestions.find((q) => !answeredIds.has(String(q.id || q.questionId)));
    const targetQuestion = firstUnanswered || sectionQuestions[0];
    const targetIdx = currentQuestions.findIndex((q) => (q.id || q.questionId) === (targetQuestion.id || targetQuestion.questionId));

    if (targetIdx !== -1) {
      stopSpeechRecognition();
      window.speechSynthesis?.cancel();

      // Persist only a genuinely-provided answer for the CURRENT question.
      // Navigation alone must NOT increment progress (no blank/starter-code
      // submissions), so we guard against empty and unmodified starter code.
      const isCurrentCoding = currentSection === "CODING";
      const currentAnswerText = isCurrentCoding ? currentCode : typedResponse;
      const starter = currentQuestion.starterCode || "def solution():\n    pass";
      const hasRealAnswer =
        currentAnswerText &&
        currentAnswerText.trim().length > 0 &&
        (!isCurrentCoding || currentAnswerText.trim() !== starter.trim());

      if (hasRealAnswer) {
        handleSaveAnswer("answered");
      }

      setCurrentIndex(targetIdx + 1);
      toast.success(`Switched to ${targetSection} section`);
    }
  };

  // ─── TIMER COUNTDOWN (session-based, pauses outside fullscreen) ───
  useEffect(() => {
    if (isLoadingInterview || isFullscreenExited || !isInFullscreen) return;
    let interval;
    if (!isPaused && !isCompleted && !isGeneratingQuestion && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, isCompleted, isGeneratingQuestion, timerSeconds, isFullscreenExited, isLoadingInterview, isInFullscreen]);

  // ─── FINAL SUBMIT INTERVIEW HANDLER ───
  const handleFinalSubmitInterview = useCallback(async () => {
    stopSpeechRecognition();
    window.speechSynthesis?.cancel();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => null);
    }
    await handleSaveAnswer("answered");
    const currentSessionId = sessionIdRef.current || sessionId;
    setIsEvaluating(true);

    if (currentSessionId) {
      try {
        if (isIndividualProject) {
          await api.post(`/api/individual/project/session/${currentSessionId}/submit`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          try {
            localStorage.removeItem("active_individual_project_session_id");
          } catch (e) {}
          navigate(`/student/individual-project/result/${currentSessionId}`);
        } else if (isIndividualTechnical) {
          await api.post(`/api/individual/technical/session/${currentSessionId}/submit`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          try {
            localStorage.removeItem("active_individual_technical_session_id");
          } catch (e) {}
          navigate(`/individual-practice/technical/result/${currentSessionId}`);
        } else {
          await api.post("/api/real-interview/submit", { sessionId: currentSessionId }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          try {
            localStorage.removeItem("active_real_interview_session_id");
          } catch (e) {}
        }
      } catch (err) {
        console.warn("[StartInterview] Submit pipeline notice:", err.message);
      }
    }
  }, [sessionId, token, handleSaveAnswer, stopSpeechRecognition, isIndividualTechnical, isIndividualProject, navigate]);

  // ─── AUTO-SUBMIT WHEN TIME EXPIRES ───
  useEffect(() => {
    if (timerSeconds === 0 && !isCompleted && !isEvaluating && !isLoadingInterview) {
      logIntegrityEvent("TIME_UP", "Interview duration elapsed — auto-submitting");
      handleFinalSubmitInterview();
    }
  }, [timerSeconds, isCompleted, isEvaluating, isLoadingInterview, logIntegrityEvent, handleFinalSubmitInterview]);


  // ─── AI INTERVIEWER SPEECH PLAYBACK LAYER ───
  const speakCurrentQuestion = useCallback((text, section, topic) => {
    // Immediately stop STT recording so the candidate's mic does NOT record the AI's question audio!
    stopSpeechRecognition(true);

    if (!text || !isSpeakerOnRef.current || isFullscreenExitedRef.current) {
      setAiStatus("LISTENING");
      aiStatusRef.current = "LISTENING";
      if (inputModeRef.current === "speak" && isMicOnRef.current && !micPermissionDenied && section !== "APTITUDE" && section !== "CODING") {
        setTimeout(() => {
          if (aiStatusRef.current === "LISTENING" && isMicOnRef.current) {
            isManualStopRef.current = false;
            startSpeechRecognitionRef.current?.();
          }
        }, 200);
      }
      return;
    }

    setAiStatus("SPEAKING");
    aiStatusRef.current = "SPEAKING";

    if (section === "APTITUDE") {
      setAiStatus("LISTENING");
      aiStatusRef.current = "LISTENING";
      return;
    }

    window.speechSynthesis?.cancel();

    api.post("/api/interview/tts", { text, persona: section === "HR" ? "hr" : "technical" }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => null);

    const profileConfig = getVoiceProfile(section, topic);
    const utterance = new SpeechSynthesisUtterance(text);

    const vs = voiceSettingsRef.current;
    utterance.rate = vs?.rate || (section === "HR" ? 0.94 : 0.90);
    utterance.pitch = vs?.pitch || (section === "HR" ? 0.92 : 0.86);
    utterance.volume = 1.0;

    const voices = window.speechSynthesis?.getVoices() || [];
    let chosenVoice = null;

    if (vs?.persona === "custom" && vs?.voiceURI) {
      chosenVoice = voices.find((v) => v.voiceURI === vs.voiceURI || v.name === vs.voiceURI);
    } else if (vs?.persona === "sarah") {
      chosenVoice = selectOptimalVoice(voices, "HR");
    } else if (vs?.persona === "alex") {
      chosenVoice = selectOptimalVoice(voices, "TECHNICAL");
    } else {
      chosenVoice = selectOptimalVoice(voices, section);
    }

    if (chosenVoice) utterance.voice = chosenVoice;

    utterance.onstart = () => {
      setAiStatus("SPEAKING");
      aiStatusRef.current = "SPEAKING";
      stopSpeechRecognition(true);
    };

    utterance.onend = () => {
      setAiStatus("LISTENING");
      aiStatusRef.current = "LISTENING";
      ttsEndedAtRef.current = Date.now(); // Mark TTS end time for bleed guard
      speechBaseTextRef.current = typedResponseRef.current || "";
      if (inputModeRef.current === "speak" && isMicOnRef.current && !micPermissionDenied && section !== "APTITUDE" && section !== "CODING") {
        setTimeout(() => {
          if (aiStatusRef.current === "LISTENING" && isMicOnRef.current && !window.speechSynthesis?.speaking) {
            isManualStopRef.current = false;
            startSpeechRecognitionRef.current?.();
          }
        }, 600);
      }
    };

    utterance.onerror = (e) => {
      console.warn("TTS Error:", e);
      setAiStatus("LISTENING");
      aiStatusRef.current = "LISTENING";
      if (inputModeRef.current === "speak" && isMicOnRef.current && !micPermissionDenied && section !== "APTITUDE" && section !== "CODING") {
        setTimeout(() => {
          if (aiStatusRef.current === "LISTENING" && isMicOnRef.current) {
            isManualStopRef.current = false;
            startSpeechRecognitionRef.current?.();
          }
        }, 400);
      }
    };

    window.speechSynthesis?.speak(utterance);
  }, [token, micPermissionDenied, stopSpeechRecognition]);

  // ─── INTRO & QUESTION TRANSITION HANDLER ───
  useEffect(() => {
    if (isCompleted || isPaused || isLoadingInterview || isFullscreenExited) return;

    const section = currentQuestion.section || "APTITUDE";
    const speechText = currentQuestion?.aiSpeechText || currentQuestion?.question || "";

    if (currentIndex === 1 && !hasIntroducedRef.current) {
      hasIntroducedRef.current = true;
      stopSpeechRecognition(true);
      let introText = `Good day ${candidateInfo.name || "Candidate"}. I am Alex, your senior AI interviewer. I have reviewed your background and resume details. We will begin with Aptitude evaluations. Let's start with your first question.`;

      if (targetRound === "technical") {
        introText = `Good day ${candidateInfo.name || "Candidate"}. I am Alex, your senior technical interviewer. I have reviewed your resume and projects. Let's begin your Technical Round.`;
      } else if (targetRound === "resume_project") {
        introText = `Good day ${candidateInfo.name || "Candidate"}. I am Alex, your senior interviewer. I have reviewed your resume in detail. Let's discuss your projects and experience.`;
      } else if (targetRound === "coding") {
        introText = `Good day ${candidateInfo.name || "Candidate"}. I am Alex, your senior AI evaluator. Today we will conduct your Algorithmic Coding Challenge in the live compiler workspace.`;
      } else if (targetRound === "hr") {
        introText = `Good day ${candidateInfo.name || "Candidate"}. I am Sarah, your senior HR interviewer. Today we will conduct your HR and Behavioral evaluation.`;
      } else if (targetRound === "aptitude") {
        introText = `Good day ${candidateInfo.name || "Candidate"}. Today we will evaluate your Aptitude and Logical Reasoning skills. Let's begin with your first question.`;
      }

      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDialogueLogs([{ sender: "AI", text: introText, time: timeNow }]);

      setAiStatus("SPEAKING");
      aiStatusRef.current = "SPEAKING";
      window.speechSynthesis?.cancel();
      const introUtterance = new SpeechSynthesisUtterance(introText);
      const vs = voiceSettingsRef.current;
      introUtterance.rate = vs?.rate || 0.90;
      introUtterance.pitch = vs?.pitch || 0.88;

      const voices = window.speechSynthesis?.getVoices() || [];
      let chosenVoice = null;
      if (vs?.persona === "custom" && vs?.voiceURI) {
        chosenVoice = voices.find((v) => v.voiceURI === vs.voiceURI || v.name === vs.voiceURI);
      } else if (vs?.persona === "sarah") {
        chosenVoice = selectOptimalVoice(voices, "HR");
      } else if (vs?.persona === "alex") {
        chosenVoice = selectOptimalVoice(voices, "TECHNICAL");
      } else {
        chosenVoice = selectOptimalVoice(voices, section);
      }
      if (chosenVoice) introUtterance.voice = chosenVoice;

      introUtterance.onstart = () => {
        stopSpeechRecognition(true);
      };

      introUtterance.onend = () => {
        setDialogueLogs((prev) => [...prev, { sender: "AI", text: speechText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        speakCurrentQuestion(speechText, section, currentQuestion.topic);
      };

      introUtterance.onerror = () => {
        speakCurrentQuestion(speechText, section, currentQuestion.topic);
      };

      window.speechSynthesis?.speak(introUtterance);
    } else {
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDialogueLogs((prev) => [...prev, { sender: "AI", text: speechText, time: timeNow }]);
      speakCurrentQuestion(speechText, section, currentQuestion.topic);
    }

    const qId = String(currentQuestion.id || currentQuestion.questionId || `Q-${currentIndex}`);
    const existing = savedAnswers.find((ans) => String(ans.questionId) === qId || String(ans.questionId) === String(currentQuestion.id) || String(ans.questionId) === String(currentQuestion.questionId));
    if (existing && existing.answer) {
      if (section === "CODING") {
        setCurrentCode(existing.answer);
      } else {
        setTypedResponse(existing.answer);
        typedResponseRef.current = existing.answer;
      }
    } else {
      setTypedResponse("");
      typedResponseRef.current = "";
      codingCodeByLangRef.current = {};
      const starter = getStarterCode(currentQuestion, codingLanguage);
      setCurrentCode(starter);
      codingCodeByLangRef.current[codingLanguage] = starter;
    }

    setCompilerOutput(null);
    setCodingSubmissionResult(null);
  }, [currentIndex, isLoadingInterview, isGeneratingQuestion, isFullscreenExited, speakCurrentQuestion, stopSpeechRecognition]);

  // ─── SPEECH RECOGNITION (STT) ───
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicPermissionDenied(true);
      toast.error("Speech Recognition is not supported by your browser. Text mode enabled.");
      setInputMode("type");
      inputModeRef.current = "type";
      return;
    }

    if (!isMicOnRef.current || isFullscreenExitedRef.current || isCompletedRef.current) return;

    // Do NOT start recording if the AI is actively speaking!
    if (aiStatusRef.current === "SPEAKING" || window.speechSynthesis?.speaking) {
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }

    try {
      const rec = new SpeechRecognition();
      const sysLang = navigator.language || "en-US";
      rec.lang = sysLang.startsWith("en") ? sysLang : "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      isManualStopRef.current = false;
      speechBaseTextRef.current = typedResponseRef.current || "";

      rec.onstart = () => {
        setIsListeningSpeech(true);
        isListeningSpeechRef.current = true;
        setAiStatus("LISTENING");
        aiStatusRef.current = "LISTENING";
        setMicPermissionDenied(false);
      };

      rec.onresult = (event) => {
        // Acoustic Isolation: Drop audio packets if AI interviewer is speaking
        if (aiStatusRef.current === "SPEAKING" || window.speechSynthesis?.speaking) {
          return;
        }
        // Bleed guard: Discard results that arrive within 600ms of TTS ending
        // (prevents speaker audio leaking into mic from overwriting candidate's answer)
        if (Date.now() - ttsEndedAtRef.current < 600) {
          return;
        }

        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptPiece = result[0]?.transcript || "";
          currentTranscript += transcriptPiece;
        }

        if (!currentTranscript.trim()) return; // Nothing meaningful, don't update

        const base = speechBaseTextRef.current.trim();
        const fullUnformatted = (base ? base + " " : "") + currentTranscript;

        // Auto formatting: Clean extra whitespace & capitalize sentences
        const formatted = fullUnformatted
          .replace(/\s+/g, " ")
          .replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());

        setTypedResponse(formatted);
        typedResponseRef.current = formatted;

        const lower = formatted.toLowerCase();
        if (lower.includes("repeat the question") || lower.includes("say that again") || lower.includes("repeat question")) {
          speakCurrentQuestion(currentQuestion?.aiSpeechText || currentQuestion?.question, currentQuestion?.section, currentQuestion?.topic);
        }
      };

      rec.onerror = (e) => {
        console.warn("Speech Recognition notice:", e.error);
        if (e.error === "not-allowed" || e.error === "permission-denied") {
          setMicPermissionDenied(true);
          setInputMode("type");
          inputModeRef.current = "type";
          toast.error("Microphone access denied. Switched to Text fallback.");
        }
        setIsListeningSpeech(false);
        isListeningSpeechRef.current = false;
      };

      rec.onend = () => {
        setIsListeningSpeech(false);
        isListeningSpeechRef.current = false;

        // Auto-restart ONLY if NOT manually stopped, mic is explicitly ON, and candidate is in voice mode
        if (
          !isManualStopRef.current &&
          isMicOnRef.current === true &&
          aiStatusRef.current === "LISTENING" &&
          !isCompletedRef.current &&
          !isFullscreenExitedRef.current &&
          inputModeRef.current === "speak" &&
          currentSectionRef.current !== "APTITUDE" &&
          currentSectionRef.current !== "CODING"
        ) {
          speechBaseTextRef.current = typedResponseRef.current || "";
          setTimeout(() => {
            if (
              !isManualStopRef.current &&
              isMicOnRef.current === true &&
              aiStatusRef.current === "LISTENING" &&
              !isListeningSpeechRef.current
            ) {
              startSpeechRecognitionRef.current?.();
            }
          }, 80);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error("STT Startup Error:", err);
      setIsListeningSpeech(false);
      isListeningSpeechRef.current = false;
    }
  }, [currentQuestion, speakCurrentQuestion]);

  useEffect(() => {
    startSpeechRecognitionRef.current = startSpeechRecognition;
  }, [startSpeechRecognition]);

  // ─── CODING COMPILER RUN (Judge0 Hosted Runner) ───
  const handleRunCoding = async () => {
    if (!currentCode || !currentCode.trim()) {
      toast.error("Please write some code before running.");
      return;
    }
    setIsRunningCode(true);
    setCodingSubmissionResult(null);
    setOutputTab("Test Result");
    const toastId = toast.loading("Executing code via Judge0 online compiler...");
    try {
      const rawInput = customInput.trim() || currentQuestion.testCases?.[0]?.input || currentQuestion.sampleInput || "3 5";
      const effectiveInput = rawInput.replace(/\b[a-zA-Z_]\w*\s*=\s*/g, "").trim();
      const { data } = await api.post(
        "/api/code/run",
        {
          language: codingLanguage,
          code: currentCode,
          input: effectiveInput,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const isErr = data.status === "error" || data.status === "compile_error" || data.status === "runtime_error" || data.status === "time_limit";
      const normalizedRun = {
        type: isErr ? "error" : "success",
        status: data.status,
        statusDescription: data.statusDescription || (isErr ? "Error" : "Accepted"),
        output: data.output || data.stdout || data.compileOutput || data.stderr || "No output produced",
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        compileOutput: data.compileOutput || "",
        timeMs: data.timeMs || 0,
        timeSeconds: data.timeSeconds || "0.00",
        memoryKB: data.memoryKB || 0,
      };

      setCompilerOutput(normalizedRun);
      if (isErr) {
        toast.error(data.statusDescription || "Execution encountered errors", { id: toastId });
      } else {
        toast.success(`Executed in ${data.timeSeconds || "0.0"}s`, { id: toastId });
      }
    } catch (err) {
      console.error("Compiler error:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.output || "Execution failed.";
      setCompilerOutput({
        type: "error",
        status: "error",
        statusDescription: "Failed",
        output: errMsg,
        timeMs: 0,
        timeSeconds: "0.00",
        memoryKB: 0,
      });
      toast.error(errMsg, { id: toastId });
    } finally {
      setIsRunningCode(false);
    }
  };

  // ─── CODING SUBMIT (Judge0 Full Test Suite Evaluation) ───
  const handleSubmitCoding = async () => {
    if (!currentCode || !currentCode.trim()) {
      toast.error("Please write a solution before submitting.");
      return;
    }
    setIsSubmittingCode(true);
    setCompilerOutput(null);
    setOutputTab("Test Result");
    const toastId = toast.loading("Evaluating solution against all test cases...");

    try {
      const qTestCases = (currentQuestion.testCases && currentQuestion.testCases.length > 0)
        ? currentQuestion.testCases
        : [
            { input: currentQuestion.sampleInput || "3 5", expected: currentQuestion.sampleOutput || "8", isHidden: false },
            { input: "10 20", expected: "30", isHidden: false },
            { input: "100 200", expected: "300", isHidden: true },
          ];

      const { data } = await api.post(
        "/api/code/submit",
        {
          language: codingLanguage,
          code: currentCode,
          interviewId: sessionId,
          roundId: "coding",
          questionId: currentQuestion.id || currentQuestion.questionId || `Q-${currentIndex}`,
          directTestCases: qTestCases,
          questionTitle: currentQuestion.title || currentQuestion.question || "Coding Problem",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCodingSubmissionResult(data);
      handleSaveAnswer("answered", currentCode);

      if (data.status === "completed" || data.passed === data.total) {
        toast.success(`🎉 Perfect! Passed ${data.passed}/${data.total} test cases (${data.score}%)`, { id: toastId, duration: 4000 });
      } else if (data.status === "compile_error") {
        toast.error(`Compilation Error: ${data.compileOutput?.slice(0, 80) || "Build failed"}`, { id: toastId });
      } else {
        toast(`Passed ${data.passed}/${data.total} test cases (${data.score}%)`, { id: toastId, icon: "⚠️" });
      }
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(err.response?.data?.message || "Failed to evaluate submission.", { id: toastId });
    } finally {
      setIsSubmittingCode(false);
    }
  };

  // ─── NAVIGATION HANDLERS ───
  const handleNextQuestion = async () => {
    stopSpeechRecognition();
    window.speechSynthesis?.cancel();
    await handleSaveAnswer("answered");

    if (currentIndex < questions.length) {
      setIsGeneratingQuestion(true);
      setAiStatus("THINKING");

      setTimeout(() => {
        setIsGeneratingQuestion(false);
        setCurrentIndex((prev) => prev + 1);
        setTypedResponse("");
      }, 700);
    } else {
      setShowConfirmExit(true);
    }
  };

  const handlePrevQuestion = () => {
    if (currentIndex > 1) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSkipQuestion = async () => {
    stopSpeechRecognition();
    window.speechSynthesis?.cancel();
    await handleSaveAnswer("skipped");

    if (currentIndex < questions.length) {
      setIsGeneratingQuestion(true);
      setAiStatus("THINKING");

      setTimeout(() => {
        setIsGeneratingQuestion(false);
        setCurrentIndex((prev) => prev + 1);
        setTypedResponse("");
      }, 700);
    } else {
      setShowConfirmExit(true);
    }
  };

  const getCompletedStats = () => {
    const answered = sessionProgress.totalCompleted;
    const skipped = Math.max(0, sessionProgress.totalQuestions - answered);
    const secsUsed = totalSeconds - timerSeconds;
    const mins = Math.floor(secsUsed / 60).toString().padStart(2, "0");
    const secs = (secsUsed % 60).toString().padStart(2, "0");
    return {
      answeredCount: answered,
      skippedCount: skipped,
      timeTaken: `${mins}:${secs}`
    };
  };

  const sectionQuestions = questions.filter((q) => q.section === currentSection);
  const sectionTotal = sectionQuestions.length || 1;
  const questionIdxInSection = sectionQuestions.findIndex((q) => (q.id || q.questionId) === (currentQuestion.id || currentQuestion.questionId)) + 1;
  const formattedSectionQuestionIndex = questionIdxInSection > 0 ? String(questionIdxInSection).padStart(2, "0") : "01";

  // ─── Render mode helpers (master spec: 3-zone layout) ───
  const showAI = currentSection === "TECHNICAL" || currentSection === "HR" || currentSection === "RESUME_PROJECT";
  const isCoding = currentSection === "CODING" || currentQuestion.type === "coding";
  const isAptitude = currentSection === "APTITUDE" || (currentQuestion.options && currentQuestion.options.length > 0 && !isCoding);
  const tH = String(Math.floor(timerSeconds / 3600)).padStart(2, "0");
  const tM = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0");
  const tS = String(timerSeconds % 60).padStart(2, "0");

  // CENTER WORKSPACE: Unified across all 5 rounds (Aptitude, Resume, Tech, Coding, HR)
  const centerWorkspace = (
    <div className="flex flex-col h-full min-h-0 gap-2.5 overflow-hidden">
      {/* ─── Compact AI Avatar Banner (Resume / Project, Technical, HR) ─── */}
      {showAI && (
        <div className="shrink-0 h-[80px] sm:h-[84px] rounded-2xl overflow-hidden border border-white/10">
          <AIInterviewerCard
            aiStatus={aiStatus}
            isGeneratingQuestion={isGeneratingQuestion}
            section={voiceSettings.persona === "sarah" ? "HR" : voiceSettings.persona === "alex" ? "TECHNICAL" : currentSection}
          />
        </div>
      )}

      {sessionError && questions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/30 text-center space-y-3 max-w-lg w-full">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-base font-bold text-red-200">AI Question Generation Failed</h3>
            <p className="text-xs text-red-300/80 leading-relaxed font-mono whitespace-pre-line">
              {sessionError}
            </p>
            <p className="text-[11px] text-white/50">
              Provider: Groq. Please try again. If this persists, contact your administrator.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white text-xs font-bold cursor-pointer transition shadow-md shadow-[#FF6B35]/20"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : isAptitude ? (
        /* ═══════════════════════════════════════════
           CENTER APTITUDE AREA (PREVIOUS APPROVED DESIGN)
        ═══════════════════════════════════════════ */
        <div
          className="flex-1 min-h-0 flex flex-col justify-between p-5 sm:p-6 rounded-2xl space-y-4 overflow-y-auto select-none"
          style={{
            background: "rgba(12, 15, 26, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(12px)",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.1) transparent"
          }}
        >
          {/* Top Section Header */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-xs sm:text-sm font-black tracking-wider text-[#FF6B35] uppercase flex items-center gap-1.5">
                {currentSection} — QUESTION {formattedSectionQuestionIndex} / {String(sectionTotal).padStart(2, "0")}
              </span>
              <span className="text-xs font-bold text-white/40 font-mono">
                Overall: {String(sessionProgress.totalCompleted).padStart(2, "0")} / {String(sessionProgress.totalQuestions).padStart(2, "0")}
              </span>
            </div>

            {/* Question Text Box with Topic & Difficulty Badges */}
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-end gap-2 flex-wrap">
                {(currentQuestion?.topic || currentQuestion?.category) && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/[0.06] border border-white/10 text-white/80">
                    {currentQuestion?.topic || currentQuestion?.category}
                  </span>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    (currentQuestion?.difficulty || "Easy").toLowerCase() === "hard"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : (currentQuestion?.difficulty || "Easy").toLowerCase() === "medium"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {currentQuestion?.difficulty || "Easy"}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-relaxed">
                {currentQuestion?.question || currentQuestion?.aiSpeechText || currentQuestion?.title || ""}
              </h2>
            </div>
          </div>

          {/* Answer Options Grid (Compact 2x2 cards, exact approved layout) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 my-auto py-2">
            {(currentQuestion.options || []).map((opt, idx) => {
              const optText = typeof opt === "object" && opt !== null ? (opt.text || opt.optionText || opt.value || "") : String(opt || "");
              const optLabel = typeof opt === "object" && opt !== null && opt.label ? opt.label : String.fromCharCode(65 + idx);
              const optFormatted = `Option ${optLabel}: ${optText}`;
              const isSelected =
                typedResponse === optText ||
                typedResponse === optLabel ||
                typedResponse === optFormatted ||
                typedResponse === opt ||
                (savedAnswers && savedAnswers.some((a) => (String(a.questionId) === String(currentQuestion.id || currentQuestion.questionId)) && (a.answer === optFormatted || a.answer === optText || a.answer === optLabel || a.answer === opt)));

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTypedResponse(optFormatted);
                    handleSaveAnswer("answered", optFormatted);
                  }}
                  className={`rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 transition-all duration-200 cursor-pointer text-left border ${
                    isSelected
                      ? "bg-[#FF6B35]/[0.06] border-2 border-[#FF6B35] shadow-[0_0_20px_rgba(255,107,53,0.15)]"
                      : "bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/20"
                  }`}
                >
                  <span
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 border transition-colors ${
                      isSelected
                        ? "bg-[#FF6B35]/20 border-[#FF6B35] text-[#FF6B35]"
                        : "bg-white/[0.06] border-white/10 text-white/80"
                    }`}
                  >
                    {optLabel}
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-white/95 leading-snug">
                    {optText}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom Action Area: Listen Again + Progress + Prev/Skip/Next */}
          <div className="pt-2 space-y-3">
            {/* Listen Again full-width banner */}
            <button
              type="button"
              onClick={() => speakCurrentQuestion(currentQuestion?.aiSpeechText || currentQuestion?.question, currentQuestion?.section, currentQuestion?.topic)}
              disabled={isPaused || !isSpeakerOn}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 hover:bg-[#FF6B35]/10 text-[#FF6B35] font-bold text-xs sm:text-sm cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Volume2 className="w-4 h-4 text-[#FF6B35]" />
              <span>Listen Again</span>
            </button>

            {/* Progress Label & Buttons Row */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                  PROGRESS
                </span>
                <span className="text-xs font-bold font-mono text-white/80">
                  {String(sessionProgress.totalCompleted).padStart(2, "0")} <span className="text-white/30">/ {String(sessionProgress.totalQuestions).padStart(2, "0")}</span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={handlePrevQuestion}
                  disabled={currentIndex <= 1 || isPaused}
                  className="py-2.5 sm:py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ‹ Prev
                </button>

                <button
                  type="button"
                  onClick={handleSkipQuestion}
                  disabled={isPaused}
                  className="py-2.5 sm:py-3 rounded-xl bg-white/[0.04] border border-white/10 text-[#FF6B35] hover:bg-white/[0.08] font-bold text-xs sm:text-sm flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-30"
                >
                  ▷| Skip
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={isPaused}
                  className="py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1 shadow-lg shadow-[#FF6B35]/25 cursor-pointer transition disabled:opacity-30"
                >
                  <span>{currentIndex === questions.length ? "Submit" : "Next"}</span>
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ─── NON-APTITUDE WORKSPACE (Resume / Technical / Coding / HR) ─── */
        <div
          className="flex-1 min-h-0 flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-white/10 overflow-hidden select-none"
          style={{
            background: "rgba(12, 15, 26, 0.95)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Top Question Header & Single-Location Question Text */}
          <div className="shrink-0 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs sm:text-sm font-black tracking-wider text-[#FF6B35] uppercase flex items-center gap-1.5">
                {currentSection} — QUESTION {formattedSectionQuestionIndex} / {String(sectionTotal).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-2">
                {(currentQuestion?.topic || currentQuestion?.category) && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.06] border border-white/10 text-white/80">
                    {currentQuestion?.topic || currentQuestion?.category}
                  </span>
                )}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    (currentQuestion?.difficulty || "Easy").toLowerCase() === "hard"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : (currentQuestion?.difficulty || "Easy").toLowerCase() === "medium"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {currentQuestion?.difficulty || "Easy"}
                </span>
                <span className="text-xs font-bold text-white/40 font-mono ml-1">
                  Overall: {String(sessionProgress.totalCompleted).padStart(2, "0")} / {String(sessionProgress.totalQuestions).padStart(2, "0")}
                </span>
              </div>
            </div>

            {/* Single Question Statement (Non-Coding) */}
            {!isCoding && (
              <div className="max-h-[85px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-white leading-snug">
                  {currentQuestion?.question || currentQuestion?.aiSpeechText || currentQuestion?.title || ""}
                </h2>
              </div>
            )}
          </div>

          {/* Center Content: Round-Specific Body */}
          <div className="flex-1 min-h-0 py-2 overflow-hidden flex flex-col">
            {isAptitude ? (
              /* ── 1. APTITUDE: 2x2 Clean Option Grid ── */
              <div
                className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
              >
                {(currentQuestion.options || []).map((opt, idx) => {
                  const optText = typeof opt === "object" && opt !== null ? (opt.text || opt.optionText || opt.value || "") : String(opt || "");
                  const optLabel = typeof opt === "object" && opt !== null && opt.label ? opt.label : String.fromCharCode(65 + idx);
                  const optFormatted = `Option ${optLabel}: ${optText}`;
                  const isSelected =
                    typedResponse === optText ||
                    typedResponse === optLabel ||
                    typedResponse === optFormatted ||
                    typedResponse === opt ||
                    (savedAnswers && savedAnswers.some((a) => (String(a.questionId) === String(currentQuestion.id || currentQuestion.questionId)) && (a.answer === optFormatted || a.answer === optText || a.answer === optLabel || a.answer === opt)));

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTypedResponse(optFormatted);
                        handleSaveAnswer("answered", optFormatted);
                      }}
                      className={`p-3 sm:p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-center gap-3 group relative ${
                        isSelected
                          ? "bg-[#FF6B35]/15 border-[#FF6B35] shadow-md shadow-[#FF6B35]/20"
                          : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                          isSelected
                            ? "bg-[#FF6B35] text-white"
                            : "bg-white/10 text-white/70 group-hover:bg-white/20 group-hover:text-white"
                        }`}
                      >
                        {optLabel}
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-white/90 leading-snug break-words">
                        {optText}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : isCoding ? (
              /* ── 2. CODING: Problem Statement + Monaco Sandbox + Output Terminal ── */
              <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {/* Left: Problem Statement & Specs */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 space-y-2 max-h-56 overflow-y-auto text-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                        {currentQuestion.title || "Coding Problem"}
                      </h3>
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        {currentQuestion.difficulty || "Medium"}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/80 leading-relaxed whitespace-pre-line">
                      {currentQuestion.problemStatement || currentQuestion.description || currentQuestion.question}
                    </p>
                    {currentQuestion.sampleInput && (
                      <div className="text-[10.5px] text-white/70 bg-white/5 p-2 rounded-lg border border-white/5 font-mono">
                        <div><span className="text-white/40">Input: </span>{currentQuestion.sampleInput}</div>
                        <div><span className="text-white/40">Output: </span>{currentQuestion.sampleOutput}</div>
                      </div>
                    )}
                  </div>

                  {/* Right: Monaco Editor */}
                  <div className="flex flex-col rounded-xl bg-slate-950/60 border border-white/10 overflow-hidden">
                    <div className="flex items-center justify-between p-2 border-b border-white/10 bg-slate-950/80">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Judge0 Sandbox
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={codingLanguage}
                          onChange={(e) => {
                            const newLang = e.target.value;
                            codingCodeByLangRef.current[codingLanguage] = currentCode;
                            setCodingLanguage(newLang);
                            const saved = codingCodeByLangRef.current[newLang];
                            if (saved && saved.trim() !== "") {
                              setCurrentCode(saved);
                            } else {
                              const newStarter = getStarterCode(currentQuestion, newLang);
                              setCurrentCode(newStarter);
                              codingCodeByLangRef.current[newLang] = newStarter;
                            }
                          }}
                          className="bg-slate-800 border border-white/10 text-[11px] text-white rounded-lg px-2 py-0.5 outline-none cursor-pointer"
                        >
                          <option value="python">Python (3.8.1)</option>
                          <option value="cpp">C++ (GCC 9.2.0)</option>
                          <option value="java">Java (OpenJDK 13)</option>
                          <option value="javascript">JavaScript (Node 12)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const resetCode = getStarterCode(currentQuestion, codingLanguage);
                            setCurrentCode(resetCode);
                            codingCodeByLangRef.current[codingLanguage] = resetCode;
                          }}
                          className="text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="h-44">
                      <MonacoCodeEditor
                        value={currentCode}
                        onChange={(val) => setCurrentCode(val || "")}
                        language={codingLanguage}
                        theme="dark"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Input & Run/Submit */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/60 uppercase">Custom Input (Stdin)</span>
                  </div>
                  <textarea
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder={(currentQuestion.testCases?.[0]?.input || currentQuestion.sampleInput || "3 5").replace(/\b[a-zA-Z_]\w*\s*=\s*/g, "").trim()}
                    rows={1}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg p-1.5 text-xs font-mono text-white placeholder:text-white/30 outline-none focus:border-[#FF6B35]/50 resize-none"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRunCoding}
                        disabled={isRunningCode || isSubmittingCode}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        style={{ background: "#059669" }}
                      >
                        {isRunningCode ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Run Code
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitCoding}
                        disabled={isRunningCode || isSubmittingCode}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #FF6B35, #FF8A3D)" }}
                      >
                        {isSubmittingCode ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Submit Solution
                      </button>
                    </div>
                    {codingSubmissionResult && (
                      <span className={`font-bold px-2 py-0.5 rounded text-xs border ${codingSubmissionResult.score === 100 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                        {codingSubmissionResult.passed}/{codingSubmissionResult.total} ({codingSubmissionResult.score}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Compiler Output */}
                <div className="rounded-xl overflow-hidden border border-white/10">
                  <OutputPanel
                    activeTab={outputTab}
                    setActiveTab={setOutputTab}
                    data={{
                      run: compilerOutput,
                      submit: codingSubmissionResult ? {
                        status: codingSubmissionResult.status === "completed" ? "accepted" : codingSubmissionResult.status,
                        passedCount: codingSubmissionResult.passed,
                        totalCount: codingSubmissionResult.total,
                        results: codingSubmissionResult.test_results,
                        compileOutput: codingSubmissionResult.compileOutput,
                        timeMs: Math.round(parseFloat(codingSubmissionResult.execution_time || "0") * 1000),
                      } : null,
                    }}
                    testCases={
                      (currentQuestion.testCases && currentQuestion.testCases.length > 0)
                        ? currentQuestion.testCases
                        : (currentQuestion.sampleInput || currentQuestion.sampleOutput)
                          ? [{ input: currentQuestion.sampleInput || "3 5", expected: currentQuestion.sampleOutput || "8", isHidden: false }]
                          : []
                    }
                    running={isRunningCode}
                    submitting={isSubmittingCode}
                  />
                </div>
              </div>
            ) : (
              /* ── 3. VOICE / TEXT RESPONSE: Resume / Technical / HR ── */
              <div className="flex-1 min-h-0 flex flex-col gap-2 justify-between">
                {/* Mode Selector & Mic Live Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-white/5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInputMode("speak");
                        inputModeRef.current = "speak";
                        if (isMicOn && !isListeningSpeech) {
                          startSpeechRecognition();
                        }
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                        inputMode === "speak"
                          ? "bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] text-white shadow-md shadow-[#FF6B35]/20"
                          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Voice Response</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopSpeechRecognition(true);
                        setInputMode("type");
                        inputModeRef.current = "type";
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                        inputMode === "type"
                          ? "bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] text-white shadow-md shadow-[#FF6B35]/20"
                          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>Type Text</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {inputMode === "speak" ? (
                      !isMicOn ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                          <MicOff className="w-3 h-3" /> Mic Muted
                        </span>
                      ) : isListeningSpeech ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Live Recording
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/20 flex items-center gap-1">
                          <Radio className="w-3 h-3 text-[#FF6B35]" />
                          Mic Ready
                        </span>
                      )
                    ) : (
                      <span className="text-[10.5px] font-bold text-white/40">Keyboard Mode</span>
                    )}
                    <span className="text-[10px] font-mono text-white/30">{typedResponse.length} chars</span>
                  </div>
                </div>

                {/* Textarea / Live speech transcript */}
                <div className="flex-1 min-h-[75px] max-h-[140px] relative">
                  <textarea
                    value={typedResponse}
                    onChange={(e) => {
                      setTypedResponse(e.target.value);
                      typedResponseRef.current = e.target.value;
                    }}
                    placeholder={
                      inputMode === "speak"
                        ? currentSection === "HR"
                          ? "Speak your response aloud... Your words will transcribe here in real-time."
                          : "Speak your response aloud... Real-time transcription active."
                        : "Type your detailed answer here..."
                    }
                    className="w-full h-full bg-slate-950/60 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white placeholder:text-white/30 resize-none outline-none focus:border-[#FF6B35]/50 transition leading-relaxed font-sans"
                    style={{ scrollbarWidth: "thin" }}
                  />
                </div>

                {/* Speech Action Bar: Clear & Re-speak, Mic controls, Save answer */}
                <div className="flex items-center justify-between gap-2 shrink-0 pt-1">
                  <div className="flex items-center gap-2">
                    {typedResponse.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTypedResponse("");
                          typedResponseRef.current = "";
                          speechBaseTextRef.current = "";
                          if (inputMode === "speak" && isMicOn && !isListeningSpeech) {
                            startSpeechRecognition();
                          }
                          toast("Answer cleared. Ready to re-speak.", { duration: 1500 });
                        }}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/10 border border-white/10 flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <RotateCcw className="w-3 h-3" /> Clear
                      </button>
                    )}
                    {inputMode === "speak" && (
                      isListeningSpeech ? (
                        <button
                          type="button"
                          onClick={() => {
                            stopSpeechRecognition(true);
                            toast("Microphone paused", { id: "mic-toggle-status", duration: 1500, icon: "⏸️" });
                          }}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <MicOff className="w-3 h-3" /> Pause Mic
                        </button>
                      ) : isMicOn ? (
                        <button
                          type="button"
                          onClick={() => {
                            startSpeechRecognition();
                            toast.success("Microphone listening", { id: "mic-toggle-status", duration: 1500, icon: "🎙️" });
                          }}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Mic className="w-3 h-3" /> Start Mic
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleToggleMic}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Mic className="w-3 h-3" /> Unmute Mic
                        </button>
                      )
                    )}
                  </div>

                  {typedResponse.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSaveAnswer("answered")}
                      className="px-3.5 py-1 rounded-xl text-xs font-bold bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-[#FF6B35]/25"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Save Answer
                    </button>
                  )}
                </div>

                {/* Collapsible View Conversation */}
                <div className="shrink-0 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTranscript((v) => !v)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/60 cursor-pointer hover:bg-white/10 transition-all"
                  >
                    <span>View Conversation History</span>
                    <span className="text-[9.5px] font-extrabold text-[#FF6B35]">{showTranscript ? "Hide" : "Show"}</span>
                  </button>
                  {showTranscript && (
                    <div className="mt-1.5 max-h-28 overflow-y-auto">
                      <ConversationPanel logs={dialogueLogs} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─── Bottom Anchored Action Bar: Listen Again + Progress + Prev/Skip/Next ─── */}
          <div className="shrink-0 pt-2 border-t border-white/10 space-y-2">
            {/* Listen Again banner */}
            <button
              type="button"
              onClick={() => speakCurrentQuestion(currentQuestion?.aiSpeechText || currentQuestion?.question, currentQuestion?.section, currentQuestion?.topic)}
              disabled={isPaused || !isSpeakerOn}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 hover:bg-[#FF6B35]/10 text-[#FF6B35] font-bold text-xs cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#FF6B35]" />
              <span>Listen Again</span>
            </button>

            {/* Progress indicator + Prev / Skip / Next buttons */}
            <div className="flex items-center justify-between gap-3">
              <div className="hidden sm:flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-white/50">
                <span className="font-bold text-white/40 uppercase text-[9px] tracking-wider">PROGRESS</span>
                <span className="font-bold text-white">{String(sessionProgress.totalCompleted).padStart(2, "0")}</span>
                <span>/</span>
                <span>{String(sessionProgress.totalQuestions).padStart(2, "0")}</span>
              </div>

              <div className="flex-1 grid grid-cols-3 gap-2 sm:max-w-md sm:ml-auto">
                <button
                  type="button"
                  onClick={handlePrevQuestion}
                  disabled={currentIndex <= 1 || isPaused}
                  className="py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 hover:text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>

                <button
                  type="button"
                  onClick={handleSkipQuestion}
                  disabled={isPaused}
                  className="py-2 rounded-xl bg-white/[0.04] border border-white/10 text-[#FF6B35] hover:bg-white/[0.08] font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-30"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Skip
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={isPaused}
                  className="py-2 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md shadow-[#FF6B35]/25 cursor-pointer transition disabled:opacity-30"
                >
                  <span>{currentIndex === questions.length ? "Submit" : "Next"}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // RIGHT CONTEXT: Camera + Session Status + Live Signals + AI State
  const rightContext = (
    <div
      className="flex flex-col h-full min-h-0 gap-2.5 overflow-hidden select-none"
    >
      {/* Webcam Card */}
      <div className="h-[135px] shrink-0 rounded-2xl overflow-hidden border border-white/10">
        <WebcamCard
          isCameraOn={isCameraOn}
          stream={webcamStream}
          userName={candidateInfo.name}
          onRetryCamera={startWebcam}
        />
      </div>

      {/* SESSION & CURRENT ROUND STATUS */}
      <div
        className="p-3 rounded-2xl space-y-2 shrink-0"
        style={{
          background: "rgba(12, 15, 26, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <p className="text-[9.5px] font-black uppercase tracking-widest text-white/40">Session Control</p>
        
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center pb-1 border-b border-white/5">
            <span className="text-white/50 text-[10.5px]">Time Remaining</span>
            <span
              className="font-mono font-black text-xs"
              style={{ color: timerSeconds < 300 ? "#ef4444" : "#FF6B35" }}
            >
              {tH}:{tM}:{tS}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/50 text-[10.5px]">Current Round</span>
            <span className="font-black text-[#FF6B35] text-[11px] tracking-wider uppercase">{currentSection}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/50 text-[10.5px]">Round Progress</span>
            <span className="font-bold font-mono text-white text-[11px]">{formattedSectionQuestionIndex} / {String(sectionTotal).padStart(2, "0")}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/50 text-[10.5px]">Overall Progress</span>
            <span className="font-bold font-mono text-white text-[11px]">{String(sessionProgress.totalCompleted).padStart(2, "0")} / {String(sessionProgress.totalQuestions).padStart(2, "0")}</span>
          </div>
        </div>
      </div>

      {/* LIVE SIGNALS */}
      <div
        className="p-3 rounded-2xl space-y-2 shrink-0"
        style={{
          background: "rgba(12, 15, 26, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <p className="text-[9.5px] font-black uppercase tracking-widest text-white/40">Live Signals</p>
        <div className="space-y-1 text-xs">
          <SignalRow label="MIC" on={isMicOn} />
          <SignalRow label="CAMERA" on={isCameraOn} />
          <SignalRow label="CONNECTION" on={true} />
        </div>
      </div>

      {/* AI STATE ENGINE */}
      <div
        className="p-3 rounded-2xl space-y-1.5 shrink-0"
        style={{
          background: "rgba(12, 15, 26, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <p className="text-[9.5px] font-black uppercase tracking-widest text-white/40">AI Engine State</p>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10">
          <span
            className="w-2 h-2 rounded-full animate-pulse shrink-0"
            style={{
              backgroundColor:
                aiStatus === "SPEAKING" ? "#10b981" :
                aiStatus === "THINKING" ? "#f59e0b" :
                aiStatus === "LISTENING" ? "#FF6B35" : "#FF6B35",
              boxShadow:
                aiStatus === "SPEAKING" ? "0 0 8px #10b981" :
                aiStatus === "THINKING" ? "0 0 8px #f59e0b" :
                "0 0 8px rgba(255,107,53,0.8)"
            }}
          />
          <span className="text-[11px] font-black uppercase tracking-wider text-white">
            {aiStatus}
          </span>
        </div>
      </div>
    </div>
  );

  if (isEvaluating) {
    const currentSessionId = sessionIdRef.current || sessionId;
    return (
      <EvaluationLoadingScreen
        sessionId={currentSessionId}
        isIndividualTechnical={isIndividualTechnical}
        isIndividualProject={isIndividualProject}
        onCompleted={(resultDoc) => {
          setFinalResultDoc(resultDoc);
          setIsEvaluating(false);
          if (isIndividualProject) {
            navigate(`/student/individual-project/result/${currentSessionId}`);
          } else if (isIndividualTechnical) {
            navigate(`/individual-practice/technical/result/${currentSessionId}`);
          } else {
            setIsCompleted(true);
          }
        }}
      />
    );
  }

  if (isCompleted) {
    const activeSessionId = sessionIdRef.current || sessionId;
    console.log(`[RESULT-FLOW] completed sessionId=${activeSessionId}`);
    console.log(`[REAL-INTERVIEW] sessionId=${activeSessionId} isCompleted=true isSubmitted=true currentQuestionIndex=${currentIndex}`);
    console.log(`[REAL-INTERVIEW] showing component=COMPLETION`);
    const stats = getCompletedStats();
    return (
      <CompletionScreen
        interviewId={activeSessionId}
        candidateName={candidateInfo.name}
        answeredCount={stats.answeredCount}
        skippedCount={stats.skippedCount}
        timeTakenText={stats.timeTaken}
        questions={questions}
        savedAnswers={savedAnswers}
        initialResultData={finalResultDoc}
        onReturnDashboard={() => {

          stopWebcam();
          stopSpeechRecognition();
          window.speechSynthesis?.cancel();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => null);
          }
          if (window.opener && !window.opener.closed) {
            try { window.opener.focus(); } catch (e) {}
          }
          try {
            window.close();
          } catch (e) {}
          // Fallback navigation if window.close is blocked by browser policy
          setTimeout(() => {
            navigate(
              isIndividualProject
                ? `/student/individual-project/result/${activeSessionId}`
                : isIndividualTechnical
                ? `/individual-practice/technical/result/${activeSessionId}`
                : "/results"
            );
          }, 150);
        }}
        onRestartInterview={() => {
          setTimerSeconds(totalSeconds);
          setCurrentIndex(1);
          setSavedAnswers([]);
          setDialogueLogs([]);
          setTypedResponse("");
          hasIntroducedRef.current = false;
          setIsCompleted(false);
        }}
      />
    );
  }

  if (isLoadingInterview) {
    if (!sessionId) {
      console.log(`[REAL-INTERVIEW] showing component=INITIALIZING_SESSION`);
      return (
        <div className="min-h-screen text-white flex flex-col items-center justify-center p-6 select-none font-sans" style={{ background: "#050609" }}>
          <div className="text-center space-y-4 max-w-md">
            <div className="flex items-center justify-center gap-2 mb-2">
              <img
                src="/images/metadata.png"
                alt="PrepHire Logo"
                className="h-9 w-9 object-contain shrink-0"
                draggable="false"
              />
              <span className="text-xl font-black tracking-tight">
                <span className="text-white">Prep</span>
                <span style={{ color: "#FF6B35" }}>Hire</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#FF6B35]/10 border border-[#FF6B35]/25 text-[#FF6B35] flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5 text-[#FF6B35] animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Initializing Interview Room...
            </h2>
            <p className="text-xs text-white/50">
              Setting up your secure AI interview environment and session.
            </p>
          </div>
        </div>
      );
    }

    console.log(`[REAL-INTERVIEW] showing component=PREPARATION`);
    return (
      <RealInterviewPreparationScreen
        sessionId={sessionId}
        candidateProfile={memoizedCandidateProfile}
        token={token}
        isIndividualTechnical={isIndividualTechnical}
        isIndividualProject={isIndividualProject}
        onPreparationSuccess={async () => {
          console.log(`[REAL-INTERVIEW] preparation success sessionId=${sessionId}`);
          await fetchSessionData();
          setIsCompleted(false);
          setIsLoadingInterview(false);
        }}
        onReturnToPlatform={() => {
          if (window.opener && !window.opener.closed) {
            try { window.opener.focus(); } catch (e) {}
          }
          try { window.close(); } catch (e) {}
          navigate("/dashboard");
        }}
        onPracticeMock={() => navigate("/interview-practice")}
      />
    );
  }

  console.log(`[REAL-INTERVIEW] sessionId=${sessionId} isCompleted=false isSubmitted=false currentQuestionIndex=${currentIndex}`);
  console.log(`[REAL-INTERVIEW] showing component=ACTIVE_INTERVIEW`);

  return (
    <div className="relative bg-slate-950 min-h-screen text-white select-none">

      {/* Phase 2E Fullscreen Exit Blocking Overlay */}
      <FullscreenExitOverlay
        isOpen={isFullscreenExited}
        onReenterFullscreen={handleReenterFullscreen}
      />

      {/* Fullscreen Required Gate — shown if the browser blocked the automatic
          fullscreen request at the start of the interview. */}
      <FullscreenExitOverlay
        isOpen={showFullscreenGate}
        mode="required"
        onReenterFullscreen={handleReenterFullscreen}
      />

      {/* Mic Permission Banner Fallback */}
      {micPermissionDenied && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-xs font-semibold text-amber-300 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Microphone access is unavailable. Text fallback mode enabled so you can continue your interview seamlessly.</span>
          </div>
          <button
            onClick={() => setInputMode("type")}
            className="px-3 py-1 bg-amber-500/30 hover:bg-amber-500/40 rounded-lg text-[11px] font-bold text-white cursor-pointer"
          >
            Use Text Editor
          </button>
        </div>
      )}

      <InterviewLayout
        isPaused={isPaused}
        onResume={() => setIsPaused(false)}

        headerProps={{
          timerSeconds,
          totalSeconds,
          interviewType: isIndividualTechnical ? "Technical Practice" : (candidateInfo.interviewType || "Real AI Interview Room"),
          networkLevel: 4,
        }}

        controlProps={{
          isMicOn,
          isCameraOn,
          isSpeakerOn,
          isListening: isListeningSpeech,
          onToggleMic: handleToggleMic,
          onToggleCamera: handleToggleCamera,
          onToggleSpeaker: handleToggleSpeaker,
          onPushToTalk: () => {
            if (!isMicOn) return toast.error("Unmute mic first");
            setInputMode("speak");
            startSpeechRecognition();
          },
          onEndInterview: () => setShowConfirmExit(true),
          onSettings: () => setShowSettingsModal(true),
        }}

        /* FAR LEFT: Persistent Section Navigation Panel */
        sectionPanel={
          <SectionNavigationPanel
            activeSection={currentSection}
            targetRound={targetRound}
            onSelectSection={handleSelectSection}
            sectionProgress={sessionProgress}
          />
        }

        /* CENTER: AI workspace + question / voice / transcript / controls */
        leftPanel={centerWorkspace}

        centerPanel={null}

        /* RIGHT: Live Interview Context (camera + status + signals) */
        rightPanel={isCoding ? null : rightContext}
      />

      <ConfirmExitDialog
        isOpen={showConfirmExit}
        open={showConfirmExit}
        onClose={() => setShowConfirmExit(false)}
        onConfirm={async () => {
          setShowConfirmExit(false);
          await handleFinalSubmitInterview();
        }}
      />


      <InterviewSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        voiceSettings={voiceSettings}
        onSaveVoiceSettings={handleSaveVoiceSettings}
        currentSection={currentSection}
      />
    </div>
  );
}

export default StartInterview;
