import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Bot, Sparkles, Mic, MicOff, CheckCircle2, Keyboard, Loader2 } from "lucide-react";

// Import reusable components
import InterviewLayout from "../../components/interview/InterviewLayout";
import AIInterviewerCard from "../../components/interview/AIInterviewerCard";
import QuestionCard from "../../components/interview/QuestionCard";
import CandidateInfo from "../../components/interview/CandidateInfo";
import WebcamCard from "../../components/interview/WebcamCard";
import ConversationPanel from "../../components/interview/ConversationPanel";
import ProgressTracker from "../../components/interview/ProgressTracker";
import Timer from "../../components/interview/Timer";
import LiveNotes from "../../components/interview/LiveNotes";
import CodeEditorArea from "../../components/interview/CodeEditorArea";
import NavigationControls from "../../components/interview/NavigationControls";
import ConfirmExitDialog from "../../components/interview/ConfirmExitDialog";
import CompletionScreen from "../../components/interview/CompletionScreen";

// Import mock data (fallback)
import { MOCK_QUESTIONS, MOCK_CANDIDATE } from "../../data/interviewMockData";
import { useStudentProfile } from "../../hooks/useStudentProfile";

/**
 * StartInterview Page Component
 * Main orchestrator page for the live AI Interview Room.
 */
