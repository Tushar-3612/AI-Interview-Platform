import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Bot, Sparkles, Mic, MicOff, CheckCircle2, Keyboard } from "lucide-react";

// Import reusable components
import InterviewLayout from "../../components/interview/InterviewLayout";
import AIInterviewerCard from "../../components/interview/AIInterviewerCard";
import QuestionCard from "../../components/interview/QuestionCard";
import CandidateInfo from "../../components/interview/CandidateInfo";
import WebcamCard from "../../components/interview/WebcamCard";
import MicrophoneControls from "../../components/interview/MicrophoneControls";
import ConversationPanel from "../../components/interview/ConversationPanel";
import ProgressTracker from "../../components/interview/ProgressTracker";
import Timer from "../../components/interview/Timer";
import LiveNotes from "../../components/interview/LiveNotes";
import CodeEditorPlaceholder from "../../components/interview/CodeEditorPlaceholder";
import NavigationControls from "../../components/interview/NavigationControls";
import ConfirmExitDialog from "../../components/interview/ConfirmExitDialog";
import CompletionScreen from "../../components/interview/CompletionScreen";

// Import mock data
import { MOCK_QUESTIONS, MOCK_CANDIDATE } from "../../data/interviewMockData";

/**
 * StartInterview Page Component
 * Main orchestrator page for the live AI Interview Room.
 */
