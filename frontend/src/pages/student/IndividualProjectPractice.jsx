import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Mic,
  MicOff,
  Keyboard,
  Radio,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  Loader2,
} from "lucide-react";

import api from "../../utils/api";
import { getAuthToken, useStudentProfile } from "../../hooks/useStudentProfile";
import { useTextToSpeech } from "../../hooks/useTextToSpeech";

// Import authoritative Real Interview Room Presentation Components
import InterviewLayout from "../../components/interview/InterviewLayout";
import AIInterviewerCard from "../../components/interview/AIInterviewerCard";
import QuestionCard from "../../components/interview/QuestionCard";
import WebcamCard from "../../components/interview/WebcamCard";
import ConversationPanel from "../../components/interview/ConversationPanel";
import NavigationControls from "../../components/interview/NavigationControls";
import ConfirmExitDialog from "../../components/interview/ConfirmExitDialog";
import SectionNavigationPanel from "../../components/interview/SectionNavigationPanel";
import FullscreenExitOverlay from "../../components/interview/FullscreenExitOverlay";
import InterviewSettingsModal from "../../components/interview/InterviewSettingsModal";
import EvaluationLoadingScreen from "../../components/interview/EvaluationLoadingScreen";

/**
 * SignalRow — compact live signal indicator (matching Real Interview Room)
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
 * IndividualProjectPractice Page Container
 * Reuses the EXACT Real Interview Room UI/UX presentation components
 * while connecting exclusively to IndividualProjectSession backend endpoints.
 */