function StartInterview() {
  const navigate = useNavigate();
  const location = useLocation();

  // Router state passed from StudentLayout after backend call
  const routerState = location.state || {};

  // State management
  const [currentIndex, setCurrentIndex] = useState(1); // 1-indexed for student layout
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [aiStatus, setAiStatus] = useState("Speaking"); // Speaking, Listening, Thinking

  // Question & response content state
  const [inputMode, setInputMode] = useState("speak"); // 'speak' or 'type'
  const [typedResponse, setTypedResponse] = useState("");
  const [savedAnswers, setSavedAnswers] = useState([]);
  const [dialogueLogs, setDialogueLogs] = useState([]);
  const [currentCode, setCurrentCode] = useState("");

  // Media controls state
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  // Ref so triggerSpeech / navigation always reads latest value without stale closure
  const isSpeakerOnRef = useRef(true);
  const handleToggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      isSpeakerOnRef.current = next;
      if (!next) {
        // Mute immediately — cancel any ongoing TTS
        window.speechSynthesis?.cancel();
        setAiStatus("Listening");
        toast("Chatbot muted");
      } else {
        toast("Chatbot unmuted");
      }
      return next;
    });
  }, []);

  // Webcam stream (getUserMedia)
  const [webcamStream, setWebcamStream] = useState(null);
  const webcamStreamRef = useRef(null);

  // Refs for PTT scroll-to-answer behavior
  const rightScrollRef = useRef(null);
  const answerSectionRef = useRef(null);
  
  // Timer state — use duration from router state if available
  const durationMinutes = routerState.duration || MOCK_CANDIDATE.totalTimeMinutes;
  const totalSeconds = durationMinutes * 60;
  const [timerSeconds, setTimerSeconds] = useState(totalSeconds);

  // Speech Recognition state
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const recognitionRef = useRef(null);
  const speechBaseTextRef = useRef("");

  const { profile } = useStudentProfile();
  
  // Real Data State — initialize from router state if provided
  const [questions, setQuestions] = useState(routerState.generatedQuestions || []);
  const [candidateInfo, setCandidateInfo] = useState({
    name: routerState.candidateName || MOCK_CANDIDATE.name,
    resumeName: routerState.resumeFileName || MOCK_CANDIDATE.resumeName,
    interviewType: routerState.interviewType || "Technical",
    difficulty: routerState.difficulty || "Medium",
    totalTimeMinutes: durationMinutes,
  });
  // Start loading only if we don't have questions from router state
  const [isLoadingInterview, setIsLoadingInterview] = useState(
    !routerState.generatedQuestions || routerState.generatedQuestions.length === 0
  );
  const [error, setError] = useState(null);

  // Active interviewId — prefer router state over profile (profile may be stale)
  const activeInterviewId = routerState.interviewId || profile.interviewId;

  // ─── Webcam stream acquisition ───
  const startWebcam = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Camera access is not supported by your browser or connection type (requires HTTPS or localhost).");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false, // audio handled separately by SpeechRecognition
      });
      webcamStreamRef.current = stream;
      setWebcamStream(stream);
      setIsCameraOn(true);
    } catch (err) {
      console.warn("Webcam access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Camera access blocked. Please allow camera permissions in your browser address bar.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        toast.error("No camera found on your device.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        toast.error("Camera is already in use by another application (e.g. Zoom/Teams).");
      } else {
        toast.error(`Camera error: ${err.message}`);
      }
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
      setWebcamStream(null);
    }
  }, []);

  // Toggle camera track enabled state without stopping the stream
  const handleToggleCamera = useCallback(() => {
    setIsCameraOn((prev) => {
      const next = !prev;
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = next; });
      }
      return next;
    });
  }, []);

  // Mute/unmute mic in speech recognition + toggle UI
  const handleToggleMic = useCallback(() => {
    setIsMicOn((prev) => {
      const next = !prev;
      if (!next && isListeningSpeech) stopSpeechRecognition();
      return next;
    });
  }, [isListeningSpeech]);

  // Push to Talk: switch to voice mode, start recording, scroll to answer box
  const handlePushToTalk = useCallback(() => {
    if (!isMicOn) {
      toast.error("Microphone is muted. Unmute first.");
      return;
    }
    // Switch to voice input mode
    setInputMode("speak");
    // Start / stop speech recognition toggle
    if (isListeningSpeech) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
    // Smooth-scroll right panel to the answer input section
    if (answerSectionRef.current && rightScrollRef.current) {
      const container = rightScrollRef.current;
      const target = answerSectionRef.current;
      const offsetTop = target.offsetTop - container.offsetTop - 8;
      container.scrollTo({ top: offsetTop, behavior: "smooth" });
    }
  }, [isMicOn, isListeningSpeech]);

  // Acquire webcam on mount; release on unmount
  useEffect(() => {
    startWebcam();
    return () => stopWebcam();
  }, []);

  // 1. Fetch Interview Data from Backend (only if not provided via router state)
  useEffect(() => {
    if (!isLoadingInterview) return; // Already have questions from router state

    const fetchInterview = async () => {
      try {
        if (!activeInterviewId) {
          // Fallback to mock data for demonstration if no interviewId
          console.warn("No interviewId found, falling back to mock data");
          setQuestions(MOCK_QUESTIONS);
          setCandidateInfo({ ...MOCK_CANDIDATE, name: profile.name || MOCK_CANDIDATE.name });
          setIsLoadingInterview(false);
          return;
        }

        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await fetch(`http://localhost:5000/api/interview/${activeInterviewId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!res.ok) throw new Error("Failed to fetch interview session");

        const data = await res.json();
        
        if (data.generatedQuestions && data.generatedQuestions.length > 0) {
          setQuestions(data.generatedQuestions);
        } else {
          setQuestions(MOCK_QUESTIONS); // fallback
        }
        
        if (data.candidateProfile) {
          setCandidateInfo({
            name: data.candidateProfile.candidateName || profile.name,
            resumeName: data.resumeFileName || profile.resumeFileName,
            interviewType: profile.interviewType || "Technical",
            difficulty: profile.difficulty || "Medium",
            totalTimeMinutes: profile.duration || 30
          });
        }
        
        setIsLoadingInterview(false);
      } catch (err) {
        console.error(err);
        setError("Could not load interview session. Using fallback data.");
        setQuestions(MOCK_QUESTIONS);
        setIsLoadingInterview(false);
      }
    };

    fetchInterview();
  }, [activeInterviewId, isLoadingInterview]);


  const currentQuestion = questions[currentIndex - 1] || {};

  // 1. Digital session timer countdown
  useEffect(() => {
    // Only start timer when data is loaded
    if (isLoadingInterview) return;
    
    let interval;
    if (!isPaused && !isCompleted && !isGeneratingQuestion && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, isCompleted, isGeneratingQuestion, timerSeconds]);

  // 2. Play AI Text-to-Speech when a new question is loaded
  useEffect(() => {
    if (isCompleted || isPaused) return;

    // Trigger Speech Synthesis
    triggerSpeech(currentQuestion?.aiSpeechText);

    // Populate dialogue log with AI query
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDialogueLogs((prev) => [
      ...prev,
      { sender: "AI", text: currentQuestion.aiSpeechText, time: timeNow }
    ]);

    // Pre-populate response with any previous answer if user goes back
    const existing = savedAnswers.find((ans) => ans.questionId === currentQuestion.id);
    if (existing) {
      if (currentQuestion.codeQuestion) {
        setCurrentCode(existing.answer);
      } else {
        setTypedResponse(existing.answer);
      }
    } else {
      setTypedResponse("");
      setCurrentCode("");
    }
  }, [currentIndex, isGeneratingQuestion]);

  // Handle speaking the query
  const triggerSpeech = (text) => {
    if (!text || !isSpeakerOnRef.current) return;

    // Cancel active synthesis first
    window.speechSynthesis?.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // Find a natural English sounding voice if possible
    const voices = window.speechSynthesis?.getVoices();
    const naturalVoice = voices?.find(v => v.lang.includes("en-US") || v.lang.includes("en-IN"));
    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.rate = 1.0;

    utterance.onstart = () => {
      setAiStatus("Speaking");
    };

    utterance.onend = () => {
      setAiStatus("Listening");
    };

    window.speechSynthesis?.speak(utterance);
  };

  // 3. Setup Web Speech Recognition API
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Web Speech Recognition is not supported by your current browser. Please type your response.");
      return;
    }

    if (isListeningSpeech) {
      stopSpeechRecognition();
      return;
    }

    // Save the text that was in the textarea before we started speaking
    speechBaseTextRef.current = typedResponse;

    try {
      const rec = new SpeechRecognition();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListeningSpeech(true);
        setAiStatus("Listening");
        toast.success("Voice transcription active. Speak clearly.");
      };

      rec.onresult = (event) => {
        let sessionTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          sessionTranscript += event.results[i][0].transcript;
        }
        
        // Append current speech transcript to the base text
        const separator = speechBaseTextRef.current ? " " : "";
        setTypedResponse((speechBaseTextRef.current + separator + sessionTranscript).trim());
      };

      rec.onerror = (e) => {
        console.error("Speech Recognition Error: ", e);
        setIsListeningSpeech(false);
      };

      rec.onend = () => {
        setIsListeningSpeech(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error(err);
      setIsListeningSpeech(false);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListeningSpeech(false);
  };

  // Repeat AI Speech query
  const handleRepeatQuery = () => {
    triggerSpeech(currentQuestion?.aiSpeechText);
  };

  // Navigations & Answer Saves
  const handleSaveAnswer = async (statusType = "answered") => {
    stopSpeechRecognition();
    const finalAnswerText = currentQuestion.codeQuestion ? currentCode : typedResponse;

    const answerRecord = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.question,
      category: currentQuestion.category,
      answer: finalAnswerText,
      status: statusType
    };

    // Save to backend asynchronously
    if (activeInterviewId) {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        fetch(`http://localhost:5000/api/interview/${activeInterviewId}/answer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            questionId: currentQuestion.id,
            question: currentQuestion.question,
            category: currentQuestion.category,
            answer: finalAnswerText
          })
        }).then(res => res.json())
          .then(data => console.log("Answer saved to DB:", data))
          .catch(err => console.error("Failed to save answer to DB:", err));
      } catch (err) {
        console.error("Fetch error saving answer:", err);
      }
    }

    // Update in logs
    setSavedAnswers((prev) => {
      const filtered = prev.filter((ans) => ans.questionId !== currentQuestion.id);
      return [...filtered, answerRecord];
    });

    // Add candidate response to dialogue history
    if (finalAnswerText.trim()) {
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDialogueLogs((prev) => [
        ...prev,
        { sender: "Candidate", text: finalAnswerText.slice(0, 100) + (finalAnswerText.length > 100 ? "..." : ""), time: timeNow }
      ]);
    }
  };

  const handleNextQuestion = () => {
    // Stop mic + cancel TTS immediately so bot voice isn't recorded
    stopSpeechRecognition();
    window.speechSynthesis?.cancel();
    handleSaveAnswer("answered");

    if (currentIndex < questions.length) {
      // Simulate "AI is generating next question..." Transition State
      setIsGeneratingQuestion(true);
      setAiStatus("Thinking");

      setTimeout(() => {
        setIsGeneratingQuestion(false);
        setCurrentIndex((prev) => prev + 1);
        setAiStatus("Speaking");
      }, 2000); // 2 seconds thinking transition screen
    } else {
      // Completed!
      setIsCompleted(true);
    }
  };

  const handlePrevQuestion = () => {
    if (currentIndex > 1) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSkipQuestion = () => {
    // Stop mic + cancel TTS immediately
    stopSpeechRecognition();
    window.speechSynthesis?.cancel();
    handleSaveAnswer("skipped");
    if (currentIndex < questions.length) {
      setIsGeneratingQuestion(true);
      setAiStatus("Thinking");

      setTimeout(() => {
        setIsGeneratingQuestion(false);
        setCurrentIndex((prev) => prev + 1);
        setAiStatus("Speaking");
      }, 1500);
    } else {
      setIsCompleted(true);
    }
  };

  const handleEmergencyExit = () => {
    setShowConfirmExit(true);
  };

  const handleConfirmExit = () => {
    setShowConfirmExit(false);
    setIsCompleted(true);
  };

  const [isCompleting, setIsCompleting] = useState(false);

  // Completion stats calculation
  const getCompletedStats = () => {
    const answered = savedAnswers.filter((a) => a.status === "answered" && a.answer.trim()).length;
    const skipped = savedAnswers.filter((a) => a.status === "skipped" || !a.answer.trim()).length + (questions.length - savedAnswers.length);
    const secsUsed = totalSeconds - timerSeconds;
    const mins = Math.floor(secsUsed / 60).toString().padStart(2, "0");
    const secs = (secsUsed % 60).toString().padStart(2, "0");
    return {
      answeredCount: answered,
      skippedCount: Math.max(skipped, 0),
      timeTaken: `${mins}:${secs}`
    };
  };

  // Return formatted remaining time for Progress Tracker
  const getRemainingTimeText = () => {
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
    const s = (timerSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Cleanup Synthesis on Exit
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Complete Interview on backend when isCompleted becomes true
  useEffect(() => {
    if (isCompleted && activeInterviewId && !isCompleting) {
      setIsCompleting(true);
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      fetch(`http://localhost:5000/api/interview/${activeInterviewId}/complete`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      }).then(res => res.json())
        .then(data => {
          console.log("Interview completed on backend", data);
          toast.success("Interview report generated!");
        })
        .catch(err => console.error("Failed to complete interview on backend", err))
        .finally(() => setIsCompleting(false));
    }
  }, [isCompleted, profile.interviewId]);

  // RENDER LOADING SCREEN
  if (isLoadingInterview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <h2 className="text-xl font-semibold">Initializing Interview Room...</h2>
          <p className="text-sm text-slate-500">Loading your AI-generated questions</p>
        </div>
      </div>
    );
  }

  // RENDER COMPLETION SCREEN
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
          setIsCompleted(false);
        }}
      />
    );
  }

  // RENDER INTERVIEW ROOM — Premium Video-Call Layout
  return (
    <div className="relative">
      <InterviewLayout
        isPaused={isPaused}
        onResume={() => setIsPaused(false)}

        /* Header metadata */
        headerProps={{
          timerSeconds,
          totalSeconds,
          interviewType: candidateInfo.interviewType || "Software Engineer",
          networkLevel: 4,
        }}

        /* Bottom action bar controls */
        controlProps={{
          isMicOn,
          isCameraOn,
          isSpeakerOn,
          isListening: isListeningSpeech,
          onToggleMic: handleToggleMic,
          onToggleCamera: handleToggleCamera,
          onToggleSpeaker: handleToggleSpeaker,
          onPushToTalk: handlePushToTalk,
          onEndInterview: handleEmergencyExit,
          onSettings: () => toast("Settings coming soon!"),
        }}

        /* LEFT: AI Avatar stage (full height, 70% width) */
        leftPanel={
          <AIInterviewerCard
            aiStatus={aiStatus}
            isGeneratingQuestion={isGeneratingQuestion}
            currentQuestionText={currentQuestion?.question || ""}
          />
        }

        /* No centerPanel — question card and answer area go in right column */
        centerPanel={null}

        /* RIGHT: scrollable content + pinned nav at bottom */
        rightPanel={
          <div className="flex flex-col h-full min-h-0 overflow-hidden">

            {/* ── Scrollable content area ── */}
            <div
              ref={rightScrollRef}
              className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-2"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
            >

              {/* 1. User Webcam PiP */}
              <div className="shrink-0" style={{ height: "150px" }}>
                <WebcamCard
                  isCameraOn={isCameraOn}
                  stream={webcamStream}
                  userName={candidateInfo.name}
                  onRetryCamera={startWebcam}
                />
              </div>

              {/* 2. Question Card */}
              <div className="shrink-0">
                {isGeneratingQuestion ? (
                  <div
                    className="rounded-2xl p-4 flex flex-col items-center justify-center gap-2"
                    style={{
                      background: "rgba(8,10,18,0.9)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      minHeight: "80px",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                      <span className="text-xs text-white/50">Generating next question…</span>
                    </div>
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <span key={i}
                          className="w-1.5 h-1.5 rounded-full bg-blue-400/50 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <QuestionCard
                    questionText={currentQuestion?.question}
                    currentIndex={currentIndex}
                    totalQuestions={questions.length}
                    difficulty={currentQuestion?.difficulty}
                    category={currentQuestion?.category}
                    estimatedTime={currentQuestion?.estimatedTime}
                  />
                )}
              </div>

              {/* 3. Answer Input Area */}
              <div ref={answerSectionRef} className="shrink-0">
                {currentQuestion?.codeQuestion ? (
                  <CodeEditorArea code={currentCode} onChange={setCurrentCode} />
                ) : (
                  <div
                    className="rounded-2xl p-3 flex flex-col gap-2"
                    style={{
                      background: "rgba(8,10,18,0.9)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {/* Mode tabs */}
                    <div className="flex gap-1.5 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <button
                        onClick={() => { stopSpeechRecognition(); setInputMode("type"); }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        style={{
                          background: inputMode === "type" ? "#2563eb" : "rgba(255,255,255,0.06)",
                          color: inputMode === "type" ? "#fff" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        <Keyboard className="w-3 h-3" /> Type
                      </button>
                      <button
                        onClick={() => setInputMode("speak")}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        style={{
                          background: inputMode === "speak" ? "#2563eb" : "rgba(255,255,255,0.06)",
                          color: inputMode === "speak" ? "#fff" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        <Mic className="w-3 h-3" /> Voice
                      </button>
                      <span className="ml-auto text-[9px] text-white/25 self-center">{typedResponse.length} chars</span>
                    </div>

                    <textarea
                      value={typedResponse}
                      onChange={(e) => setTypedResponse(e.target.value)}
                      placeholder={inputMode === "speak" ? "Speak — transcript appears here…" : "Type your answer…"}
                      disabled={isPaused}
                      rows={3}
                      className="w-full rounded-xl p-2.5 text-xs outline-none resize-none"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        color: "rgba(255,255,255,0.8)",
                        minHeight: "72px",
                      }}
                    />

                    {inputMode === "speak" && (
                      <button
                        onClick={startSpeechRecognition}
                        disabled={isPaused || !isMicOn}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-40"
                        style={{
                          background: isListeningSpeech
                            ? "rgba(239,68,68,0.2)"
                            : "rgba(37,99,235,0.15)",
                          border: `1px solid ${isListeningSpeech ? "rgba(239,68,68,0.4)" : "rgba(37,99,235,0.3)"}`,
                          color: isListeningSpeech ? "#f87171" : "#60a5fa",
                        }}
                      >
                        {isListeningSpeech ? (
                          <><MicOff className="w-3.5 h-3.5" /> Stop Recording</>
                        ) : (
                          <><Mic className="w-3.5 h-3.5" /> Start Speaking</>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 4. Live Transcript */}
              <div className="shrink-0" style={{ minHeight: "160px" }}>
                <ConversationPanel logs={dialogueLogs} />
              </div>

            </div>

            {/* ── Pinned Navigation — always visible at bottom ── */}
            <div
              className="shrink-0 pt-2"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(5,6,9,0.85)",
                backdropFilter: "blur(8px)",
              }}
            >
              <NavigationControls
                currentIndex={currentIndex}
                totalQuestions={questions.length}
                isPaused={isPaused}
                onPrev={handlePrevQuestion}
                onNext={handleNextQuestion}
                onSkip={handleSkipQuestion}
                onRepeat={handleRepeatQuery}
                onTogglePause={() => setIsPaused(!isPaused)}
                onEnd={handleEmergencyExit}
              />
            </div>

          </div>
        }

      />

      {/* Confirmation Exit Modal */}
      <ConfirmExitDialog
        isOpen={showConfirmExit}
        onClose={() => setShowConfirmExit(false)}
        onConfirm={handleConfirmExit}
      />
    </div>
  );
}

export default StartInterview;
