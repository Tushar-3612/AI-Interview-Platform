import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Bot, Sparkles, Mic, MicOff, CheckCircle2, Keyboard, Loader2, Play, Code2, AlertTriangle, UserCheck, Target, BrainCircuit, Maximize2 } from "lucide-react";

import api from "../../utils/api";
import { getAuthToken, useStudentProfile } from "../../hooks/useStudentProfile";
import { useTextToSpeech } from "../../hooks/useTextToSpeech";
import { getVoiceProfile, selectOptimalVoice } from "../../config/voiceProfiles";

// Import reusable components
import InterviewLayout from "../../components/interview/InterviewLayout";
import AIInterviewerCard from "../../components/interview/AIInterviewerCard";
import QuestionCard from "../../components/interview/QuestionCard";
import WebcamCard from "../../components/interview/WebcamCard";
import ConversationPanel from "../../components/interview/ConversationPanel";
import NavigationControls from "../../components/interview/NavigationControls";
import ConfirmExitDialog from "../../components/interview/ConfirmExitDialog";
import CompletionScreen from "../../components/interview/CompletionScreen";
import SectionNavigationPanel from "../../components/interview/SectionNavigationPanel";
import FullscreenExitOverlay from "../../components/interview/FullscreenExitOverlay";

// Import Monaco editor & Output panel for Coding questions
import MonacoCodeEditor from "../../components/coding/MonacoCodeEditor";
import OutputPanel from "../../components/coding/OutputPanel";

