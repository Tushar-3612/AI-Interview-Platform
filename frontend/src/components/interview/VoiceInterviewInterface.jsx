import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Square,
  Sparkles,
  Brain,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ChevronRight,
  RefreshCw,
  Terminal,
  Edit3,
  Check,
  Radio,
  AudioWaveform,
  Award,
  Send
} from "lucide-react";
import AudioVisualizer from "./AudioVisualizer";
import { useTextToSpeech } from "../../hooks/useTextToSpeech";
import { getVoiceProfile } from "../../config/voiceProfiles";
import api from "../../utils/api";
import toast from "react-hot-toast";

/**
 * VOICE INTERVIEW UI STATES:
 * - IDLE
 * - SPEAKING
 * - LISTENING
 * - THINKING
 * - EVALUATING
 * - FOLLOW_UP
 * - COMPLETED
 * - ERROR
 */

const STATE_CONFIG = {
  IDLE: {
    label: "IDLE",
    statusText: "Ready to start voice interview",
    badgeBg: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    dotColor: "#94a3b8",
    icon: Square,
    message: "Click 'Start Interview' or toggle the microphone to begin."
  },
  SPEAKING: {
    label: "SPEAKING",
    statusText: "🔊 AI Interviewer is speaking...",
    badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dotColor: "#10b981",
    icon: Volume2,
    message: "Listen carefully to the question spoken by the AI."
  },
  LISTENING: {
    label: "LISTENING",
    statusText: "🎙️ Listening...",
    badgeBg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dotColor: "#3b82f6",
    icon: Mic,
    message: "Speak clearly into your microphone to record your response."
  },
  THINKING: {
    label: "THINKING",
    statusText: "⏳ Sending transcript to backend...",
    badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotColor: "#f59e0b",
    icon: Loader2,
    message: "Sending final speech transcript to backend evaluation API."
  },
  EVALUATING: {
    label: "EVALUATING",
    statusText: "🧠 Gemini AI evaluating answer...",
    badgeBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    dotColor: "#a855f7",
    icon: Brain,
    message: "Scoring technical accuracy, depth, and feedback via Gemini 2.5."
  },
  FOLLOW_UP: {
    label: "FOLLOW_UP",
    statusText: "🔄 Preparing next question...",
    badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    dotColor: "#06b6d4",
    icon: RefreshCw,
    message: "Advancing interview session to the next question node."
  },
  COMPLETED: {
    label: "COMPLETED",
    statusText: "✅ Voice Interview Completed!",
    badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    dotColor: "#34d399",
    icon: CheckCircle2,
    message: "All questions completed. Compiling final placement scorecard."
  },
  ERROR: {
    label: "ERROR",
    statusText: "⚠️ System / API Error",
    badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    dotColor: "#f43f5e",
    icon: AlertCircle,
    message: "Unable to connect to backend evaluation API or speech error."
  }
};

const DEFAULT_QUESTIONS = [
  {
    id: "Q1",
    question: "Can you explain the core difference between SQL and NoSQL databases, and when you would choose one over the other?",
    topic: "Database Architecture",
    section: "Technical",
    difficulty: "Medium"
  },
  {
    id: "Q2",
    question: "Describe a complex project you built recently. What architectural decisions did you make, and how did you tackle challenges?",
    topic: "System Design",
    section: "Resume / Project",
    difficulty: "Hard"
  },
  {
    id: "Q3",
    question: "How do JavaScript Promises and Async/Await work under the hood with the Event Loop?",
    topic: "Web Engineering",
    section: "Technical",
    difficulty: "Medium"
  }
];

