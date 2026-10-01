import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Bot, Sparkles, Mic, MicOff, CheckCircle2, Keyboard, Loader2, Play, Code2, AlertTriangle, UserCheck, Target, BrainCircuit, FileText, Maximize2, RotateCcw, Radio, Send, Volume2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, SkipForward, Terminal } from "lucide-react";

import api from "../../utils/api";
import { getAuthToken, useStudentProfile } from "../../hooks/useStudentProfile";
import { useTextToSpeech } from "../../hooks/useTextToSpeech";
import { getVoiceProfile, selectOptimalVoice } from "../../config/voiceProfiles";

const ROUND_TABS = [
  { id: "APTITUDE", name: "Aptitude", icon: Target, defaultTotal: 15 },
  { id: "RESUME_PROJECT", name: "Resume / Project", icon: FileText, defaultTotal: 5 },
  { id: "TECHNICAL", name: "Technical", icon: BrainCircuit, defaultTotal: 20 },
  { id: "CODING", name: "Coding", icon: Code2, defaultTotal: 3 },
  { id: "HR", name: "HR", icon: UserCheck, defaultTotal: 5 },
];

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
import InterviewAnswerInput from "../../components/interview/InterviewAnswerInput";

// Import Monaco editor & Output panel for Coding questions
import MonacoCodeEditor from "../../components/coding/MonacoCodeEditor";
import OutputPanel from "../../components/coding/OutputPanel";
import { getStarterCode } from "../../utils/coding/starterGenerator";
import formatSpeechTranscript from "../../utils/interview/transcriptFormatter";
import DeviceCheckModal from "../../components/interview/DeviceCheckModal";
import PersonDetector from "../../utils/proctor/personDetector";



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

  // Coding Round IDE layout state (horizontal split + collapse)
  const [codingLeftWidthPercent, setCodingLeftWidthPercent] = useState(40);
  const [isProblemCollapsed, setIsProblemCollapsed] = useState(false);
  const [isCustomInputOpen, setIsCustomInputOpen] = useState(true);
  const [isDraggingH, setIsDraggingH] = useState(false);
  const hDragStartRef = useRef({ startX: 0, startPercent: 40 });
  const splitWorkspaceRef = useRef(null);

  const handleHResizeStart = useCallback((e) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    hDragStartRef.current = { startX: e.clientX, startPercent: codingLeftWidthPercent };
    setIsDraggingH(true);
  }, [codingLeftWidthPercent]);

  const handleHResizeMove = useCallback((e) => {
    if (!isDraggingH || !splitWorkspaceRef.current) return;
    const rect = splitWorkspaceRef.current.getBoundingClientRect();
    if (!rect.width) return;
    const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(20, Math.min(75, newPercent));
    setCodingLeftWidthPercent(clamped);
  }, [isDraggingH]);

  const handleHResizeEnd = useCallback((e) => {
    if (!isDraggingH) return;
    setIsDraggingH(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, [isDraggingH]);

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
    totalTimeMinutes: 120,
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
  const [isDeviceCheckPassed, setIsDeviceCheckPassed] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const isMicOnRef = useRef(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const isSpeakerOnRef = useRef(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  // Proctoring & Person Detection State (0, 1, 2+) — default to CHECKING on startup
  const [personCount, setPersonCount] = useState(0);
  const [personStatus, setPersonStatus] = useState("CHECKING");
  const personDetectorRef = useRef(null);
  const lastIntegrityAlertRef = useRef({});
  const videoElementRef = useRef(null);

  // Webcam stream
  const [webcamStream, setWebcamStream] = useState(null);
  const webcamStreamRef = useRef(null);

  // Session timer (ONE continuous active-time timer across all rounds: 2 hours = 120 min for Real Interview)
  const [interviewDurationMin, setInterviewDurationMin] = useState(120);
  const totalSeconds = interviewDurationMin * 60;
  const [timerSeconds, setTimerSeconds] = useState(totalSeconds);

  // Shared Answer Input & Speech Recognition Ref
  const answerInputRef = useRef(null);
  const [isListeningVoice, setIsListeningVoice] = useState(false);

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

  // Synchronized state refs for callbacks (decoupling callbacks from question progression re-renders)
  const aiStatusRef = useRef("SPEAKING");
  const inputModeRef = useRef("speak");
  const typedResponseRef = useRef("");
  const isCompletedRef = useRef(false);
  const isFullscreenExitedRef = useRef(false);
  const currentSectionRef = useRef("APTITUDE");
  const currentIndexRef = useRef(currentIndex);
  const currentQuestion = questions[currentIndex - 1] || {};
  const currentQuestionRef = useRef(currentQuestion);
  const currentSection = currentQuestion.section || "APTITUDE";

  // Track when TTS last finished — used to discard mic bleed within 600ms of AI speech ending
  const ttsEndedAtRef = useRef(0);

  // TTS Hook
  const { speak: ttsSpeak, stop: ttsStop } = useTextToSpeech();

  // Keep refs in sync
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { aiStatusRef.current = aiStatus; }, [aiStatus]);
  useEffect(() => { inputModeRef.current = inputMode; }, [inputMode]);
  useEffect(() => { typedResponseRef.current = typedResponse; }, [typedResponse]);
  useEffect(() => { isCompletedRef.current = isCompleted; }, [isCompleted]);
  useEffect(() => { isFullscreenExitedRef.current = isFullscreenExited; }, [isFullscreenExited]);
  useEffect(() => { currentSectionRef.current = currentSection; }, [currentSection]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);

  // ─── PHASE 2E: LOG INTEGRITY EVENT TO BACKEND ───
  const logIntegrityEvent = useCallback(async (eventType, details = "") => {
    const currentSessionId = sessionIdRef.current || sessionId;
    if (!currentSessionId) return;
    const q = currentQuestionRef.current || {};
    const qId = q.id || q.questionId || "";
    const qIdx = currentIndexRef.current || 1;
    const sec = currentSectionRef.current || "APTITUDE";
    try {
      const activeToken = token || getAuthToken();
      await api.post(`/api/student/interviews/${currentSessionId}/integrity-event`, {
        eventType,
        questionId: qId,
        questionIndex: qIdx,
        section: sec,
        details,
      }, { headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {} });
    } catch (err) {
      console.warn("Failed to log integrity event:", err);
    }
  }, [sessionId, token]);

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
    if (isLoadingInterview || isCompleted || !isDeviceCheckPassed) return;

    // Request fullscreen on startup (user-initiated Start Interview gesture)
    const timer = setTimeout(() => {
      handleReenterFullscreen();
      setFullscreenRequested(true);
    }, 400);

    return () => clearTimeout(timer);
  }, [isLoadingInterview, isCompleted, isDeviceCheckPassed, handleReenterFullscreen]);

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
      } else if (everEnteredFsRef.current && !isCompleted && !isLoadingInterview && isDeviceCheckPassed) {
        // Only treat as an integrity "exit" pause once the candidate has been
        // in fullscreen at least once and passed device check.
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
  }, [isCompleted, isLoadingInterview, isDeviceCheckPassed, logIntegrityEvent]);

  // ─── Hide the website navbar while inside the dedicated interview room ───
  useEffect(() => {
    document.body.classList.add("interview-active");
    return () => document.body.classList.remove("interview-active");
  }, []);

  // Blocking fullscreen-required gate: shown only before the candidate has
  // entered fullscreen and the browser refused the automatic request.
  const showFullscreenGate =
    fullscreenRequested &&
    !isInFullscreen &&
    !isFullscreenExited &&
    !isCompleted &&
    !isLoadingInterview &&
    isDeviceCheckPassed;

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

  // ─── Pre-Interview Device Check & Webcam Acquisition Lifecycle ───
  const hasAttemptedWebcamRef = useRef(false);
  const webcamDeniedRef = useRef(false);

  // Handle live video element reference for person/face detection
  const handleVideoElement = useCallback((videoEl) => {
    videoElementRef.current = videoEl;
    if (!personDetectorRef.current) {
      personDetectorRef.current = new PersonDetector();
    }

    if (videoEl && isCameraOn) {
      personDetectorRef.current.start(videoEl, (result) => {
        setPersonCount(result.count);
        setPersonStatus(result.status);

        const now = Date.now();
        if (
          result.status === "MULTIPLE_PEOPLE" &&
          (!lastIntegrityAlertRef.current.multiple || now - lastIntegrityAlertRef.current.multiple > 10000)
        ) {
          lastIntegrityAlertRef.current.multiple = now;
          logIntegrityEvent(
            "MULTIPLE_PEOPLE_DETECTED",
            `Multiple persons (${result.count}) detected in candidate camera frame`
          );
        } else if (
          result.status === "NO_PERSON" &&
          (!lastIntegrityAlertRef.current.noPerson || now - lastIntegrityAlertRef.current.noPerson > 15000)
        ) {
          lastIntegrityAlertRef.current.noPerson = now;
          logIntegrityEvent("NO_PERSON_DETECTED", "No candidate face detected in camera frame");
        }
      });
    } else {
      personDetectorRef.current.stop();
    }
  }, [isCameraOn, logIntegrityEvent]);

  // Handler for proceeding from mandatory Pre-Interview Device Check Gate
  const handleDeviceCheckProceed = useCallback((verifiedStream) => {
    if (webcamStreamRef.current && webcamStreamRef.current !== verifiedStream) {
      webcamStreamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) {}
      });
    }

    webcamStreamRef.current = verifiedStream;
    setWebcamStream(verifiedStream);
    setIsCameraOn(true);
    setIsMicOn(true);
    setIsDeviceCheckPassed(true);

    const vTrack = verifiedStream.getVideoTracks?.()[0];
    if (vTrack) {
      vTrack.onended = () => {
        setIsCameraOn(false);
        if (personDetectorRef.current) {
          personDetectorRef.current.stop();
        }
        setPersonStatus("CAMERA_DISCONNECTED");
        logIntegrityEvent("CAMERA_DISCONNECTED", "Candidate camera track ended unexpectedly");
      };
    }

    const aTrack = verifiedStream.getAudioTracks?.()[0];
    if (aTrack) {
      aTrack.onended = () => {
        setIsMicOn(false);
        toast.error("Microphone disconnected", { id: "mic-disconnected-toast" });
      };
    }

    // Enter fullscreen mode upon successful device check pass
    handleReenterFullscreen();
    setFullscreenRequested(true);
  }, [handleReenterFullscreen, logIntegrityEvent]);

  // Re-acquire camera on explicit retry
  const startWebcam = useCallback(async () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) {}
      });
      webcamStreamRef.current = null;
    }
    hasAttemptedWebcamRef.current = true;
    webcamDeniedRef.current = false;

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
          if (personDetectorRef.current) {
            personDetectorRef.current.stop();
          }
          setPersonStatus("CAMERA_DISCONNECTED");
          logIntegrityEvent("CAMERA_DISCONNECTED", "Candidate camera track ended unexpectedly");
        };
      }
    } catch (err) {
      webcamDeniedRef.current = true;
      setIsCameraOn(false);
      console.warn("[StartInterview] Webcam retry error:", err?.name || err);
    }
  }, [logIntegrityEvent]);

  const stopWebcam = useCallback(() => {
    if (personDetectorRef.current) {
      personDetectorRef.current.stop();
    }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
          t.enabled = false;
        } catch (e) {}
      });
      webcamStreamRef.current = null;
      setWebcamStream(null);
    }
    setIsCameraOn(false);
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    answerInputRef.current?.stopVoiceRecording();
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
      if (!next && personDetectorRef.current) {
        personDetectorRef.current.stop();
        setPersonStatus("CAMERA_OFF");
      } else if (next && videoElementRef.current && personDetectorRef.current) {
        personDetectorRef.current.start(videoElementRef.current, (result) => {
          setPersonCount(result.count);
          setPersonStatus(result.status);
        });
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
            answerInputRef.current?.toggleVoiceRecording?.();
          }
        }, 50);
      }
    }
  }, [stopSpeechRecognition]);

  // Teardown camera & ML resources on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
      if (personDetectorRef.current) {
        personDetectorRef.current.destroy();
        personDetectorRef.current = null;
      }
      stopSpeechRecognition();
      window.speechSynthesis?.cancel();
    };
  }, [stopWebcam, stopSpeechRecognition]);

  // Shut down camera & mic hardware immediately when interview completes
  useEffect(() => {
    if (isCompleted) {
      stopWebcam();
      if (personDetectorRef.current) {
        personDetectorRef.current.stop();
      }
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

        setInterviewDurationMin(30);

        if (isDbCompleted) {
          setTimerSeconds(0);
        } else {
          const storedRemainingKey = `active_individual_project_remaining_seconds_${targetId}`;
          let recoveredRemaining = null;
          try {
            const val = localStorage.getItem(storedRemainingKey);
            if (val !== null && !isNaN(Number(val))) {
              recoveredRemaining = Math.max(0, Math.min(Number(val), 30 * 60));
            }
          } catch (e) {}
          const initialSecs = recoveredRemaining !== null ? recoveredRemaining : 30 * 60;
          setTimerSeconds(initialSecs);
          try {
            localStorage.setItem(storedRemainingKey, String(initialSecs));
          } catch (e) {}
        }
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

        setInterviewDurationMin(45);

        if (isDbCompleted) {
          setTimerSeconds(0);
        } else {
          const storedRemainingKey = `active_individual_technical_remaining_seconds_${targetId}`;
          let recoveredRemaining = null;
          try {
            const val = localStorage.getItem(storedRemainingKey);
            if (val !== null && !isNaN(Number(val))) {
              recoveredRemaining = Math.max(0, Math.min(Number(val), 45 * 60));
            }
          } catch (e) {}
          const initialSecs = recoveredRemaining !== null ? recoveredRemaining : 45 * 60;
          setTimerSeconds(initialSecs);
          try {
            localStorage.setItem(storedRemainingKey, String(initialSecs));
          } catch (e) {}
        }
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

      const durMin = isIndividualProject
        ? 30
        : isIndividualTechnical
        ? 45
        : (data.durationMinutes || 120);
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

      if (isDbCompleted) {
        setTimerSeconds(0);
      } else {
        const storedRemainingKey = `active_real_interview_remaining_seconds_${targetId}`;
        let recoveredRemaining = null;
        try {
          const val = localStorage.getItem(storedRemainingKey);
          if (val !== null && !isNaN(Number(val))) {
            recoveredRemaining = Math.max(0, Math.min(Number(val), durMin * 60));
          }
        } catch (e) {}
        const initialSecs = recoveredRemaining !== null ? recoveredRemaining : durMin * 60;
        setTimerSeconds(initialSecs);
        try {
          localStorage.setItem(storedRemainingKey, String(initialSecs));
        } catch (e) {}
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

    if (finalAnswerText) {
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

  // Keep questionsRef in sync
  const questionsRef = useRef(questions);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // ─── SECTION QUESTION MATCHER HELPER ───
  const isQuestionInSection = useCallback((q, secId) => {
    if (!q) return false;
    const target = String(secId || "").toUpperCase();
    const qSec = String(q.section || q.category || q.type || "").toUpperCase();
    const qType = String(q.type || q.questionType || "").toLowerCase();

    if (target === "APTITUDE") {
      return qSec === "APTITUDE" || qType === "aptitude" || (Array.isArray(q.options) && q.options.length > 0 && qType !== "coding");
    }
    if (target === "RESUME_PROJECT" || target === "PROJECT") {
      return qSec === "RESUME_PROJECT" || qSec === "PROJECT" || qSec === "RESUME" || qType === "project" || qType === "resume_project";
    }
    if (target === "TECHNICAL") {
      return qSec === "TECHNICAL" || qType === "technical";
    }
    if (target === "CODING") {
      return qSec === "CODING" || qType === "coding";
    }
    if (target === "HR") {
      return qSec === "HR" || qType === "hr";
    }
    return qSec === target;
  }, []);

  // ─── SECTION NAVIGATION & TAB SWITCHING HANDLER ───
  const handleSelectSection = useCallback(async (targetSection) => {
    if (!targetSection) return;
    const normTarget = String(targetSection).toUpperCase();

    let canonicalTarget = normTarget;
    if (canonicalTarget === "PROJECT" || canonicalTarget === "RESUME") canonicalTarget = "RESUME_PROJECT";
    if (canonicalTarget === "APTI") canonicalTarget = "APTITUDE";
    if (canonicalTarget === "TECH") canonicalTarget = "TECHNICAL";

    const currentQuestions = questionsRef.current || questions;
    const sectionQuestions = currentQuestions.filter((q) => isQuestionInSection(q, canonicalTarget));

    if (!sectionQuestions.length) {
      toast(`No questions found for ${canonicalTarget} round.`, { icon: "ℹ️" });
      return;
    }

    // Immediately stop voice playback and recording
    stopSpeechRecognition();
    window.speechSynthesis?.cancel();

    // Persist current answer before switching if candidate provided one
    const isCurrentCoding = currentSectionRef.current === "CODING";
    const currentAnswerText = isCurrentCoding ? currentCode : (typedResponseRef.current || typedResponse);
    const starter = currentQuestionRef.current?.starterCode || "def solution():\n    pass";
    const hasRealAnswer =
      currentAnswerText &&
      String(currentAnswerText).trim().length > 0 &&
      (!isCurrentCoding || String(currentAnswerText).trim() !== String(starter).trim());

    if (hasRealAnswer) {
      try {
        await handleSaveAnswer("answered", currentAnswerText);
      } catch (e) {}
    }

    const answeredIds = new Set(
      savedAnswers
        .filter((a) => a.answer && String(a.answer).trim().length > 0)
        .map((a) => String(a.questionId))
    );

    const firstUnanswered = sectionQuestions.find((q) => !answeredIds.has(String(q.id || q.questionId)));
    const targetQuestion = firstUnanswered || sectionQuestions[0];
    const targetIdx = currentQuestions.findIndex(
      (q) => String(q.id || q.questionId) === String(targetQuestion.id || targetQuestion.questionId)
    );

    if (targetIdx !== -1) {
      setCurrentIndex(targetIdx + 1);
      const displayNames = {
        APTITUDE: "Aptitude",
        RESUME_PROJECT: "Resume / Project",
        TECHNICAL: "Technical",
        CODING: "Coding",
        HR: "HR",
      };
      toast.success(`Switched to ${displayNames[canonicalTarget] || canonicalTarget} round`, { duration: 2000 });
    }
  }, [questions, isQuestionInSection, savedAnswers, currentCode, typedResponse, handleSaveAnswer, stopSpeechRecognition]);

  // ─── ACTIVE INTERVIEW TIMER COUNTDOWN (visible tab only, pauses when hidden) ───
  useEffect(() => {
    if (isLoadingInterview || !isDeviceCheckPassed || isCompleted || isEvaluating) return;

    const interval = setInterval(() => {
      // Pause countdown if the tab/window is hidden or minimized
      if (document.hidden || document.visibilityState === "hidden") {
        return;
      }

      setTimerSeconds((prev) => {
        if (prev <= 0) return 0;
        const next = prev - 1;
        const currentSessionId = sessionIdRef.current || sessionId;
        if (currentSessionId) {
          const storageKey = isIndividualProject
            ? `active_individual_project_remaining_seconds_${currentSessionId}`
            : isIndividualTechnical
            ? `active_individual_technical_remaining_seconds_${currentSessionId}`
            : `active_real_interview_remaining_seconds_${currentSessionId}`;
          try {
            localStorage.setItem(storageKey, String(next));
          } catch (e) {}
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoadingInterview, isDeviceCheckPassed, isCompleted, isEvaluating, isIndividualProject, isIndividualTechnical, sessionId]);

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
            localStorage.removeItem(`active_individual_project_remaining_seconds_${currentSessionId}`);
          } catch (e) {}
          navigate(`/student/individual-project/result/${currentSessionId}`);
        } else if (isIndividualTechnical) {
          await api.post(`/api/individual/technical/session/${currentSessionId}/submit`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          try {
            localStorage.removeItem("active_individual_technical_session_id");
            localStorage.removeItem(`active_individual_technical_remaining_seconds_${currentSessionId}`);
          } catch (e) {}
          navigate(`/individual-practice/technical/result/${currentSessionId}`);
        } else {
          await api.post("/api/real-interview/submit", { sessionId: currentSessionId }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          try {
            localStorage.removeItem("active_real_interview_session_id");
            localStorage.removeItem(`active_real_interview_remaining_seconds_${currentSessionId}`);
          } catch (e) {}
        }
      } catch (err) {
        console.warn("[StartInterview] Submit pipeline notice:", err.message);
      }
    }
  }, [sessionId, token, handleSaveAnswer, stopSpeechRecognition, isIndividualTechnical, isIndividualProject, navigate]);

  // ─── TIME ELAPSED NOTIFICATION (strictly non-submitting) ───
  const timeUpLoggedRef = useRef(false);
  useEffect(() => {
    if (timerSeconds === 0 && !isCompleted && !isEvaluating && !isLoadingInterview) {
      if (!timeUpLoggedRef.current) {
        timeUpLoggedRef.current = true;
        logIntegrityEvent("TIME_UP", "Interview duration elapsed");
        toast.error("Interview time has expired. Please submit your interview when ready.", {
          id: "time-expired-toast",
          duration: 6000,
        });
      }
    }
  }, [timerSeconds, isCompleted, isEvaluating, isLoadingInterview, logIntegrityEvent]);


  // ─── AI INTERVIEWER SPEECH PLAYBACK LAYER ───
  const speakCurrentQuestion = useCallback((text, section, topic) => {
    // Immediately stop speech recording so candidate mic does not record AI speech
    stopSpeechRecognition();

    if (!text || !isSpeakerOnRef.current || isFullscreenExitedRef.current) {
      setAiStatus("LISTENING");
      aiStatusRef.current = "LISTENING";
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
      stopSpeechRecognition();
    };

    utterance.onend = () => {
      setAiStatus("LISTENING");
      aiStatusRef.current = "LISTENING";
      ttsEndedAtRef.current = Date.now();
    };

    utterance.onerror = (e) => {
      console.warn("TTS Error:", e);
      setAiStatus("LISTENING");
      aiStatusRef.current = "LISTENING";
    };

    window.speechSynthesis?.speak(utterance);
  }, [token, stopSpeechRecognition]);

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
        typedResponseRef.current = "";
      }, 700);
    } else {
      setShowConfirmExit(true);
    }
  };

  const handlePrevQuestion = () => {
    if (currentIndex > 1) {
      stopSpeechRecognition();
      window.speechSynthesis?.cancel();
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
        typedResponseRef.current = "";
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
    <div className="flex flex-col h-full min-h-0 gap-2 overflow-hidden">
      {/* ─── TOP ROUND / SECTION TABS (Direct Round Switcher) ─── */}
      {!isIndividualTechnical && !isIndividualProject && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 py-0.5">
            {ROUND_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentSection === tab.id;
              const progress = sessionProgress[tab.id] || { completed: 0, total: tab.defaultTotal };
              const isDone = progress.completed >= progress.total && progress.total > 0;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectSection(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] text-white shadow-md shadow-[#FF6B35]/30 scale-[1.02]"
                      : isDone
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20"
                      : "bg-white/[0.03] text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/5"
                  }`}
                  title={`Switch to ${tab.name} Round`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{tab.name}</span>
                  <span
                    className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-extrabold ${
                      isActive
                        ? "bg-black/30 text-white"
                        : isDone
                        ? "bg-emerald-400/20 text-emerald-300"
                        : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {isDone ? "✓" : `${progress.completed}/${progress.total}`}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 shrink-0">
            <span className="text-[10px] font-medium text-slate-400">Current:</span>
            <span className="font-mono text-xs font-black text-[#FF6B35]">
              {formattedSectionQuestionIndex} / {String(sectionTotal).padStart(2, "0")}
            </span>
          </div>
        </div>
      )}

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
              /* ── 2. CODING: LeetCode-Style IDE Workspace with Horizontal Resizer, Collapsible Problem & Top Action Bar ── */
              <div
                ref={splitWorkspaceRef}
                onPointerMove={handleHResizeMove}
                onPointerUp={handleHResizeEnd}
                onPointerCancel={handleHResizeEnd}
                className="flex-1 min-h-0 flex flex-row items-stretch gap-0 overflow-hidden relative select-none"
                style={{ userSelect: isDraggingH ? "none" : "auto" }}
              >
                {/* ── LEFT PANEL: Problem Statement + Collapsible Custom Input (STDIN) ── */}
                {isProblemCollapsed ? (
                  <div className="w-12 h-full shrink-0 rounded-2xl bg-slate-950/85 border border-white/10 flex flex-col items-center py-4 gap-4 justify-between shadow-xl mr-2">
                    <button
                      type="button"
                      onClick={() => setIsProblemCollapsed(false)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-[#FF6B35]/20 text-slate-300 hover:text-[#FF6B35] transition cursor-pointer"
                      title="Expand Problem Statement"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase [writing-mode:vertical-rl] rotate-180">
                      Problem Statement
                    </span>
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                  </div>
                ) : (
                  <div
                    className="h-full min-h-0 rounded-2xl bg-slate-950/85 border border-white/10 flex flex-col overflow-hidden shadow-xl"
                    style={{ width: `calc(${codingLeftWidthPercent}% - 6px)` }}
                  >
                    {/* Problem Top Header with Collapse Button */}
                    <div className="px-4 py-2.5 border-b border-white/10 bg-slate-900/90 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-[#FF6B35] shrink-0" />
                        <span className="text-xs font-bold text-white">Problem Statement</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsProblemCollapsed(true)}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                        title="Collapse Problem Panel"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Problem Content (Independently Scrollable) */}
                    <div
                      className="flex-1 min-h-0 p-4 sm:p-5 flex flex-col gap-3.5 overflow-y-auto text-xs"
                      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.12) transparent" }}
                    >
                      {/* Problem Header & Badges */}
                      <div className="space-y-2 pb-2 border-b border-white/10">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                            {currentQuestion.title || "Coding Problem"}
                          </h3>
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase shrink-0 border ${
                              (currentQuestion.difficulty || "Medium").toLowerCase() === "hard"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : (currentQuestion.difficulty || "Medium").toLowerCase() === "medium"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {currentQuestion.difficulty || "Medium"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                          {(currentQuestion.topic || currentQuestion.category) && (
                            <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-slate-300 font-medium">
                              {currentQuestion.topic || currentQuestion.category}
                            </span>
                          )}
                          {(currentQuestion.marks || currentQuestion.maxMarks) && (
                            <span className="px-2 py-0.5 rounded-md bg-[#FF6B35]/10 border border-[#FF6B35]/20 text-[#FF6B35] font-semibold">
                              {currentQuestion.marks || currentQuestion.maxMarks} Marks
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Description
                        </span>
                        <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed whitespace-pre-line">
                          {currentQuestion.problemStatement || currentQuestion.description || currentQuestion.question}
                        </p>
                      </div>

                      {/* Input Format */}
                      {currentQuestion.inputFormat && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Input Format
                          </span>
                          <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                            {currentQuestion.inputFormat}
                          </div>
                        </div>
                      )}

                      {/* Output Format */}
                      {currentQuestion.outputFormat && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Output Format
                          </span>
                          <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                            {currentQuestion.outputFormat}
                          </div>
                        </div>
                      )}

                      {/* Constraints */}
                      {currentQuestion.constraints && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Constraints
                          </span>
                          <div className="p-2.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-amber-200/90 font-mono text-[11px] leading-relaxed whitespace-pre-line">
                            {Array.isArray(currentQuestion.constraints) ? currentQuestion.constraints.join("\n") : String(currentQuestion.constraints)}
                          </div>
                        </div>
                      )}

                      {/* Examples / Sample Cases */}
                      {(() => {
                        const exList = Array.isArray(currentQuestion.examples) && currentQuestion.examples.length > 0
                          ? currentQuestion.examples
                          : (currentQuestion.sampleInput || currentQuestion.sampleOutput)
                            ? [{ input: currentQuestion.sampleInput, output: currentQuestion.sampleOutput, explanation: currentQuestion.explanation }]
                            : (currentQuestion.testCases && currentQuestion.testCases.filter((tc) => !tc.isHidden).length > 0)
                              ? currentQuestion.testCases.filter((tc) => !tc.isHidden).slice(0, 2).map((tc) => ({ input: tc.input, output: tc.expected }))
                              : [];

                        if (exList.length === 0) return null;

                        return (
                          <div className="space-y-2.5 pt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Examples
                            </span>
                            {exList.map((ex, idx) => (
                              <div key={idx} className="p-3 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
                                <div className="text-[11px] font-bold text-[#FF6B35]">Example {idx + 1}</div>
                                {ex.input !== undefined && ex.input !== null && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Input</span>
                                    <pre className="p-2 rounded-lg bg-black/60 border border-white/5 font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                                      {typeof ex.input === "object" ? JSON.stringify(ex.input, null, 2) : String(ex.input)}
                                    </pre>
                                  </div>
                                )}
                                {ex.output !== undefined && ex.output !== null && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Output</span>
                                    <pre className="p-2 rounded-lg bg-black/60 border border-white/5 font-mono text-[11px] text-sky-300 overflow-x-auto whitespace-pre-wrap">
                                      {typeof ex.output === "object" ? JSON.stringify(ex.output, null, 2) : String(ex.output)}
                                    </pre>
                                  </div>
                                )}
                                {ex.explanation && (
                                  <div className="text-[11px] text-slate-400 pt-0.5">
                                    <span className="text-slate-300 font-medium">Explanation: </span>{ex.explanation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* ── CUSTOM INPUT (STDIN) SECTION MOVED TO LEFT PANEL ── */}
                      <div className="rounded-xl border border-white/10 bg-slate-900/80 overflow-hidden shrink-0 mt-2">
                        <button
                          type="button"
                          onClick={() => setIsCustomInputOpen((v) => !v)}
                          className="w-full px-3 py-2 flex items-center justify-between text-left cursor-pointer hover:bg-white/5 transition border-b border-white/5"
                        >
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-[#FF6B35]" />
                            Custom Input (stdin)
                          </span>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="text-[9.5px] font-medium opacity-70">{isCustomInputOpen ? "Hide" : "Show"}</span>
                            {isCustomInputOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </button>

                        {isCustomInputOpen && (
                          <div className="p-3 space-y-2 bg-slate-950/90">
                            <textarea
                              value={customInput}
                              onChange={(e) => setCustomInput(e.target.value)}
                              placeholder={(currentQuestion.testCases?.[0]?.input || currentQuestion.sampleInput || "3 5").replace(/\b[a-zA-Z_]\w*\s*=\s*/g, "").trim()}
                              rows={2}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs font-mono text-white placeholder:text-slate-500 outline-none focus:border-[#FF6B35]/70 resize-none transition"
                            />
                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-[10px] text-slate-400">Test with custom arguments</span>
                              <button
                                type="button"
                                onClick={handleRunCoding}
                                disabled={isRunningCode || isSubmittingCode}
                                className="px-3 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 transition shadow-sm cursor-pointer disabled:opacity-50"
                              >
                                {isRunningCode ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                                Run Code
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── DRAGGABLE VERTICAL DIVIDER BETWEEN LEFT & RIGHT ── */}
                {!isProblemCollapsed && (
                  <div
                    onPointerDown={handleHResizeStart}
                    className="w-2.5 shrink-0 flex items-center justify-center cursor-col-resize group touch-none select-none hover:bg-[#FF6B35]/20 transition-colors mx-0.5"
                    style={{
                      background: isDraggingH ? "#FF6B35" : "transparent",
                    }}
                    title="Drag horizontally to resize Problem ↔ Code panels"
                  >
                    <div
                      className="w-[3px] h-10 rounded-full transition-colors group-hover:bg-[#FF6B35]"
                      style={{ background: isDraggingH ? "#fff" : "rgba(255, 255, 255, 0.2)" }}
                    />
                  </div>
                )}

                {/* ── RIGHT PANEL: Monaco Editor + Draggable Output Terminal ── */}
                <div
                  className="h-full min-h-0 rounded-2xl bg-slate-950/85 border border-white/10 flex flex-col overflow-hidden shadow-xl"
                  style={{
                    width: isProblemCollapsed ? "calc(100% - 56px)" : `calc(${100 - codingLeftWidthPercent}% - 6px)`,
                    flex: 1,
                  }}
                >
                  {/* Editor Toolbar: Language Selector + Reset + Run Code + Submit Solution (Top Right LeetCode-style) */}
                  <div className="flex flex-wrap items-center justify-between px-3.5 py-2 border-b border-white/10 bg-slate-900/90 shrink-0 gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Code2 className="w-4 h-4 text-[#FF6B35]" />
                        Code Editor
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Judge0 Sandbox
                      </span>
                    </div>

                    {/* Right Controls: Language Selector + Reset + Run Code + Submit Solution */}
                    <div className="flex items-center gap-2 flex-wrap">
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
                        className="bg-slate-800 hover:bg-slate-750 border border-white/15 text-xs text-white font-medium rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-[#FF6B35] transition shadow-sm"
                      >
                        <option value="python">Python 3.8.1 ▼</option>
                        <option value="cpp">C++ GCC 9.2.0 ▼</option>
                        <option value="java">Java OpenJDK 13 ▼</option>
                        <option value="javascript">JavaScript Node 12 ▼</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const resetCode = getStarterCode(currentQuestion, codingLanguage);
                          setCurrentCode(resetCode);
                          codingCodeByLangRef.current[codingLanguage] = resetCode;
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition"
                        title="Reset code template"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRunCoding}
                        disabled={isRunningCode || isSubmittingCode}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-900/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRunningCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        Run Code
                      </button>

                      <button
                        type="button"
                        onClick={handleSubmitCoding}
                        disabled={isRunningCode || isSubmittingCode}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 transition-all shadow-md shadow-[#FF6B35]/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmittingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Submit Solution
                      </button>

                      {codingSubmissionResult && (
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          codingSubmissionResult.score === 100
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        }`}>
                          <span>Score:</span>
                          <span className="font-mono">{codingSubmissionResult.passed}/{codingSubmissionResult.total}</span>
                          <span className="text-[10px] opacity-75">({codingSubmissionResult.score}%)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Monaco Code Editor Canvas (Takes flex-1 of remaining space) */}
                  <div className="flex-1 min-h-[140px] overflow-hidden">
                    <MonacoCodeEditor
                      value={currentCode}
                      onChange={(val) => setCurrentCode(val || "")}
                      language={codingLanguage}
                      theme="dark"
                    />
                  </div>

                  {/* Draggable Output Terminal (Testcase | Test Result | Submissions) */}
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
                <InterviewAnswerInput
                  ref={answerInputRef}
                  value={typedResponse}
                  onChange={(val) => {
                    setTypedResponse(val);
                    typedResponseRef.current = val;
                  }}
                  onListeningChange={setIsListeningVoice}
                  questionId={currentQuestion.id || currentQuestion.questionId || `Q-${currentIndex}`}
                  placeholder={
                    currentSection === "HR"
                      ? "Speak or type your response here... It will be evaluated by AI."
                      : "Write or speak your answer here..."
                  }
                  rows={4}
                  className="flex-1 min-h-0"
                  textareaClassName="bg-slate-950/60 border-white/10 text-white placeholder:text-white/30 resize-none font-sans"
                  textareaStyle={{ scrollbarWidth: "thin", minHeight: "80px", maxHeight: "150px" }}
                  accentColor="#FF6B35"
                  disabled={isEvaluating || isCompleted}
                  actions={
                    typedResponse.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSaveAnswer("answered")}
                        className="px-3.5 py-1 rounded-xl text-xs font-bold bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-[#FF6B35]/25"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Save Answer
                      </button>
                    )
                  }
                />

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
            {/* Listen Again banner (Non-Coding Rounds) */}
            {!isCoding && (
              <button
                type="button"
                onClick={() => speakCurrentQuestion(currentQuestion?.aiSpeechText || currentQuestion?.question, currentQuestion?.section, currentQuestion?.topic)}
                disabled={isPaused || !isSpeakerOn}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 hover:bg-[#FF6B35]/10 text-[#FF6B35] font-bold text-xs cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#FF6B35]" />
                <span>Listen Again</span>
              </button>
            )}

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
          personCount={personCount}
          personStatus={personStatus}
          onVideoElement={handleVideoElement}
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

      {/* Mandatory Pre-Interview Device Check Gate */}
      <DeviceCheckModal
        isOpen={!isDeviceCheckPassed && !isLoadingInterview && !isCompleted}
        onProceed={handleDeviceCheckProceed}
        candidateName={candidateInfo.name}
      />

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
          isListening: isListeningVoice,
          onToggleMic: handleToggleMic,
          onToggleCamera: handleToggleCamera,
          onToggleSpeaker: handleToggleSpeaker,
          onPushToTalk: () => {
            if (!isMicOn) return toast.error("Unmute mic first");
            answerInputRef.current?.toggleVoiceRecording?.();
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