// Import mock fallback data if session fails
import { MOCK_QUESTIONS, MOCK_CANDIDATE } from "../../data/interviewMockData";

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
  const [currentIndex, setCurrentIndex] = useState(1); // 1-indexed (1 to 58)
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [aiStatus, setAiStatus] = useState("SPEAKING"); // "SPEAKING" | "LISTENING" | "THINKING" | "READY"

  // Phase 2E Integrity State
  const [isFullscreenExited, setIsFullscreenExited] = useState(false);

  // Intro state
  const hasIntroducedRef = useRef(false);

  // Response content state
  const [inputMode, setInputMode] = useState("speak"); // 'speak' | 'type'
  const [typedResponse, setTypedResponse] = useState("");
  const [savedAnswers, setSavedAnswers] = useState([]);
  const [dialogueLogs, setDialogueLogs] = useState([]);

  // Coding state (Questions 51-53)
  const [codingLanguage, setCodingLanguage] = useState("python");
  const [currentCode, setCurrentCode] = useState("");
  const [compilerOutput, setCompilerOutput] = useState(null);
  const [isRunningCode, setIsRunningCode] = useState(false);

  // Candidate Info State
  const [candidateInfo, setCandidateInfo] = useState({
    name: routerState.candidateName || profile.name || MOCK_CANDIDATE.name,
    resumeName: routerState.resumeFileName || profile.resumeFileName || MOCK_CANDIDATE.resumeName,
    interviewType: "Real AI Interview Room",
    difficulty: "Adaptive",
    totalTimeMinutes: 60,
  });

  const [isLoadingInterview, setIsLoadingInterview] = useState(true);

  // Media & STT state
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const isSpeakerOnRef = useRef(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  // Webcam stream
  const [webcamStream, setWebcamStream] = useState(null);
  const webcamStreamRef = useRef(null);

  // Session timer (60 minutes for 58 questions)
  const totalSeconds = 60 * 60;
  const [timerSeconds, setTimerSeconds] = useState(totalSeconds);

  // Speech Recognition & Silence Buffer
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const recognitionRef = useRef(null);
  const speechBaseTextRef = useRef("");
  const silenceTimerRef = useRef(null);

  // TTS Hook
  const { speak: ttsSpeak, stop: ttsStop } = useTextToSpeech();

  const currentQuestion = questions[currentIndex - 1] || {};
  const currentSection = currentQuestion.section || "APTITUDE";

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

    // Request fullscreen on startup
    const timer = setTimeout(() => {
      handleReenterFullscreen();
    }, 500);

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

      if (!isFS && !isCompleted && !isLoadingInterview) {
        setIsFullscreenExited(true);
        window.speechSynthesis?.cancel();
        logIntegrityEvent("FULLSCREEN_EXIT", "Candidate exited browser fullscreen mode");
      } else if (isFS) {
        setIsFullscreenExited(false);
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

  // ─── PHASE 2E: TAB VISIBILITY SWITCH DETECTION ───
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isCompleted && !isLoadingInterview) {
        logIntegrityEvent("TAB_SWITCH", "Candidate switched active tab or minimized browser window");
      } else if (!document.hidden && !isCompleted && !isLoadingInterview) {
        toast("Security Event Logged: Tab switch detected during session.", { icon: "⚠️" });
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
      toast.error("Copy action restricted for interview security.");
      logIntegrityEvent("COPY_ATTEMPT", "Copy attempted outside code editor");
    };

    const handlePaste = (e) => {
      if (isMonacoTarget(e.target)) return; // Allow Monaco IDE paste!
      e.preventDefault();
      toast.error("Paste action restricted for interview security.");
      logIntegrityEvent("PASTE_ATTEMPT", "Paste attempted outside code editor");
    };

    const handleContextMenu = (e) => {
      if (isMonacoTarget(e.target)) return; // Allow Monaco IDE right-click context menu!
      e.preventDefault();
      toast.error("Right-click context menu restricted.");
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
    setIsSpeakerOn((prev) => {
      const next = !prev;
      isSpeakerOnRef.current = next;
      if (!next) {
        ttsStop();
        window.speechSynthesis?.cancel();
        setAiStatus("LISTENING");
        toast("Interviewer audio muted");
      } else {
        toast("Interviewer audio unmuted");
      }
      return next;
    });
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
    } catch (err) {
      console.warn("Webcam access warning:", err);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
      setWebcamStream(null);
    }
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
    setIsMicOn((prev) => {
      const next = !prev;
      if (!next && isListeningSpeech) stopSpeechRecognition();
      return next;
    });
  }, [isListeningSpeech]);

  useEffect(() => {
    startWebcam();
    return () => stopWebcam();
  }, []);

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

        if (data.generatedQuestions && data.generatedQuestions.length > 0) {
          setQuestions(data.generatedQuestions);
        } else {
          setQuestions(MOCK_QUESTIONS);
        }

        if (data.answers && Array.isArray(data.answers)) {
          setSavedAnswers(data.answers);
        }

        if (data.currentQuestionIndex) {
          setCurrentIndex(Number(data.currentQuestionIndex) || 1);
        }

        if (data.candidateProfile) {
          setCandidateInfo({
            name: data.candidateProfile.candidateName || profile.name || MOCK_CANDIDATE.name,
            resumeName: data.resumeFileName || profile.resumeFileName || "Uploaded_Resume.pdf",
            interviewType: "Real AI Interview Room",
            difficulty: "Adaptive",
            totalTimeMinutes: 60,
          });
        }
      } catch (err) {
        console.error("Session load error:", err);
        setQuestions(MOCK_QUESTIONS);
      } finally {
        setIsLoadingInterview(false);
      }
    };

    loadSession();
  }, [paramSessionId]);

  // ─── REAL SECTION PROGRESS CALCULATIONS ───
  const getSectionProgress = useCallback(() => {
    const counts = {
      APTITUDE: { completed: 0, total: 25 },
      TECHNICAL: { completed: 0, total: 25 },
      CODING: { completed: 0, total: 3 },
      HR: { completed: 0, total: 5 },
      totalCompleted: 0,
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

  // ─── SECTION NAVIGATION HANDLER ───
  const handleSelectSection = (targetSection) => {
    const sectionQuestions = questions.filter((q) => q.section === targetSection);
    if (!sectionQuestions.length) return;

    const answeredIds = new Set(
      savedAnswers
        .filter((a) => a.answer && String(a.answer).trim().length > 0)
        .map((a) => String(a.questionId))
    );

    const firstUnanswered = sectionQuestions.find((q) => !answeredIds.has(String(q.id || q.questionId)));
    const targetQuestion = firstUnanswered || sectionQuestions[0];
    const targetIdx = questions.findIndex((q) => (q.id || q.questionId) === (targetQuestion.id || targetQuestion.questionId));

    if (targetIdx !== -1) {
      stopSpeechRecognition();
      window.speechSynthesis?.cancel();
      handleSaveAnswer("answered");
      setCurrentIndex(targetIdx + 1);
      toast.success(`Switched to ${targetSection} section`);
    }
  };

  // ─── TIMER COUNTDOWN ───
  useEffect(() => {
    if (isLoadingInterview || isFullscreenExited) return;
    let interval;
    if (!isPaused && !isCompleted && !isGeneratingQuestion && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, isCompleted, isGeneratingQuestion, timerSeconds, isFullscreenExited, isLoadingInterview]);

  // ─── AI INTERVIEWER SPEECH PLAYBACK LAYER ───
  const speakCurrentQuestion = useCallback((text, section, topic) => {
    if (!text || !isSpeakerOnRef.current || isFullscreenExited) {
      setAiStatus("LISTENING");
      return;
    }

    setAiStatus("SPEAKING");

    if (section === "APTITUDE") {
      setAiStatus("LISTENING");
      return;
    }

    window.speechSynthesis?.cancel();

    api.post("/api/interview/tts", { text, persona: section === "HR" ? "hr" : "technical" }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => null);

    const profileConfig = getVoiceProfile(section, topic);
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = section === "HR" ? 0.94 : 0.90;
    utterance.pitch = section === "HR" ? 0.92 : 0.86;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis?.getVoices() || [];
    const optimalVoice = selectOptimalVoice(voices);
    if (optimalVoice) utterance.voice = optimalVoice;

    utterance.onstart = () => setAiStatus("SPEAKING");
    utterance.onend = () => {
      setAiStatus("LISTENING");
      if (inputMode === "speak" && isMicOn && !micPermissionDenied) {
        startSpeechRecognition();
      }
    };

    utterance.onerror = (e) => {
      console.warn("TTS Error:", e);
      setAiStatus("LISTENING");
    };

    window.speechSynthesis?.speak(utterance);
  }, [token, inputMode, isMicOn, micPermissionDenied, isFullscreenExited]);

  // ─── INTRO & QUESTION TRANSITION HANDLER ───
  useEffect(() => {
    if (isCompleted || isPaused || isLoadingInterview || isFullscreenExited) return;

    const section = currentQuestion.section || "APTITUDE";
    const speechText = currentQuestion?.aiSpeechText || currentQuestion?.question || "";

    if (currentIndex === 1 && !hasIntroducedRef.current) {
      hasIntroducedRef.current = true;
      const introText = `Good day ${candidateInfo.name || "Candidate"}. I am Alex, your senior AI interviewer. I have reviewed your background and resume details. We will begin with Aptitude evaluations. Let's start with your first question.`;

      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDialogueLogs([{ sender: "AI", text: introText, time: timeNow }]);

      setAiStatus("SPEAKING");
      window.speechSynthesis?.cancel();
      const introUtterance = new SpeechSynthesisUtterance(introText);
      introUtterance.rate = 0.90;
      introUtterance.pitch = 0.88;
      const voices = window.speechSynthesis?.getVoices() || [];
      const optimalVoice = selectOptimalVoice(voices);
      if (optimalVoice) introUtterance.voice = optimalVoice;

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

    const qId = currentQuestion.id || currentQuestion.questionId;
    const existing = savedAnswers.find((ans) => ans.questionId === qId);
    if (existing) {
      if (section === "CODING") {
        setCurrentCode(existing.answer);
      } else {
        setTypedResponse(existing.answer);
      }
    } else {
      setTypedResponse("");
      setCurrentCode(currentQuestion.starterCode || "def solution():\n    pass");
    }

    setCompilerOutput(null);
  }, [currentIndex, isLoadingInterview, isGeneratingQuestion, isFullscreenExited]);

  // ─── SPEECH RECOGNITION (STT) ───
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicPermissionDenied(true);
      toast.error("Speech Recognition is not supported by your browser. Text mode enabled.");
      setInputMode("type");
      return;
    }

    if (isListeningSpeech || isFullscreenExited) return;

    speechBaseTextRef.current = typedResponse;

    try {
      const rec = new SpeechRecognition();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListeningSpeech(true);
        setAiStatus("LISTENING");
        setMicPermissionDenied(false);
      };

      rec.onresult = (event) => {
        let sessionTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          sessionTranscript += event.results[i][0].transcript;
        }
        const separator = speechBaseTextRef.current ? " " : "";
        const fullTranscript = (speechBaseTextRef.current + separator + sessionTranscript).trim();
        setTypedResponse(fullTranscript);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (fullTranscript.length > 10) {
            toast("Silence detected. Answer transcript buffer ready.", { icon: "🎙️" });
          }
        }, 3500);
      };

      rec.onerror = (e) => {
        console.warn("Speech Recognition Warning:", e.error);
        if (e.error === "not-allowed" || e.error === "permission-denied") {
          setMicPermissionDenied(true);
          setInputMode("type");
          toast.error("Microphone access denied. Switched to Text fallback.");
        }
        setIsListeningSpeech(false);
      };

      rec.onend = () => setIsListeningSpeech(false);

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error(err);
      setIsListeningSpeech(false);
    }
  };

  const stopSpeechRecognition = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListeningSpeech(false);
  };

  // ─── SAVE ANSWER TO BACKEND ───
  const handleSaveAnswer = async (statusType = "answered", customAns = null) => {
    stopSpeechRecognition();
    const section = currentQuestion.section || "APTITUDE";
    const finalAnswerText = customAns !== null ? customAns : (section === "CODING" ? currentCode : typedResponse);

    const qId = currentQuestion.id || currentQuestion.questionId || `Q-${currentIndex}`;

    const answerRecord = {
      questionId: qId,
      questionText: currentQuestion.question,
      category: currentQuestion.category || section.toLowerCase(),
      section,
      answer: finalAnswerText,
      transcript: finalAnswerText,
      inputMethod: inputMode === "speak" ? "VOICE" : "TEXT",
      status: statusType
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
          currentQuestionIndex: currentIndex,
        }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        console.error("Save answer error:", err);
      }
    }

    setSavedAnswers((prev) => {
      const filtered = prev.filter((ans) => ans.questionId !== qId);
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

  // ─── CODING COMPILER RUN ───
  const handleRunCoding = async () => {
    setIsRunningCode(true);
    const toastId = toast.loading("Executing code via compiler...");
    try {
      const langMap = { python: 71, java: 62, c: 50, cpp: 54, javascript: 63 };
      const langId = langMap[codingLanguage] || 71;

      const { data } = await api.post("/api/code/run", {
        sourceCode: currentCode,
        languageId: langId,
        input: currentQuestion.sampleInput || ""
      }, { headers: { Authorization: `Bearer ${token}` } });

      setCompilerOutput(data);
      toast.success("Code executed!", { id: toastId });
    } catch (err) {
      console.error("Compiler error:", err);
      setCompilerOutput({
        status: "Error",
        stderr: err.response?.data?.message || "Execution failed."
      });
      toast.error("Execution error", { id: toastId });
    } finally {
      setIsRunningCode(false);
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
    const answered = savedAnswers.filter((a) => a.status === "answered" && a.answer?.trim()).length;
    const skipped = Math.max(0, questions.length - answered);
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
  const sectionTotal = sectionQuestions.length || (currentSection === "APTITUDE" ? 25 : currentSection === "TECHNICAL" ? 25 : currentSection === "CODING" ? 3 : 5);
  const questionIdxInSection = sectionQuestions.findIndex((q) => (q.id || q.questionId) === (currentQuestion.id || currentQuestion.questionId)) + 1;
  const formattedSectionQuestionIndex = questionIdxInSection > 0 ? String(questionIdxInSection).padStart(2, "0") : "01";

  if (isLoadingInterview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <h2 className="text-xl font-bold">Initializing Real 58-Question AI Session...</h2>
          <p className="text-xs text-slate-400">Loading candidate resume & blueprint questions</p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const stats = getCompletedStats();
    return (
      <CompletionScreen
        candidateName={candidateInfo.name}
        answeredCount={stats.answeredCount}
        skippedCount={stats.skippedCount}
        timeTakenText={stats.timeTaken}
        onReturnDashboard={() => navigate("/dashboard")}
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
          onSettings: () => toast("Settings menu"),
        }}

        /* FAR LEFT: Persistent Section Navigation Panel */
        sectionPanel={
          <SectionNavigationPanel
            activeSection={currentSection}
            onSelectSection={handleSelectSection}
            sectionProgress={getSectionProgress()}
          />
        }

        /* CENTER LEFT: Cinematic AI Avatar Stage with 4 States */
        leftPanel={
          <AIInterviewerCard
            aiStatus={aiStatus}
            isGeneratingQuestion={isGeneratingQuestion}
            currentQuestionText={currentQuestion?.aiSpeechText || currentQuestion?.question || ""}
          />
        }

        centerPanel={null}

        /* RIGHT: Main Question & Section Response Column */
        rightPanel={
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <div
              className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-2"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
            >

              {/* 1. Candidate PiP Preview */}
              <div className="shrink-0" style={{ height: "135px" }}>
                <WebcamCard
                  isCameraOn={isCameraOn}
                  stream={webcamStream}
                  userName={candidateInfo.name}
                  onRetryCamera={startWebcam}
                />
              </div>

              {/* 2. Question Section Header & Overall Progress */}
              <div className="shrink-0 p-3 rounded-2xl bg-slate-900/90 border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
                    {currentSection === "APTITUDE" ? "🎯 APTITUDE" : currentSection === "TECHNICAL" ? "🧠 TECHNICAL" : currentSection === "CODING" ? "💻 CODING" : "👔 HR"} — Question {formattedSectionQuestionIndex} / {String(sectionTotal).padStart(2, "0")}
                  </span>
                  <span className="text-[11px] font-bold text-white/40 font-mono">
                    Overall: {String(currentIndex).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}
                  </span>
                </div>

                <QuestionCard
                  questionText={currentQuestion?.question}
                  currentIndex={currentIndex}
                  totalQuestions={questions.length}
                  difficulty={currentQuestion?.difficulty || "Medium"}
                  category={currentQuestion?.category || currentQuestion?.section || "Technical"}
                  estimatedTime={currentSection === "CODING" ? "10 mins" : "2 mins"}
                />
              </div>

              {/* 3. SECTION SPECIFIC ANSWER CONTENT AREA */}
              <div className="shrink-0">

                {/* ── A. CODING SECTION (Questions 51–53) ── */}
                {(currentSection === "CODING" || currentQuestion.type === "coding") ? (
                  <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/90 border border-white/10">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Compiler Workspace</span>
                      </div>
                      <select
                        value={codingLanguage}
                        onChange={(e) => setCodingLanguage(e.target.value)}
                        className="bg-slate-800 border border-white/10 text-xs text-white rounded-lg px-2.5 py-1 outline-none cursor-pointer"
                      >
                        <option value="python">Python 3</option>
                        <option value="java">Java 17</option>
                        <option value="cpp">C++ 17</option>
                        <option value="c">C Language</option>
                      </select>
                    </div>

                    <div className="h-64 rounded-xl overflow-hidden border border-white/10">
                      <MonacoCodeEditor
                        value={currentCode}
                        onChange={(val) => setCurrentCode(val || "")}
                        language={codingLanguage}
                        theme="vs-dark"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleRunCoding}
                        disabled={isRunningCode}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                      >
                        {isRunningCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Run Code
                      </button>
                    </div>

                    {compilerOutput && (
                      <div className="mt-2">
                        <OutputPanel output={compilerOutput} />
                      </div>
                    )}
                  </div>
                ) : (currentSection === "APTITUDE" || (currentQuestion.options && currentQuestion.options.length > 0)) ? (
                  
                  /* ── B. APTITUDE MCQ SECTION (Questions 1–25) ── */
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

                  /* ── C. TECHNICAL & HR VOICE/TEXT SECTION ── */
                  <div className="rounded-2xl p-3 flex flex-col gap-2 bg-slate-900/90 border border-white/10">
                    <div className="flex gap-1.5 pb-2 border-b border-white/10">
                      <button
                        onClick={() => { stopSpeechRecognition(); setInputMode("type"); }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        style={{
                          background: inputMode === "type" ? "#2563eb" : "rgba(255,255,255,0.06)",
                          color: inputMode === "type" ? "#fff" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        <Keyboard className="w-3 h-3" /> Type Text
                      </button>
                      <button
                        onClick={() => { setInputMode("speak"); if (!isListeningSpeech) startSpeechRecognition(); }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        style={{
                          background: inputMode === "speak" ? "#2563eb" : "rgba(255,255,255,0.06)",
                          color: inputMode === "speak" ? "#fff" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        <Mic className="w-3 h-3" /> Voice Response
                      </button>
                      <span className="ml-auto text-[9px] text-white/25 self-center">{typedResponse.length} chars</span>
                    </div>

                    <textarea
                      value={typedResponse}
                      onChange={(e) => setTypedResponse(e.target.value)}
                      placeholder={inputMode === "speak" ? "Speak your answer — STT transcript appears here automatically…" : "Type your technical response here…"}
                      disabled={isPaused}
                      rows={3}
                      className="w-full rounded-xl p-2.5 text-xs outline-none resize-none bg-white/5 border border-white/10 text-white/90 focus:border-blue-500"
                    />

                    {inputMode === "speak" && (
                      <div className="flex gap-2">
                        <button
                          onClick={startSpeechRecognition}
                          disabled={isPaused || !isMicOn}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-40"
                          style={{
                            background: isListeningSpeech ? "rgba(239,68,68,0.2)" : "rgba(37,99,235,0.15)",
                            border: `1px solid ${isListeningSpeech ? "rgba(239,68,68,0.4)" : "rgba(37,99,235,0.3)"}`,
                            color: isListeningSpeech ? "#f87171" : "#60a5fa",
                          }}
                        >
                          {isListeningSpeech ? <><MicOff className="w-3.5 h-3.5 animate-pulse" /> Listening (3.5s Buffer)</> : <><Mic className="w-3.5 h-3.5" /> Speak Answer</>}
                        </button>
                        {typedResponse.trim().length > 0 && (
                          <button
                            onClick={() => handleSaveAnswer("answered")}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-all"
                          >
                            Save Answer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. Live Conversation & STT Transcript */}
              <div className="shrink-0" style={{ minHeight: "140px" }}>
                <ConversationPanel logs={dialogueLogs} />
              </div>
            </div>

            {/* Pinned Navigation Controls */}
            <div className="shrink-0 pt-2 border-t border-white/10 bg-slate-950/90 backdrop-blur-md">
              <NavigationControls
                currentIndex={currentIndex}
                totalQuestions={questions.length}
                isPaused={isPaused}
                onPrev={handlePrevQuestion}
                onNext={handleNextQuestion}
                onSkip={handleSkipQuestion}
                onRepeat={() => speakCurrentQuestion(currentQuestion?.aiSpeechText || currentQuestion?.question, currentQuestion?.section, currentQuestion?.topic)}
                onTogglePause={() => setIsPaused(!isPaused)}
                onEnd={() => setShowConfirmExit(true)}
              />
            </div>
          </div>
        }
      />

      <ConfirmExitDialog
        isOpen={showConfirmExit}
        onClose={() => setShowConfirmExit(false)}
        onConfirm={() => {
          setShowConfirmExit(false);
          setIsCompleted(true);
        }}
      />
    </div>
  );
}

export default StartInterview;