function StartInterview() {
  const navigate = useNavigate();

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
  const [noiseReductionOn, setNoiseReductionOn] = useState(false);
  
  // Timer state
  const totalSeconds = MOCK_CANDIDATE.totalTimeMinutes * 60;
  const [timerSeconds, setTimerSeconds] = useState(totalSeconds);

  // Speech Recognition state
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const recognitionRef = useRef(null);
  const speechBaseTextRef = useRef("");

  const currentQuestion = MOCK_QUESTIONS[currentIndex - 1];

  // 1. Digital session timer countdown
  useEffect(() => {
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
    if (!text || !isSpeakerOn) return;
    
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
  const handleSaveAnswer = (statusType = "answered") => {
    stopSpeechRecognition();
    const finalAnswerText = currentQuestion.codeQuestion ? currentCode : typedResponse;

    const answerRecord = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.question,
      category: currentQuestion.category,
      answer: finalAnswerText,
      status: statusType
    };

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
    handleSaveAnswer("answered");

    if (currentIndex < MOCK_QUESTIONS.length) {
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
    handleSaveAnswer("skipped");
    if (currentIndex < MOCK_QUESTIONS.length) {
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

  // Completion stats calculation
  const getCompletedStats = () => {
    const answered = savedAnswers.filter((a) => a.status === "answered" && a.answer.trim()).length;
    const skipped = savedAnswers.filter((a) => a.status === "skipped" || !a.answer.trim()).length + (MOCK_QUESTIONS.length - savedAnswers.length);
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

  // RENDER COMPLETION SCREEN
  if (isCompleted) {
    const stats = getCompletedStats();
    return (
      <CompletionScreen
        candidateName={MOCK_CANDIDATE.name}
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

  // RENDER INTERVIEW ROOM
  return (
    <div className="relative min-h-screen">
      
      {/* 3-Column Interview Screen Layout */}
      <InterviewLayout
        isPaused={isPaused}
        onResume={() => setIsPaused(false)}
        
        // LEFT COLUMN (Interviewer bot + Webcam Card)
        leftPanel={
          <div className="flex flex-col h-full min-h-0" style={{ gap: "var(--sidebar-gap)" }}>
            <div className="h-[40%] min-h-0 shrink-0">
              <AIInterviewerCard status={aiStatus} />
            </div>
            <div className="flex-grow min-h-0">
              <WebcamCard 
                isCameraOn={isCameraOn} 
                onToggleCamera={() => setIsCameraOn(!isCameraOn)} 
                isMicOn={isMicOn}
                onToggleMic={() => setIsMicOn(!isMicOn)}
              />
            </div>
          </div>
        }

        // CENTER COLUMN (Question display, editor placeholder, text responses, navigations)
        centerPanel={
          <div className="flex-grow flex flex-col h-full min-h-0 justify-between" style={{ gap: "var(--sidebar-gap)" }}>
            
            {/* Center Area: Loader screen OR active Question Card */}
            <div className="h-[28%] min-h-0 shrink-0">
              {isGeneratingQuestion ? (
                <div className="glass-card rounded-[16px] p-4 flex flex-col items-center justify-center text-center gap-3 h-full w-full bg-sky-500/5 border-sky-500/10">
                  <div className="relative flex items-center justify-center shrink-0">
                    <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
                    <Bot className="w-4 h-4 absolute text-primary animate-pulse" />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                      AI is generating your next question...
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {[0, 1, 2].map((i) => (
                      <span 
                        key={i} 
                        className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <QuestionCard
                  questionText={currentQuestion?.question}
                  currentIndex={currentIndex}
                  totalQuestions={MOCK_QUESTIONS.length}
                  difficulty={currentQuestion?.difficulty}
                  category={currentQuestion?.category}
                  estimatedTime={currentQuestion?.estimatedTime}
                  topic={currentQuestion?.topic || currentQuestion?.category}
                  marks={currentQuestion?.marks || "10 Marks"}
                />
              )}
            </div>

            {/* Content Workspace Area: Code Editor VS Audio Textbox */}
            <div className="flex-grow flex flex-col min-h-0">
              {currentQuestion?.codeQuestion ? (
                <CodeEditorPlaceholder
                  questionData={currentQuestion}
                  onCodeChange={(code) => setCurrentCode(code)}
                />
              ) : (
                /* General Text Answer Panel with Mode Selection */
                <div className="glass-card rounded-[16px] p-4 flex flex-col justify-between flex-grow flex-1 min-h-0 gap-3 relative">
                  
                  {/* Mode Selection Tab Bar */}
                  <div className="flex border-b border-zinc-200 dark:border-zinc-800 pb-2 gap-2 text-xs shrink-0 justify-between items-center">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          stopSpeechRecognition();
                          setInputMode("type");
                        }}
                        className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          inputMode === "type"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                        <span>Type Answer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode("speak")}
                        className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          inputMode === "speak"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Voice Answer</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">{typedResponse.length} characters</span>
                  </div>

                  {/* Textarea Area (Most of the screen) */}
                  <div className="flex-grow flex flex-col min-h-0 gap-2">
                    <textarea
                      value={typedResponse}
                      onChange={(e) => setTypedResponse(e.target.value)}
                      placeholder={inputMode === "speak" ? "Your spoken response will transcribe here. You can also edit it..." : "Write your explanation here..."}
                      disabled={isPaused}
                      className="flex-grow w-full border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none resize-none bg-slate-50/50 dark:bg-zinc-900/10 min-h-0"
                    />
                    
                    {/* Voice Controls Row if in Speak Mode */}
                    {inputMode === "speak" && (
                      <div className="flex items-center gap-3 p-2 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-900/5 shrink-0">
                        <button
                          type="button"
                          onClick={startSpeechRecognition}
                          disabled={isPaused || !isMicOn}
                          className={`w-10 h-10 rounded-full flex items-center justify-center relative cursor-pointer border transition-all duration-300 shrink-0 ${
                            isListeningSpeech
                              ? "bg-red-500 border-red-400 text-white"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-655 dark:text-blue-450 hover:bg-blue-500/25"
                          }`}
                        >
                          {isListeningSpeech ? (
                            <>
                              <motion.div
                                className="absolute inset-0 rounded-full border border-red-500 bg-red-500/25"
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                              />
                              <MicOff className="w-4 h-4 relative z-10" />
                            </>
                          ) : (
                            <Mic className="w-4 h-4 relative z-10" />
                          )}
                        </button>
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] font-bold text-slate-800 dark:text-zinc-200">
                            {isListeningSpeech ? "Microphone Active — Speaking" : "Voice Transcription Ready"}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {isListeningSpeech ? "Click the red button to stop transcribing." : "Click microphone button to start speaking your reply."}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* Navigation and actions bar */}
            <div className="h-[70px] shrink-0">
              <NavigationControls
                currentIndex={currentIndex}
                totalQuestions={MOCK_QUESTIONS.length}
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

        // RIGHT COLUMN (Timer, Live stats, AI feedback bullet logs, conversations)
        rightPanel={
          <div className="flex flex-col h-full min-h-0" style={{ gap: "var(--sidebar-gap)" }}>
            {/* Card 1: Timer (90px) */}
            <div className="shrink-0">
              <Timer 
                seconds={timerSeconds} 
                totalSeconds={totalSeconds} 
              />
            </div>
            
            {/* Card 2: Session Information (180px) */}
            <div className="shrink-0">
              <CandidateInfo
                name={MOCK_CANDIDATE.name}
                resumeName={MOCK_CANDIDATE.resumeName}
                interviewType={MOCK_CANDIDATE.interviewType}
                difficulty={MOCK_CANDIDATE.difficulty}
              />
            </div>

            {/* Card 3: Interview Progress (160px) */}
            <div className="shrink-0">
              <ProgressTracker
                currentIndex={currentIndex}
                totalQuestions={MOCK_QUESTIONS.length}
                answeredCount={savedAnswers.filter((a) => a.status === "answered" && a.answer.trim()).length}
                skippedCount={savedAnswers.filter((a) => a.status === "skipped").length}
                remainingTimeText={getRemainingTimeText()}
              />
            </div>

            {/* Card 4: AI Notes (180px) */}
            <div className="shrink-0">
              <LiveNotes notes={currentQuestion?.mockFeedback || []} />
            </div>

            {/* Card 5: Conversation Log (Remaining height) */}
            <div className="flex-grow min-h-0">
              <ConversationPanel logs={dialogueLogs} />
            </div>
          </div>
        }
      />

      {/* Confirmation Exit Drawer Modal */}
      <ConfirmExitDialog
        isOpen={showConfirmExit}
        onClose={() => setShowConfirmExit(false)}
        onConfirm={handleConfirmExit}
      />

    </div>
  );
}

export default StartInterview;