export default function IndividualProjectPractice() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();
  const { profile } = useStudentProfile();

  // Session State
  const [sessionData, setSessionData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(1); // 1-indexed (1..10)
  const [answersMap, setAnswersMap] = useState({}); // { [questionId]: text }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [aiStatus, setAiStatus] = useState("READY"); // "SPEAKING" | "LISTENING" | "THINKING" | "READY"

  // Response & Speech State
  const [inputMode, setInputMode] = useState("speak"); // 'speak' | 'type'
  const [typedResponse, setTypedResponse] = useState("");
  const typedResponseRef = useRef("");
  const speechBaseTextRef = useRef("");
  const [dialogueLogs, setDialogueLogs] = useState([]);
  const [showTranscript, setShowTranscript] = useState(false);

  // Phase 2E Fullscreen & Media State
  const [isFullscreenExited, setIsFullscreenExited] = useState(false);
  const [isInFullscreen, setIsInFullscreen] = useState(false);
  const everEnteredFsRef = useRef(false);

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const isMicOnRef = useRef(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const webcamStreamRef = useRef(null);

  // Timer State (45 minutes default for Individual Project session)
  const totalSeconds = 45 * 60;
  const [timerSeconds, setTimerSeconds] = useState(totalSeconds);

  // Voice Settings State
  const [voiceSettings, setVoiceSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_interview_voice_settings");
      return saved ? JSON.parse(saved) : { persona: "alex", voiceURI: "", rate: 0.92, pitch: 0.90 };
    } catch (e) {
      return { persona: "alex", voiceURI: "", rate: 0.92, pitch: 0.90 };
    }
  });

  const { speak: ttsSpeak, stop: ttsStop } = useTextToSpeech();

  // Speech Recognition Ref
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const isListeningSpeechRef = useRef(false);
  const recognitionRef = useRef(null);

  // Keep refs synced
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isListeningSpeechRef.current = isListeningSpeech; }, [isListeningSpeech]);
  useEffect(() => { typedResponseRef.current = typedResponse; }, [typedResponse]);

  // Current Question accessor
  const currentQuestion = questions[currentIndex - 1] || {};
  const currentQId = currentQuestion.questionId || currentQuestion.id || "";

  // 1. Webcam Handler
  const startWebcam = useCallback(async () => {
    try {
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      webcamStreamRef.current = stream;
      setWebcamStream(stream);
      setIsCameraOn(true);
    } catch (err) {
      console.warn("[IndividualProjectPractice] Camera access warning:", err);
      setIsCameraOn(false);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
    }
    setWebcamStream(null);
  }, []);

  useEffect(() => {
    startWebcam();
    return () => stopWebcam();
  }, [startWebcam, stopWebcam]);

  // 2. Speech Recognition Setup (Frontend Native Speech Recognition)
  const stopSpeechRecognition = useCallback((manual = false) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListeningSpeech(false);
    isListeningSpeechRef.current = false;
    setAiStatus("READY");
  }, []);

  const startSpeechRecognition = useCallback(() => {
    if (!isMicOnRef.current) {
      toast.error("Microphone is muted. Unmute to speak.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicPermissionDenied(true);
      setInputMode("type");
      toast.error("Speech recognition is not supported in your browser. Switched to type mode.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }

      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = "en-US";

      speechBaseTextRef.current = typedResponseRef.current;

      recog.onstart = () => {
        setIsListeningSpeech(true);
        isListeningSpeechRef.current = true;
        setAiStatus("LISTENING");
      };

      recog.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += trans;
          } else {
            interimTranscript += trans;
          }
        }

        const base = speechBaseTextRef.current;
        const currentBatch = (finalTranscript + " " + interimTranscript).trim();
        const combined = base ? (base.trim() + " " + currentBatch).trim() : currentBatch;

        setTypedResponse(combined);
        typedResponseRef.current = combined;
      };

      recog.onerror = (event) => {
        console.warn("[SpeechRecognition] Error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setMicPermissionDenied(true);
        }
        setIsListeningSpeech(false);
        isListeningSpeechRef.current = false;
        setAiStatus("READY");
      };

      recog.onend = () => {
        setIsListeningSpeech(false);
        isListeningSpeechRef.current = false;
        setAiStatus("READY");
      };

      recognitionRef.current = recog;
      recog.start();
    } catch (err) {
      console.warn("[SpeechRecognition] Start Exception:", err);
      setIsListeningSpeech(false);
      isListeningSpeechRef.current = false;
    }
  }, []);

  const handleToggleMic = useCallback(() => {
    setIsMicOn((prev) => {
      const next = !prev;
      if (!next) {
        stopSpeechRecognition(true);
      } else if (inputMode === "speak") {
        setTimeout(() => startSpeechRecognition(), 100);
      }
      return next;
    });
  }, [inputMode, startSpeechRecognition, stopSpeechRecognition]);

  const handleToggleCamera = useCallback(() => {
    setIsCameraOn((prev) => {
      const next = !prev;
      if (next) {
        startWebcam();
      } else {
        stopWebcam();
      }
      return next;
    });
  }, [startWebcam, stopWebcam]);

  const handleToggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => !prev);
  }, []);

  // 3. Save Answer to Backend API (/api/individual/project/session/:sessionId/answer)
  const saveAnswerToBackend = useCallback(async (qId, answerText) => {
    if (!sessionId || !qId) return;
    const textToSave = (answerText || "").trim();

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await api.post(
        `/api/individual/project/session/${sessionId}/answer`,
        {
          questionId: String(qId),
          candidateAnswer: textToSave,
          inputMethod: inputMode === "speak" ? "voice" : "text",
        },
        { headers }
      );

      setAnswersMap((prev) => ({
        ...prev,
        [String(qId)]: textToSave,
      }));
    } catch (err) {
      console.warn("[IndividualProjectPractice] Save answer warning:", err.message);
    }
  }, [sessionId, token, inputMode]);

  const handleSaveCurrentAnswer = useCallback((statusLabel = "answered") => {
    if (!currentQId) return;
    saveAnswerToBackend(currentQId, typedResponse);
    toast.success("Answer saved successfully", { id: "save-ans-toast", duration: 1500 });
  }, [currentQId, typedResponse, saveAnswerToBackend]);

  // 4. Fetch / Restore Session Data
  const fetchSession = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.get(`/api/individual/project/session/${sessionId}`, { headers });

      if (data.success && data.session) {
        const sess = data.session;
        setSessionData(sess);

        if (sess.status === "COMPLETED" || sess.status === "EVALUATION_FAILED") {
          navigate(`/student/individual-project/result/${sessionId}`);
          return;
        }

        const qList = sess.questions || [];
        setQuestions(qList);

        const map = {};
        (sess.answers || []).forEach((ans) => {
          if (ans.questionId && ans.candidateAnswer) {
            map[String(ans.questionId)] = ans.candidateAnswer;
          }
        });
        setAnswersMap(map);

        if (qList.length > 0) {
          const firstQId = String(qList[0].questionId || qList[0].id || "");
          setTypedResponse(map[firstQId] || "");
          typedResponseRef.current = map[firstQId] || "";
        }
      } else {
        throw new Error(data.message || "Failed to load project practice session.");
      }
    } catch (err) {
      console.error("[IndividualProjectPractice] Load Error:", err);
      setError(err.response?.data?.message || err.message || "Unable to load project practice session.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, token, navigate]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // 5. Question Navigation Controls
  const goToQuestion = useCallback(async (newIdx) => {
    if (newIdx < 1 || newIdx > questions.length || newIdx === currentIndex) return;

    // Auto-save current question answer before moving
    if (currentQId) {
      await saveAnswerToBackend(currentQId, typedResponse);
    }

    if (isListeningSpeech) {
      stopSpeechRecognition(true);
    }

    setCurrentIndex(newIdx);

    const nextQ = questions[newIdx - 1];
    if (nextQ) {
      const nextQId = String(nextQ.questionId || nextQ.id || "");
      const restored = answersMap[nextQId] || "";
      setTypedResponse(restored);
      typedResponseRef.current = restored;
      speechBaseTextRef.current = restored;
    }
  }, [questions, currentIndex, currentQId, typedResponse, saveAnswerToBackend, isListeningSpeech, stopSpeechRecognition, answersMap]);

  const handlePrevQuestion = () => goToQuestion(currentIndex - 1);
  const handleNextQuestion = () => goToQuestion(currentIndex + 1);
  const handleSkipQuestion = () => goToQuestion(currentIndex + 1);

  // Speak current question text via TTS
  const speakCurrentQuestionText = useCallback(() => {
    const qText = currentQuestion.question || currentQuestion.title || "";
    if (!qText || !isSpeakerOn) return;
    setAiStatus("SPEAKING");
    ttsSpeak(qText, {
      voiceSettings,
      onEnd: () => setAiStatus("READY"),
      onError: () => setAiStatus("READY"),
    });
  }, [currentQuestion, isSpeakerOn, ttsSpeak, voiceSettings]);

  // 6. Timer Effect
  useEffect(() => {
    if (isLoading || isPaused || isSubmitting) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, isPaused, isSubmitting]);

  // 7. Fullscreen Gate & Integrity Effect
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
    if (isLoading || isSubmitting) return;

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
      } else if (everEnteredFsRef.current && !isSubmitting) {
        setIsFullscreenExited(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [isLoading, isSubmitting]);

  // 8. Submit Session Handler
  const handleSubmitSession = async () => {
    if (currentQId) {
      await saveAnswerToBackend(currentQId, typedResponse);
    }

    if (isListeningSpeech) {
      stopSpeechRecognition(true);
    }
    stopWebcam();

    setShowConfirmExit(false);
    setIsSubmitting(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await api.post(`/api/individual/project/session/${sessionId}/submit`, {}, { headers });
    } catch (err) {
      console.error("[IndividualProjectPractice] Submit error:", err);
    }
  };

  // Answer counts for SectionNavigationPanel & Session Control
  const answeredCount = Object.keys(answersMap).filter((k) => (answersMap[k] || "").trim().length > 0).length;

  const formattedSectionQuestionIndex = String(currentIndex).padStart(2, "0");
  const tH = String(Math.floor(timerSeconds / 3600)).padStart(2, "0");
  const tM = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0");
  const tS = String(timerSeconds % 60).padStart(2, "0");

  // RENDER: Loading Evaluation Screen
  if (isSubmitting) {
    return (
      <EvaluationLoadingScreen
        sessionId={sessionId}
        isIndividualProject={true}
        onCompleted={() => {
          navigate(`/student/individual-project/result/${sessionId}`);
        }}
      />
    );
  }

  // RENDER: Initial Loading Screen (matching Real Interview Preparation layout)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Initializing Project Practice Room...
          </h2>
          <p className="text-xs text-slate-400">
            Setting up your secure AI project & resume interview environment.
          </p>
        </div>
      </div>
    );
  }

  // RENDER: Error State
  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/30 text-center space-y-4 max-w-lg w-full">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h3 className="text-base font-bold text-red-200">Unable to Load Practice Session</h3>
          <p className="text-xs text-red-300/80 leading-relaxed">
            {error || "Project practice session questions could not be loaded."}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate("/interview-practice")}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition"
            >
              Back to Dashboard
            </button>
            <button
              onClick={fetchSession}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CENTER WORKSPACE CONTENT
  const centerWorkspace = (
    <div className="flex-1 flex flex-col h-full min-h-0 gap-3 overflow-hidden">
      {/* Cinematic AI Avatar Stage */}
      <div className="h-[260px] sm:h-[300px] shrink-0 rounded-2xl overflow-hidden border border-white/10">
        <AIInterviewerCard
          aiStatus={aiStatus}
          isGeneratingQuestion={false}
          currentQuestionText={currentQuestion?.question || currentQuestion?.title || ""}
          section="RESUME_PROJECT"
          interviewerName="Alex — AI Project Interviewer"
          interviewerRole="Senior Technical & Project Evaluator"
        />
      </div>

      {/* Main Question & Answer Zone */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        {/* Question Header & Card */}
        <div className="shrink-0 p-3 rounded-2xl bg-slate-900/90 border border-white/10 space-y-1">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-black tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
              PROJECT / RESUME — Question {formattedSectionQuestionIndex} / 10
            </span>
            <span className="text-[11px] font-bold text-white/40 font-mono">
              Progress: {String(answeredCount).padStart(2, "0")} / 10
            </span>
          </div>
          <QuestionCard
            questionText={currentQuestion?.question || currentQuestion?.title || ""}
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            difficulty={currentQuestion?.difficulty || "Medium"}
            category="Project & Resume"
            source="gemini_ai_resume"
            showQuestionText={true}
          />
        </div>

        {/* Text & Voice Response Panel */}
        <div className="rounded-2xl p-4 flex flex-col gap-3 bg-slate-900/90 border border-white/10 shadow-lg">
          {/* Header: Input Mode Selector + Live Mic Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setInputMode("speak");
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
                <span>Voice Response</span>
              </button>
              <button
                onClick={() => {
                  stopSpeechRecognition(true);
                  setInputMode("type");
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

            {/* Status Indicator Badge */}
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

          {/* Transcript / Textarea Area */}
          <div className="relative">
            <textarea
              value={typedResponse}
              onChange={(e) => {
                setTypedResponse(e.target.value);
                typedResponseRef.current = e.target.value;
              }}
              placeholder={
                inputMode === "speak"
                  ? "Speak your project response... Your spoken words will appear here in real-time."
                  : "Type your detailed project answer here..."
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
                onClick={() => handleSaveCurrentAnswer("answered")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-blue-600/25"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Save Answer
              </button>
            )}
          </div>
        </div>

        {/* Conversation Panel (Collapsible) */}
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

      {/* Pinned Bottom Navigation Controls */}
      <div className="shrink-0 pt-2 border-t border-white/10 bg-slate-950/80 rounded-b-2xl">
        <NavigationControls
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          answeredCount={answeredCount}
          isPaused={isPaused}
          onPrev={handlePrevQuestion}
          onNext={handleNextQuestion}
          onSkip={handleSkipQuestion}
          onRepeat={speakCurrentQuestionText}
          onTogglePause={() => setIsPaused(!isPaused)}
          onEnd={() => setShowConfirmExit(true)}
        />
      </div>
    </div>
  );

  // RIGHT CONTEXT COLUMN (Camera + Session Control + Signals + AI Engine State)
  const rightContext = (
    <div
      className="flex flex-col h-full min-h-0 gap-3 overflow-y-auto pr-1"
      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
    >
      <div className="h-[170px] shrink-0 rounded-2xl overflow-hidden border border-white/10">
        <WebcamCard
          isCameraOn={isCameraOn}
          stream={webcamStream}
          userName={profile?.name || "Candidate"}
          onRetryCamera={startWebcam}
        />
      </div>

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
            <span className="font-extrabold text-cyan-400 text-xs tracking-wider uppercase">PROJECT / RESUME</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/50 text-[11px]">Round Progress</span>
            <span className="font-bold font-mono text-white text-xs">{formattedSectionQuestionIndex} / 10</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/50 text-[11px]">Overall Progress</span>
            <span className="font-bold font-mono text-white text-xs">{String(currentIndex).padStart(2, "0")} / {String(questions.length || 10).padStart(2, "0")}</span>
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

  return (
    <div className="relative bg-slate-950 min-h-screen text-white select-none">
      {/* Fullscreen Overlay Gate */}
      <FullscreenExitOverlay
        isOpen={isFullscreenExited}
        onReenterFullscreen={handleReenterFullscreen}
      />

      {/* Mic Permission Banner */}
      {micPermissionDenied && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-xs font-semibold text-amber-300 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Microphone access is unavailable. Text fallback mode enabled so you can continue your project practice seamlessly.</span>
          </div>
          <button
            onClick={() => setInputMode("type")}
            className="px-3 py-1 bg-amber-500/30 hover:bg-amber-500/40 rounded-lg text-[11px] font-bold text-white cursor-pointer"
          >
            Use Text Editor
          </button>
        </div>
      )}

      {/* Main Authoritative Interview Room Layout */}
      <InterviewLayout
        isPaused={isPaused}
        onResume={() => setIsPaused(false)}

        headerProps={{
          timerSeconds,
          totalSeconds,
          interviewType: "Project / Resume Practice",
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

        /* FAR LEFT: Section Navigation Panel (RESUME_PROJECT mode) */
        sectionPanel={
          <SectionNavigationPanel
            activeSection="RESUME_PROJECT"
            targetRound="RESUME_PROJECT"
            onSelectSection={() => {}}
            sectionProgress={{
              RESUME_PROJECT: { completed: answeredCount, total: 10 },
              totalCompleted: answeredCount,
              totalQuestions: 10,
            }}
          />
        }

        /* CENTER: AI Avatar stage + Question Card + Answer Text/Voice Zone + Pinned Nav Controls */
        leftPanel={centerWorkspace}

        centerPanel={null}

        /* RIGHT: Camera stream + Session Status + Live Signals + AI State Engine */
        rightPanel={rightContext}
      />

      {/* Confirm End/Submit Exit Dialog */}
      <ConfirmExitDialog
        isOpen={showConfirmExit}
        open={showConfirmExit}
        onClose={() => setShowConfirmExit(false)}
        onConfirm={handleSubmitSession}
      />

      {/* Voice & TTS Settings Modal */}
      <InterviewSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        voiceSettings={voiceSettings}
        onSaveVoiceSettings={(newSet) => {
          setVoiceSettings(newSet);
          try {
            localStorage.setItem("ai_interview_voice_settings", JSON.stringify(newSet));
          } catch (e) {}
        }}
        currentSection="RESUME_PROJECT"
      />
    </div>
  );
}
