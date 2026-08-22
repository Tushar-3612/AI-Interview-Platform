import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Bot, Sparkles, Mic, MicOff, CheckCircle2, Keyboard, Loader2, Play, Code2, AlertTriangle, UserCheck, Target, BrainCircuit, Maximize2, RotateCcw, Radio, Send } from "lucide-react";

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

// Import Monaco editor & Output panel for Coding questions
import MonacoCodeEditor from "../../components/coding/MonacoCodeEditor";
import OutputPanel from "../../components/coding/OutputPanel";

// Import mock fallback data if session fails
import { MOCK_QUESTIONS, MOCK_CANDIDATE } from "../../data/interviewMockData";

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
function StartInterview() {
  const { sessionId: paramSessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const routerState = location.state || {};
  const { profile } = useStudentProfile();
  const token = getAuthToken();

  const activeInterviewId = paramSessionId || routerState.interviewId || routerState.sessionId || profile.interviewId;

  // Session State
  const [questions, setQuestions] = useState(routerState.generatedQuestions || []);
  const [currentIndex, setCurrentIndex] = useState(1); // 1-indexed
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
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

  const [codingLanguage, setCodingLanguage] = useState("cpp");
  const [currentCode, setCurrentCode] = useState(CODING_STARTERS.cpp);
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
    if (!activeInterviewId) return;
    try {
      await api.post(`/api/interview/${activeInterviewId}/integrity-event`, {
        eventType,
        questionId: currentQuestion.id || currentQuestion.questionId || "",
        questionIndex: currentIndex,
        section: currentSection,
        details
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.warn("Failed to log integrity event:", err);
    }
  }, [activeInterviewId, currentQuestion, currentIndex, currentSection, token]);

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
  const startWebcam = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
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
      console.warn("Webcam access warning:", err);
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
    startWebcam();
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
  useEffect(() => {
    const loadSession = async () => {
      setIsLoadingInterview(true);
      try {
        let targetId = activeInterviewId;

        if (!targetId) {
          const { data: newSession } = await api.post(
            "/api/interview/start",
            { interviewType: "actual" },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          targetId = newSession.sessionId || newSession.interviewId;
        }

        if (!targetId) {
          throw new Error("Could not initialize interview session ID");
        }

        const { data } = await api.get(`/api/interview/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const activeTarget = data.targetRound || initialTargetRound || "all";
        setTargetRound(activeTarget);

        const durMin = data.durationMinutes || (activeTarget === "aptitude" ? 20 : activeTarget === "technical" ? 30 : activeTarget === "coding" ? 35 : activeTarget === "hr" ? 20 : 105);
        setInterviewDurationMin(durMin);

        let loadedQs = data.generatedQuestions || [];

        // Lazy load round if no questions generated yet
        if (!loadedQs || loadedQs.length === 0) {
          try {
            const fetchRoundName = activeTarget !== "all" ? activeTarget : "aptitude";
            const { data: roundData } = await api.get(`/api/interview/${targetId}/round/${fetchRoundName}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (roundData.questions && roundData.questions.length > 0) {
              loadedQs = roundData.questions;
            }
          } catch (roundErr) {
            console.warn("Initial round lazy load notice:", roundErr.message);
          }
        }

        if (loadedQs && loadedQs.length > 0) {
          setQuestions(loadedQs);
        } else {
          setQuestions(MOCK_QUESTIONS);
        }

        if (data.answers && Array.isArray(data.answers)) {
          setSavedAnswers(data.answers);
        }

        if (data.currentQuestionIndex) {
          setCurrentIndex(Number(data.currentQuestionIndex) || 1);
        }

        const roundTitles = {
          all: "Real AI Interview Room (All 4 Rounds)",
          aptitude: "Aptitude Round (MCQs)",
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

        // Session-based timer: derive remaining time from the backend session
        // start so a page refresh does NOT reset the countdown.
        if (data.startedAt) {
          const startTs = new Date(data.startedAt).getTime();
          sessionEndTimeRef.current = startTs + durMin * 60000;
          const remaining = Math.max(0, Math.round((sessionEndTimeRef.current - Date.now()) / 1000));
          setTimerSeconds(remaining);
        } else {
          setTimerSeconds(durMin * 60);
        }
      } catch (err) {
        console.error("Session load error:", err);
        const errMsg = err.response?.data?.message || err.message || "Failed to initialize interview questions";
        setSessionError(errMsg);
        toast.error(errMsg, { duration: 8000, id: "session-load-error" });
      } finally {
        setIsLoadingInterview(false);
      }
    };

    loadSession();
  }, [paramSessionId]);

  // ─── SINGLE SOURCE OF TRUTH: SESSION PROGRESS ───
  // Every progress readout (sidebar, overall, section headers, completion
  // stats) is derived from this one memoized object so no UI shows a
  // different number. Progress = actually-submitted (non-empty) answers only.
  const SECTION_TOTALS = { APTITUDE: 25, TECHNICAL: 25, CODING: 3, HR: 5 };
  const sessionProgress = useMemo(() => {
    const counts = {
<<<<<<< HEAD
      APTITUDE: { completed: 0, total: SECTION_TOTALS.APTITUDE },
      TECHNICAL: { completed: 0, total: SECTION_TOTALS.TECHNICAL },
      CODING: { completed: 0, total: SECTION_TOTALS.CODING },
      HR: { completed: 0, total: SECTION_TOTALS.HR },
=======
      APTITUDE: { completed: 0, total: 10 },
      TECHNICAL: { completed: 0, total: 10 },
      CODING: { completed: 0, total: 2 },
      HR: { completed: 0, total: 8 },
>>>>>>> ee891a659c17f7eb242321c5addac9c3732fc708
      totalCompleted: 0,
      totalQuestions: 58,
    };

    const answeredIds = new Set(
      savedAnswers
        .filter((a) => a.answer && String(a.answer).trim().length > 0)
        .map((a) => String(a.questionId))
    );

    questions.forEach((q) => {
      const sec = q.section || "TECHNICAL";
      const qId = String(q.id || q.questionId);
      if (counts[sec]) {
        if (answeredIds.has(qId)) {
          counts[sec].completed += 1;
          counts.totalCompleted += 1;
        }
      }
    });

    return counts;
  }, [questions, savedAnswers]);

  // ─── SECTION NAVIGATION & ON-DEMAND LAZY LOAD HANDLER ───
  const handleSelectSection = async (targetSection) => {
    let currentQuestions = [...questions];
    let sectionQuestions = currentQuestions.filter((q) => q.section === targetSection);

    if (!sectionQuestions.length && activeInterviewId) {
      const toastId = toast.loading(`Preparing ${targetSection} round questions…`);
      try {
        const normSec = targetSection.toLowerCase();
        const { data } = await api.get(`/api/interview/${activeInterviewId}/round/${normSec}`, {
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

  // ─── AUTO-SUBMIT WHEN TIME EXPIRES ───
  useEffect(() => {
    if (timerSeconds === 0 && !isCompleted && !isLoadingInterview) {
      logIntegrityEvent("TIME_UP", "Interview duration elapsed — auto-submitting");
      setIsCompleted(true);
    }
  }, [timerSeconds, isCompleted, isLoadingInterview, logIntegrityEvent]);

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
      speechBaseTextRef.current = "";
      setCurrentCode(currentQuestion.starterCode || CODING_STARTERS.cpp);
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
        for (let i = event.resultIndex; i < event.results.length; i++) {
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
              try {
                rec.start();
              } catch (e) {
                startSpeechRecognition();
              }
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

  // ─── SAVE ANSWER TO BACKEND ───
  const handleSaveAnswer = async (statusType = "answered", customAns = null) => {
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

    if (activeInterviewId) {
      try {
        await api.post(`/api/interview/${activeInterviewId}/answer`, {
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
  };

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
          interviewId: activeInterviewId,
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
  const handleNextQuestion = () => {
    stopSpeechRecognition();
    window.speechSynthesis?.cancel();
    handleSaveAnswer("answered");

    if (currentIndex < questions.length) {
      setIsGeneratingQuestion(true);
      setAiStatus("THINKING");

      setTimeout(() => {
        setIsGeneratingQuestion(false);
        setCurrentIndex((prev) => prev + 1);
      }, 900);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrevQuestion = () => {
    if (currentIndex > 1) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSkipQuestion = () => {
    stopSpeechRecognition();
    window.speechSynthesis?.cancel();
    handleSaveAnswer("skipped");
    if (currentIndex < questions.length) {
      setIsGeneratingQuestion(true);
      setAiStatus("THINKING");

      setTimeout(() => {
        setIsGeneratingQuestion(false);
        setCurrentIndex((prev) => prev + 1);
      }, 900);
    } else {
      setIsCompleted(true);
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
<<<<<<< HEAD
  const sectionTotal = sessionProgress[currentSection]?.total ?? (currentSection === "APTITUDE" ? 25 : currentSection === "TECHNICAL" ? 25 : currentSection === "CODING" ? 3 : 5);
=======
  const sectionTotal = sectionQuestions.length || 1;
>>>>>>> ee891a659c17f7eb242321c5addac9c3732fc708
  const questionIdxInSection = sectionQuestions.findIndex((q) => (q.id || q.questionId) === (currentQuestion.id || currentQuestion.questionId)) + 1;
  const formattedSectionQuestionIndex = questionIdxInSection > 0 ? String(questionIdxInSection).padStart(2, "0") : "01";

  // ─── Render mode helpers (master spec: 3-zone layout) ───
  const showAI = currentSection === "TECHNICAL" || currentSection === "HR";
  const isCoding = currentSection === "CODING" || currentQuestion.type === "coding";
  const isAptitude = currentSection === "APTITUDE" || (currentQuestion.options && currentQuestion.options.length > 0 && !isCoding);
  const tH = String(Math.floor(timerSeconds / 3600)).padStart(2, "0");
  const tM = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0");
  const tS = String(timerSeconds % 60).padStart(2, "0");

  // CENTER WORKSPACE: AI interviewer (tech/hr) + question / answer / transcript / controls
  const centerWorkspace = (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {showAI && (
        <div className="h-[42%] min-h-0 shrink-0 rounded-2xl overflow-hidden border border-white/10">
          <AIInterviewerCard
            aiStatus={aiStatus}
            isGeneratingQuestion={isGeneratingQuestion}
            currentQuestionText={currentQuestion?.aiSpeechText || currentQuestion?.question || ""}
            section={voiceSettings.persona === "sarah" ? "HR" : voiceSettings.persona === "alex" ? "TECHNICAL" : currentSection}
          />
        </div>
      )}

      {sessionError && questions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/30 text-center space-y-3 max-w-lg w-full">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-base font-bold text-red-200">AI Question Generation Failed</h3>
            <p className="text-xs text-red-300/80 leading-relaxed font-mono">
              {sessionError}
            </p>
            <p className="text-[11px] text-white/50">
              Please ensure you have configured a valid Google Gemini API key (<code className="text-amber-400">AIzaSy...</code>) in your backend <code className="text-amber-400">.env</code> file.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer transition"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
      >
        {/* Question header */}
        <div className="shrink-0 p-3 rounded-2xl bg-slate-900/90 border border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
              {currentSection} — Question {formattedSectionQuestionIndex} / {String(sectionTotal).padStart(2, "0")}
            </span>
              <span className="text-[11px] font-bold text-white/40 font-mono">
                Overall: {String(sessionProgress.totalCompleted).padStart(2, "0")} / {String(sessionProgress.totalQuestions).padStart(2, "0")}
              </span>
          </div>
          <QuestionCard
            questionText={currentQuestion?.question || currentQuestion?.aiSpeechText || currentQuestion?.title || ""}
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            difficulty={currentQuestion?.difficulty || "Medium"}
            category={currentQuestion?.category || currentQuestion?.section || "Technical"}
            source={currentQuestion?.source}
            estimatedTime={currentSection === "CODING" ? "10 mins" : "2 mins"}
            showQuestionText={true}
          />
        </div>

        {/* Answer area */}
        {isCoding ? (
          <div className="shrink-0 flex flex-col gap-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Left Side: Problem Description, Constraints, Examples */}
              <div className="overflow-y-auto max-h-84 p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    {currentQuestion.title || "Coding Problem"}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                    {currentQuestion.difficulty || "Medium"}
                  </span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed whitespace-pre-line">
                  {currentQuestion.problemStatement || currentQuestion.description || currentQuestion.question}
                </p>
                {currentQuestion.inputFormat && (
                  <div className="text-[11px] text-white/70 bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-amber-400 font-bold uppercase text-[10px] block mb-0.5">Input Format</span>
                    {currentQuestion.inputFormat}
                  </div>
                )}
                {currentQuestion.outputFormat && (
                  <div className="text-[11px] text-white/70 bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-blue-400 font-bold uppercase text-[10px] block mb-0.5">Output Format</span>
                    {currentQuestion.outputFormat}
                  </div>
                )}
                {currentQuestion.constraints && (
                  <div className="text-[11px] text-white/70 bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-purple-400 font-bold uppercase text-[10px] block mb-0.5">Constraints</span>
                    {currentQuestion.constraints}
                  </div>
                )}
                {currentQuestion.sampleInput && (
                  <div className="text-[11px] text-white/70 bg-white/5 p-2.5 rounded-xl border border-white/5 font-mono space-y-1">
                    <span className="text-emerald-400 font-bold uppercase text-[10px] block font-sans">Sample Case</span>
                    <div><span className="text-white/40">Input: </span>{currentQuestion.sampleInput}</div>
                    <div><span className="text-white/40">Output: </span>{currentQuestion.sampleOutput}</div>
                  </div>
                )}
              </div>

              {/* Right Side: Language Selector & Monaco Editor */}
              <div className="flex flex-col rounded-2xl bg-slate-900/90 border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between p-2.5 border-b border-white/10 bg-slate-950/40">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Judge0 Sandbox Editor
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={codingLanguage}
                      onChange={(e) => {
                        const newLang = e.target.value;
                        setCodingLanguage(newLang);
                        if (!currentCode || Object.values(CODING_STARTERS).includes(currentCode)) {
                          setCurrentCode(CODING_STARTERS[newLang] || "");
                        }
                      }}
                      className="bg-slate-800 border border-white/10 text-xs text-white rounded-lg px-2.5 py-1 outline-none cursor-pointer hover:border-white/20 transition"
                    >
                      <option value="cpp">C++ (GCC 9.2.0)</option>
                      <option value="c">C (GCC 9.2.0)</option>
                      <option value="java">Java (OpenJDK 13)</option>
                      <option value="python">Python (3.8.1)</option>
                      <option value="javascript">JavaScript (Node 12)</option>
                    </select>
                    <button
                      onClick={() => setCurrentCode(CODING_STARTERS[codingLanguage] || "")}
                      title="Reset starter template"
                      className="text-[11px] text-white/50 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="h-84">
                  <MonacoCodeEditor
                    value={currentCode}
                    onChange={(val) => setCurrentCode(val || "")}
                    language={codingLanguage}
                    theme="dark"
                  />
                </div>
              </div>
            </div>

            {/* Custom Input & Action Controls */}
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                  Custom Input (Stdin for Run Code)
                </span>
                <span className="text-[10px] text-white/40 font-mono">
                  Sample: {(currentQuestion.testCases?.[0]?.input || currentQuestion.sampleInput || "3 5").replace(/\b[a-zA-Z_]\w*\s*=\s*/g, "").trim()}
                </span>
              </div>
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={(currentQuestion.testCases?.[0]?.input || currentQuestion.sampleInput || "3 5").replace(/\b[a-zA-Z_]\w*\s*=\s*/g, "").trim()}
                rows={2}
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl p-2 text-xs font-mono text-white placeholder:text-white/30 outline-none focus:border-blue-500/50 transition resize-none"
              />
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRunCoding}
                    disabled={isRunningCode || isSubmittingCode}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 shadow-md shadow-emerald-900/20 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: "#059669" }}
                  >
                    {isRunningCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Run Code
                  </button>
                  <button
                    onClick={handleSubmitCoding}
                    disabled={isRunningCode || isSubmittingCode}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 shadow-md shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: "#2563eb" }}
                  >
                    {isSubmittingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Submit Solution
                  </button>
                </div>
                {codingSubmissionResult && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white/60">Score:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-lg border ${codingSubmissionResult.score === 100 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                      {codingSubmissionResult.passed}/{codingSubmissionResult.total} ({codingSubmissionResult.score}%)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Test Cases & Compiler Output Terminal */}
            <div className="rounded-2xl overflow-hidden border border-white/10">
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
        ) : isAptitude ? (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Select Correct Answer:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(currentQuestion.options || []).map((opt, idx) => {
                const isSelected = typedResponse === opt;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setTypedResponse(opt);
                      handleSaveAnswer("answered", opt);
                    }}
                    className={`p-3.5 rounded-xl border text-left text-xs font-semibold cursor-pointer transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-blue-600/30 border-blue-500 text-white shadow-lg"
                        : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border-white/20">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-4 flex flex-col gap-3 bg-slate-900/90 border border-white/10 shadow-lg">
            {/* Header: Mode selector + live mic indicator */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setInputMode("speak");
                    inputModeRef.current = "speak";
                    if (isMicOn && !isListeningSpeech) {
                      startSpeechRecognition();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    inputMode === "speak"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Voice Response {currentSection === "HR" && "(Recommended)"}</span>
                </button>
                <button
                  onClick={() => {
                    stopSpeechRecognition(true);
                    setInputMode("type");
                    inputModeRef.current = "type";
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    inputMode === "type"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Type Text</span>
                </button>
              </div>

              {/* Status Indicator badge */}
              <div className="flex items-center gap-2">
                {inputMode === "speak" ? (
                  !isMicOn ? (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5">
                      <MicOff className="w-3 h-3" /> Mic Muted
                    </span>
                  ) : isListeningSpeech ? (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Live Recording
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1.5">
                      <Radio className="w-3 h-3 text-blue-400" />
                      Mic Ready
                    </span>
                  )
                ) : (
                  <span className="text-[11px] font-bold text-white/40">Keyboard Input Mode</span>
                )}
                <span className="text-[10px] font-mono text-white/30">{typedResponse.length} chars</span>
              </div>
            </div>

            {/* Transcript / Answer Area */}
            <div className="relative">
              <textarea
                value={typedResponse}
                onChange={(e) => {
                  setTypedResponse(e.target.value);
                  typedResponseRef.current = e.target.value;
                }}
                placeholder={
                  inputMode === "speak"
                    ? currentSection === "HR"
                      ? "Speak your behavioral response to AI Sarah... Your words will appear here in real-time."
                      : "Speak your technical explanation... Your words will appear here in real-time."
                    : currentSection === "HR"
                    ? "Type your HR behavioral answer here (STAR method recommended)..."
                    : "Type your technical answer here..."
                }
                disabled={isPaused}
                rows={4}
                className="w-full rounded-xl p-3 text-xs leading-relaxed outline-none resize-none bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-blue-500 focus:bg-white/[0.07] transition-all"
              />
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                {typedResponse.trim().length > 0 && (
                  <button
                    onClick={() => {
                      setTypedResponse("");
                      typedResponseRef.current = "";
                      speechBaseTextRef.current = "";
                      if (inputMode === "speak" && isMicOn && !isListeningSpeech) {
                        startSpeechRecognition();
                      }
                      toast("Answer cleared. Ready to re-speak.", { duration: 1500 });
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/10 border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear & Re-speak
                  </button>
                )}
                {inputMode === "speak" && (
                  isListeningSpeech ? (
                    <button
                      onClick={() => {
                        stopSpeechRecognition(true);
                        toast("Microphone paused", { id: "mic-toggle-status", duration: 1500, icon: "⏸️" });
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <MicOff className="w-3 h-3" /> Stop / Pause Mic
                    </button>
                  ) : isMicOn ? (
                    <button
                      onClick={() => {
                        startSpeechRecognition();
                        toast.success("Microphone listening", { id: "mic-toggle-status", duration: 1500, icon: "🎙️" });
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Mic className="w-3 h-3" /> Start Mic
                    </button>
                  ) : (
                    <button
                      onClick={handleToggleMic}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Mic className="w-3 h-3" /> Unmute Mic
                    </button>
                  )
                )}
              </div>

              {typedResponse.trim().length > 0 && (
                <button
                  onClick={() => handleSaveAnswer("answered")}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-blue-600/25"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Save Answer
                </button>
              )}
            </div>
          </div>
        )}

        {/* Transcript (secondary / collapsible) */}
        <div className="shrink-0">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/60 cursor-pointer hover:bg-white/10 transition-all"
          >
            <span>View Conversation</span>
            <span className="text-[10px] font-extrabold text-blue-400">{showTranscript ? "Hide" : "Show"}</span>
          </button>
          {showTranscript && (
            <div className="mt-2" style={{ minHeight: "120px" }}>
              <ConversationPanel logs={dialogueLogs} />
            </div>
          )}
        </div>
      </div>

      {/* Pinned navigation controls */}
      <div className="shrink-0 pt-2 border-t border-white/10 bg-slate-950/80 rounded-b-2xl">
        <NavigationControls
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          answeredCount={sessionProgress.totalCompleted}
          isPaused={isPaused}
          onPrev={handlePrevQuestion}
          onNext={handleNextQuestion}
          onSkip={handleSkipQuestion}
          onRepeat={() => speakCurrentQuestion(currentQuestion?.aiSpeechText || currentQuestion?.question, currentQuestion?.section, currentQuestion?.topic)}
          onTogglePause={() => setIsPaused(!isPaused)}
          onEnd={() => setShowConfirmExit(true)}
        />
      </div>
        </>
      )}
    </div>
  );

  // RIGHT CONTEXT: camera (tech/hr) + session status + live signals + AI state
  const rightContext = (
    <div
      className="flex flex-col h-full min-h-0 gap-3 overflow-y-auto pr-1"
      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
    >
      {showAI && (
        <div className="h-[170px] shrink-0 rounded-2xl overflow-hidden border border-white/10">
          <WebcamCard
            isCameraOn={isCameraOn}
            stream={webcamStream}
            userName={candidateInfo.name}
            onRetryCamera={startWebcam}
          />
        </div>
      )}

      {/* SESSION & CURRENT ROUND STATUS */}
      <div className="shrink-0 p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Session Control</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
            <span className="text-white/50 text-[11px]">Time Remaining</span>
            <span className="font-mono font-extrabold text-sm" style={{ color: timerSeconds < 300 ? "#f87171" : "#38bdf8" }}>
              {tH}:{tM}:{tS}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/50 text-[11px]">Current Round</span>
            <span className="font-extrabold text-amber-400 text-xs tracking-wider uppercase">{currentSection}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/50 text-[11px]">Round Progress</span>
            <span className="font-bold font-mono text-white text-xs">{formattedSectionQuestionIndex} / {String(sectionTotal).padStart(2, "0")}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/50 text-[11px]">Overall Progress</span>
            <span className="font-bold font-mono text-white text-xs">{String(currentIndex).padStart(2, "0")} / {String(questions.length || 1).padStart(2, "0")}</span>
          </div>
        </div>
      </div>

      {/* LIVE SIGNALS */}
      <div className="shrink-0 p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Live Signals</p>
        <SignalRow label="MIC" on={isMicOn} />
        <SignalRow label="CAMERA" on={isCameraOn} />
        <SignalRow label="CONNECTION" on={true} />
      </div>

      {/* AI STATE ENGINE */}
      <div className="shrink-0 p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">AI Engine State</p>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
          <span
            className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0"
            style={{
              backgroundColor:
                aiStatus === "SPEAKING" ? "#10b981" :
                aiStatus === "THINKING" ? "#f59e0b" :
                aiStatus === "LISTENING" ? "#3b82f6" : "#a855f7"
            }}
          />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            {aiStatus}
          </span>
        </div>
      </div>
    </div>
  );

  if (isLoadingInterview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <h2 className="text-xl font-bold">Initializing AI Interview Session...</h2>
          <p className="text-xs text-slate-400">Loading candidate resume & blueprint questions</p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const stats = getCompletedStats();
    return (
      <CompletionScreen
        interviewId={activeInterviewId}
        candidateName={candidateInfo.name}
        answeredCount={stats.answeredCount}
        skippedCount={stats.skippedCount}
        timeTakenText={stats.timeTaken}
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
            navigate("/results");
          }, 150);
        }}
        onRestartInterview={() => {
          setTimerSeconds(totalSeconds);
          setCurrentIndex(1);
          setSavedAnswers([]);
          setDialogueLogs([]);
          setTypedResponse("");
          setCurrentCode("");
          hasIntroducedRef.current = false;
          setIsCompleted(false);
        }}
      />
    );
  }

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
          interviewType: candidateInfo.interviewType || "Real AI Interview Room",
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
          stopSpeechRecognition();
          window.speechSynthesis?.cancel();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => null);
          }
          handleSaveAnswer("answered");
          if (activeInterviewId) {
            try {
              await api.post(`/api/interview/${activeInterviewId}/complete`, {}, {
                headers: { Authorization: `Bearer ${token}` }
              });
            } catch (err) {
              console.warn("Interview completion API notice:", err);
            }
          }
          setIsCompleted(true);
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