function VoiceInterviewInterface({
  interviewId = null,
  token = null,
  questions = DEFAULT_QUESTIONS,
  onSaveAnswer = null,
  onFinish = null,
  onStateChange = null
}) {
  // Voice Interface & STT States
  const [currentState, setCurrentState] = useState("IDLE");
  const [micPermission, setMicPermission] = useState("granted");
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [activeFollowUp, setActiveFollowUp] = useState(null); // { question, reason, parentQuestionId }
  
  // Custom TTS Hook
  const tts = useTextToSpeech();

  // Speech Recognition States
  const [isSupported, setIsSupported] = useState(true);
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  
  const recognitionRef = useRef(null);
  const activeQuestion = questions[currentQIndex] || DEFAULT_QUESTIONS[0];
  const stateMeta = STATE_CONFIG[currentState] || STATE_CONFIG.IDLE;
  const activeProfile = getVoiceProfile(activeQuestion.section, activeQuestion.topic);

  // Sync state change callback
  useEffect(() => {
    if (onStateChange) onStateChange(currentState);
  }, [currentState, onStateChange]);

  // Web Speech API Initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setMicPermission("not_supported");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecognitionActive(true);
        setMicPermission("granted");
        setCurrentState("LISTENING");
        setErrorMessage("");
      };

      recognition.onresult = (event) => {
        let currentInterim = "";
        let currentFinal = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinal += chunk + " ";
          } else {
            currentInterim += chunk;
          }
        }

        if (currentFinal) {
          setFinalTranscript((prev) => {
            const updated = (prev + " " + currentFinal).trim();
            setCandidateAnswer(updated);
            return updated;
          });
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event) => {
        console.warn("Speech Recognition Event Error:", event.error);
        setIsRecognitionActive(false);

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setMicPermission("denied");
          setCurrentState("ERROR");
          setErrorMessage("Microphone permission denied by browser settings.");
        } else if (event.error === "no-speech") {
          setErrorMessage("No speech detected. Speak into your microphone or try again.");
        } else if (event.error === "audio-capture") {
          setMicPermission("denied");
          setCurrentState("ERROR");
          setErrorMessage("No hardware microphone found on this device.");
        } else if (event.error !== "aborted") {
          setErrorMessage(`Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsRecognitionActive(false);
        setInterimTranscript("");
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Speech Recognition setup error:", e);
      setIsSupported(false);
      setMicPermission("not_supported");
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Request Microphone Permission / Start Recording
  const handleToggleListening = () => {
    if (!isSupported) {
      setCurrentState("ERROR");
      setErrorMessage("Web Speech API is not supported in this browser. Use Chrome/Edge or type manually below.");
      return;
    }

    if (tts.isSpeaking) {
      tts.stop();
    }

    if (isRecognitionActive) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {}
      setIsRecognitionActive(false);
    } else {
      setErrorMessage("");
      setInterimTranscript("");
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }
  };

  // Helper to trigger AI Question Text-to-Speech
  const speakAIQuestion = (text, topic) => {
    if (isAudioMuted) {
      setCurrentState("LISTENING");
      handleToggleListening();
      return;
    }

    tts.speak(text, topic, {
      onStart: () => {
        setCurrentState("SPEAKING");
      },
      onEnd: () => {
        setCurrentState("LISTENING");
        setTimeout(() => {
          handleToggleListening();
        }, 400);
      },
      onError: () => {
        setCurrentState("LISTENING");
        handleToggleListening();
      }
    });
  };

  const addTranscriptEntry = (speaker, text) => {
    setTranscriptHistory((prev) => [
      ...prev,
      {
        id: Date.now(),
        speaker,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);
  };

  // State Transition Sequence Demo for UI Verification
  const runMockSequence = () => {
    if (currentState === "COMPLETED") {
      setCurrentState("IDLE");
      setCurrentQIndex(0);
      setFinalTranscript("");
      setCandidateAnswer("");
      setTranscriptHistory([]);
      setActiveFollowUp(null);
      tts.stop();
      return;
    }

    setCurrentState("SPEAKING");
    addTranscriptEntry("AI Interviewer", activeQuestion.question);

    setTimeout(() => {
      setCurrentState("LISTENING");
      setInterimTranscript("Processing live candidate speech stream...");
      setFinalTranscript("In SQL databases, data is structured in relational tables with strict schemas...");
      setCandidateAnswer("In SQL databases, data is structured in relational tables with strict schemas...");
    }, 2000);

    setTimeout(() => {
      setInterimTranscript("");
      setCurrentState("THINKING");
    }, 4500);

    setTimeout(() => {
      setCurrentState("EVALUATING");
      setLastEvaluation({
        score: 88,
        feedback: "Good explanation of database relational schema structure and constraints."
      });
      addTranscriptEntry("AI Evaluator", "[Score: 88/100] Good explanation of database relational schema structure and constraints.");
    }, 6500);

    setTimeout(() => {
      setCurrentState("FOLLOW_UP");
      setActiveFollowUp({
        question: "You mentioned relational schemas. How do foreign key constraints enforce referential integrity under delete operations?",
        reason: "Probing referential integrity"
      });
      addTranscriptEntry("AI Interviewer (Follow-up)", "You mentioned relational schemas. How do foreign key constraints enforce referential integrity under delete operations?");
    }, 8500);
  };

  // Primary Action Controls
  const handleStartInterview = () => {
    if (micPermission === "denied") {
      setCurrentState("ERROR");
      return;
    }
    addTranscriptEntry("AI Interviewer", activeQuestion.question);
    speakAIQuestion(activeQuestion.question, activeQuestion.topic || activeQuestion.section);
  };

  const handleStopCancel = () => {
    tts.stop();
    if (isRecognitionActive) {
      try { recognitionRef.current?.stop(); } catch (e) {}
    }
    setCurrentState("IDLE");
    setInterimTranscript("");
  };

  const handleRepeatQuestion = () => {
    if (currentState === "COMPLETED") return;
    if (isRecognitionActive) {
      try { recognitionRef.current?.stop(); } catch (e) {}
    }
    addTranscriptEntry("AI Interviewer", `(Replaying) ${activeQuestion.question}`);
    tts.replay(activeQuestion.question, activeQuestion.topic || activeQuestion.section, {
      onStart: () => setCurrentState("SPEAKING"),
      onEnd: () => {
        setCurrentState("LISTENING");
        setTimeout(() => handleToggleListening(), 400);
      }
    });
  };

  /**
   * Submit Speech Transcript to Existing Backend Answer Evaluation API
   */
  const handleContinueNext = async () => {
    tts.stop();
    if (isRecognitionActive) {
      try { recognitionRef.current?.stop(); } catch (e) {}
    }

    const answerToSubmit = candidateAnswer.trim() || finalTranscript.trim();

    if (answerToSubmit) {
      addTranscriptEntry("Candidate", answerToSubmit);
    }

    setIsSubmitting(true);
    setCurrentState("THINKING");

    try {
      let evaluationResult = null;
      const isCurrentFollowUp = Boolean(activeFollowUp);
      const currentQuestionText = activeFollowUp ? activeFollowUp.question : activeQuestion.question;

      // 1. Send speech transcript through existing answer submission flow
      if (onSaveAnswer) {
        evaluationResult = await onSaveAnswer({
          questionId: isCurrentFollowUp ? `${activeQuestion.id}-FU` : activeQuestion.id,
          questionType: activeQuestion.category || (activeQuestion.topic?.toLowerCase().includes("coding") ? "coding" : "technical"),
          question: currentQuestionText,
          answer: answerToSubmit,
          transcript: answerToSubmit,
          mode: "voice",
          duration: 15,
          isFollowUp: isCurrentFollowUp,
          parentQuestionId: isCurrentFollowUp ? activeFollowUp.parentQuestionId : ""
        });
      } else if (interviewId && token) {
        const { data } = await api.post(
          "/api/student/interviews/answer",
          {
            interviewId,
            questionId: isCurrentFollowUp ? `${activeQuestion.id}-FU` : activeQuestion.id,
            questionType: activeQuestion.category || (activeQuestion.topic?.toLowerCase().includes("coding") ? "coding" : "technical"),
            question: currentQuestionText,
            answer: answerToSubmit,
            transcript: answerToSubmit,
            mode: "voice",
            duration: 15,
            isFollowUp: isCurrentFollowUp,
            parentQuestionId: isCurrentFollowUp ? activeFollowUp.parentQuestionId : ""
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        evaluationResult = data;
      } else {
        // Local simulation fallback
        evaluationResult = {
          score: answerToSubmit.length > 40 ? 85 : 55,
          feedback: answerToSubmit.length > 40
            ? "Good explanation. The response addresses the core technical concept clearly."
            : "Brief answer. Elaborate with additional architecture details.",
          needsFollowUp: !isCurrentFollowUp && answerToSubmit.length > 40,
          followUpQuestion: "You mentioned specific optimization details. How does caching affect data consistency under write spikes?",
          reason: "Probing caching trade-offs"
        };
      }

      // 2. Set EVALUATING state & display Gemini feedback
      setCurrentState("EVALUATING");
      setLastEvaluation(evaluationResult.answer || evaluationResult);

      const scoreVal = evaluationResult.answer?.score ?? evaluationResult.score;
      const feedbackVal = evaluationResult.answer?.feedback || evaluationResult.feedback;

      if (scoreVal !== undefined) {
        addTranscriptEntry("AI Evaluator", `[Score: ${scoreVal}/100] ${feedbackVal}`);
        toast.success(`Answer evaluated! Score: ${scoreVal}/100`);
      }

      // 3. DECIDE: If Gemini requested a Contextual AI Follow-up Question
      if (!isCurrentFollowUp && evaluationResult?.needsFollowUp && evaluationResult?.followUpQuestion) {
        setTimeout(() => {
          setCurrentState("FOLLOW_UP");
          setActiveFollowUp({
            question: evaluationResult.followUpQuestion,
            reason: evaluationResult.reason,
            parentQuestionId: activeQuestion.id
          });
          setFinalTranscript("");
          setCandidateAnswer("");
          setInterimTranscript("");
          addTranscriptEntry("AI Interviewer (Follow-up)", evaluationResult.followUpQuestion);
          speakAIQuestion(evaluationResult.followUpQuestion, "Follow-up");
        }, 2200);
        return;
      }

      // 4. Reset follow-up state & advance to next question
      setActiveFollowUp(null);
      setTimeout(() => {
        if (currentQIndex < questions.length - 1) {
          const nextIndex = currentQIndex + 1;
          setCurrentQIndex(nextIndex);
          setFinalTranscript("");
          setCandidateAnswer("");
          setInterimTranscript("");
          setLastEvaluation(null);
          
          const nextQ = questions[nextIndex];
          addTranscriptEntry("AI Interviewer", nextQ.question);
          speakAIQuestion(nextQ.question, nextQ.topic || nextQ.section);
        } else {
          setCurrentState("COMPLETED");
          if (onFinish) onFinish();
        }
      }, 2000);

    } catch (err) {
      console.error("Voice Answer Submission Error:", err);
      toast.error(err.response?.data?.message || "Failed to submit voice answer");
      setCurrentState("ERROR");
      setErrorMessage("Failed to connect to backend answer evaluation API.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          TOP CONTROL BAR: STATE, VOICE PROFILE & PERMISSION MONITOR
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border bg-slate-900/90 text-white backdrop-blur-md shadow-xl" style={{ borderColor: "var(--border, rgba(255,255,255,0.1))" }}>
        
        {/* State Badge */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold tracking-wider uppercase ${stateMeta.badgeBg}`}>
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: stateMeta.dotColor }}
            />
            <span>{stateMeta.label}</span>
          </div>
          <span className="text-xs text-slate-300 hidden sm:inline-block font-medium">
            {stateMeta.statusText}
          </span>
        </div>

        {/* Voice Profile & Audio Controls */}
        <div className="flex items-center gap-3">
          {/* Active Voice Profile Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
            <AudioWaveform className="w-3.5 h-3.5 text-purple-400" />
            <span>Profile: {activeProfile.label} ({activeProfile.style})</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
            {!isSupported ? (
              <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                <ShieldAlert className="w-4 h-4" /> Web Speech Not Supported
              </span>
            ) : micPermission === "granted" ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" /> Mic Granted
              </span>
            ) : micPermission === "denied" ? (
              <span className="flex items-center gap-1.5 text-rose-400 font-medium cursor-pointer" onClick={handleToggleListening}>
                <ShieldAlert className="w-4 h-4" /> Mic Denied (Click to Try)
              </span>
            ) : (
              <button onClick={handleToggleListening} className="text-amber-400 font-medium underline">
                Grant Mic Access
              </button>
            )}
          </div>

          <button
            onClick={() => {
              if (tts.isSpeaking) tts.stop();
              setIsAudioMuted(!isAudioMuted);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title={isAudioMuted ? "Unmute AI Voice" : "Mute AI Voice"}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Error / System Alert Banner */}
      {(errorMessage || tts.error) && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage || tts.error}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="text-rose-400 hover:text-white font-bold ml-2">
            Dismiss
          </button>
        </motion.div>
      )}

      {/* ─────── Gemini Evaluation Result Banner (when API evaluates) ─────── */}
      <AnimatePresence>
        {lastEvaluation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="p-4 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-extrabold text-sm border border-purple-500/30">
                {lastEvaluation.score}%
              </div>
              <div>
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-purple-400" /> Gemini AI Response Feedback
                </h4>
                <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                  "{lastEvaluation.feedback}"
                </p>
              </div>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
              Saved to MongoDB
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          MAIN VOICE STAGE: AI AVATAR & VISUALIZERS
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: AI Interviewer Stage (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 rounded-3xl relative overflow-hidden text-white shadow-2xl min-h-[460px]"
          style={{ background: "linear-gradient(145deg, #090d16 0%, #111827 60%, #080c14 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
          
          {/* Ambient Background Aura */}
          <div
            className="absolute w-80 h-80 rounded-full pointer-events-none transition-all duration-700 blur-3xl"
            style={{
              background:
                currentState === "SPEAKING" || tts.isSpeaking
                  ? "radial-gradient(circle, rgba(16,185,129,0.22) 0%, transparent 70%)"
                  : currentState === "LISTENING"
                  ? "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)"
                  : currentState === "THINKING" || currentState === "EVALUATING"
                  ? "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)"
                  : currentState === "ERROR"
                  ? "radial-gradient(circle, rgba(244,63,94,0.18) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(148,163,184,0.1) 0%, transparent 70%)",
              top: "20%",
              left: "50%",
              transform: "translateX(-50%)"
            }}
          />

          {/* Top Stage Header */}
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-lg bg-white/10 text-white/80 backdrop-blur-md">
              Question {currentQIndex + 1} / {questions.length}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Connected to Existing Backend API
            </span>
          </div>

          {/* Central AI Avatar Display */}
          <div className="my-auto flex flex-col items-center justify-center relative z-10 py-6">
            <div className="relative">
              {/* Outer Pulse Halo */}
              {(currentState === "SPEAKING" || tts.isSpeaking) && (
                <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
              )}
              {currentState === "LISTENING" && (
                <div className="absolute -inset-4 rounded-full bg-blue-500/20 animate-ping opacity-75" />
              )}

              {/* Avatar Frame */}
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center relative overflow-hidden shadow-2xl transition-transform duration-300"
                style={{
                  background: "radial-gradient(circle at 35% 35%, #1e293b 0%, #0f172a 100%)",
                  border: `3px solid ${tts.isSpeaking ? "#10b981" : stateMeta.dotColor}`
                }}
              >
                {currentState === "THINKING" || currentState === "EVALUATING" ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Brain className="w-12 h-12 text-purple-400 animate-pulse" />
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin absolute" />
                  </div>
                ) : currentState === "ERROR" ? (
                  <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
                ) : (
                  /* Standard AI Face SVG */
                  <svg width="68" height="68" viewBox="0 0 72 72" fill="none">
                    <ellipse cx="36" cy="30" rx="20" ry="22" fill="#1e3a5f" />
                    <ellipse cx="28" cy="26" rx="4" ry="4.5" fill={tts.isSpeaking || currentState === "SPEAKING" ? "#10b981" : "#3b82f6"} />
                    <ellipse cx="44" cy="26" rx="4" ry="4.5" fill={tts.isSpeaking || currentState === "SPEAKING" ? "#10b981" : "#3b82f6"} />
                    <circle cx="29.5" cy="24.5" r="1.5" fill="white" opacity="0.8" />
                    <circle cx="45.5" cy="24.5" r="1.5" fill="white" opacity="0.8" />
                    {tts.isSpeaking || currentState === "SPEAKING" ? (
                      <ellipse cx="36" cy="38" rx="7" ry="4" fill="#10b981" opacity="0.8" />
                    ) : (
                      <path d="M29 37 Q36 42 43 37" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" fill="none" />
                    )}
                    <path d="M16 60 Q24 50 36 52 Q48 50 56 60" fill="#0f1f38" />
                  </svg>
                )}
              </div>
            </div>

            {/* Avatar Title */}
            <div className="mt-4 text-center space-y-1">
              <h3 className="text-base font-bold text-white tracking-wide">Alex — AI Voice Interviewer</h3>
              <p className="text-xs text-slate-400">{stateMeta.message}</p>
            </div>

            {/* AI Speech Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {tts.isSpeaking && !tts.isPaused ? (
                <button
                  onClick={tts.pause}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/30 transition-colors cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause Speech
                </button>
              ) : tts.isPaused ? (
                <button
                  onClick={tts.resume}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" /> Resume Speech
                </button>
              ) : null}

              <button
                onClick={handleRepeatQuestion}
                className="px-3 py-1.5 rounded-xl bg-white/10 text-white border border-white/20 text-xs font-semibold flex items-center gap-1.5 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Replay Question
              </button>

              {tts.isSpeaking && (
                <button
                  onClick={tts.stop}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-500/30 transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" /> Stop Speech
                </button>
              )}
            </div>

            {/* Speaking / Listening Audio Visualizer Bar */}
            <div className="mt-5 w-full max-w-xs h-8 flex items-center justify-center">
              <AudioVisualizer
                isActive={currentState === "SPEAKING" || tts.isSpeaking || isRecognitionActive}
                barCount={20}
                color="rgba(255,255,255,0.15)"
                activeColor={tts.isSpeaking || currentState === "SPEAKING" ? "#10b981" : "#3b82f6"}
                height="28px"
                className="w-full"
              />
            </div>
          </div>

          {/* Current Question Subtitle Display */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 backdrop-blur-md relative z-10">
            <div className="flex items-center gap-2 mb-1">
              {activeFollowUp ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold uppercase tracking-wider flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 text-cyan-400" /> Contextual AI Follow-up Question
                </span>
              ) : (
                <>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Current Question</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">{activeQuestion.topic}</span>
                </>
              )}
            </div>
            <p className="text-sm font-semibold text-white/90 leading-relaxed">
              "{activeFollowUp ? activeFollowUp.question : activeQuestion.question}"
            </p>
          </div>
        </div>

        {/* Right Column: Live STT Speech Transcript & Manual Fallback (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 rounded-3xl border bg-white dark:bg-slate-900 shadow-xl space-y-4" style={{ borderColor: "var(--border, rgba(0,0,0,0.1))" }}>
          
          {/* Transcript Header */}
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <h4 className="text-xs font-bold tracking-wider uppercase text-slate-800 dark:text-white">
                Speech & Dialogue Transcript
              </h4>
            </div>
            {candidateAnswer.trim() && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> Official Answer Ready
              </span>
            )}
          </div>

          {/* Full Conversation Transcript Area */}
          <div className="flex-1 max-h-[160px] overflow-y-auto space-y-3 pr-1 text-xs">
            {transcriptHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-6 text-center text-slate-400 space-y-1">
                <Terminal className="w-7 h-7 opacity-40 text-blue-500" />
                <p className="text-xs font-medium">No dialogue logged yet.</p>
                <p className="text-[11px] text-slate-500">Click 'Start' to begin AI voice questions.</p>
              </div>
            ) : (
              transcriptHistory.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl space-y-1 ${
                    item.speaker === "AI Interviewer"
                      ? "bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50"
                      : item.speaker === "AI Evaluator"
                      ? "bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40"
                      : "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 ml-4"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[10px]">
                    <span className={
                      item.speaker === "AI Interviewer"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : item.speaker === "AI Evaluator"
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-blue-600 dark:text-blue-400"
                    }>
                      {item.speaker}
                    </span>
                    <span className="text-slate-400 font-normal">{item.time}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                    {item.text}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Live Transcript Stream Container */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border space-y-2" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Radio className={`w-3.5 h-3.5 ${isRecognitionActive ? "text-rose-500 animate-pulse" : "text-slate-400"}`} />
                {isRecognitionActive ? "🎙️ Candidate Speech Stream" : "Spoken Answer Transcript"}
              </span>
              {isRecognitionActive && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-bold animate-pulse">
                  STT Active
                </span>
              )}
            </div>

            {/* Final Transcribed Text */}
            <div className="min-h-[44px] text-xs leading-relaxed text-slate-800 dark:text-slate-200">
              {finalTranscript ? (
                <p className="font-medium text-slate-900 dark:text-slate-100">{finalTranscript}</p>
              ) : (
                <p className="text-slate-400 italic text-[11px]">
                  {isRecognitionActive ? "Listening to your voice... Speak now." : "Click microphone button or 'Start' to speak your answer."}
                </p>
              )}

              {/* Interim Real-Time Transcript Preview */}
              {interimTranscript && (
                <p className="text-blue-500 dark:text-blue-400 italic mt-1 font-normal flex items-center gap-1 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping inline-block" />
                  "{interimTranscript}"
                </p>
              )}
            </div>
          </div>

          {/* Manual Typing Fallback Option */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Edit3 className="w-3 h-3 text-slate-400" /> Official Answer Input (Editable)
              </label>
              <span className="text-[10px] text-slate-400">{candidateAnswer.length} chars</span>
            </div>
            <textarea
              rows={2}
              value={candidateAnswer}
              onChange={(e) => setCandidateAnswer(e.target.value)}
              placeholder="Speech transcript will populate here automatically. You can also edit or type manually..."
              className="w-full p-2.5 rounded-xl border text-xs leading-relaxed outline-none resize-none bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Primary Voice Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            {/* Start Button */}
            <button
              onClick={handleStartInterview}
              disabled={tts.isSpeaking || isRecognitionActive || isSubmitting}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" /> Start
            </button>

            {/* Repeat Question Button */}
            <button
              onClick={handleRepeatQuestion}
              disabled={currentState === "IDLE" || currentState === "COMPLETED" || isSubmitting}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer border" style={{ borderColor: "var(--border)" }}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Replay
            </button>

            {/* Submit & Next Button (Connected to Existing Backend API) */}
            <button
              onClick={handleContinueNext}
              disabled={currentState === "COMPLETED" || isSubmitting}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Evaluating...
                </>
              ) : (
                <>
                  Submit & Next <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {/* Stop/Cancel Button */}
            <button
              onClick={handleStopCancel}
              disabled={currentState === "IDLE" && !isRecognitionActive && !tts.isSpeaking}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-50 transition-colors cursor-pointer border border-rose-200 dark:border-rose-800/40"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STATE VERIFICATION / SIMULATOR TOOLBAR
         ───────────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl border bg-slate-900 text-white space-y-3" style={{ borderColor: "var(--border, rgba(255,255,255,0.1))" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold tracking-wider uppercase text-amber-400">
              Voice UI State Verification Controller
            </span>
          </div>
          <button
            onClick={runMockSequence}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
          >
            ⚡ Run Auto Transition Demo
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          Click any state button below to verify all 8 Voice Interview UI states visually:
        </p>

        {/* 8 State Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {Object.keys(STATE_CONFIG).map((stateKey) => {
            const meta = STATE_CONFIG[stateKey];
            const isActive = currentState === stateKey;
            return (
              <button
                key={stateKey}
                onClick={() => {
                  tts.stop();
                  setCurrentState(stateKey);
                }}
                className={`py-2 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer border text-center ${
                  isActive
                    ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md scale-105"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                }`}
              >
                {stateKey}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VoiceInterviewInterface;
