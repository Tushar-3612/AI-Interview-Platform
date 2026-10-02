import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Mic, MicOff, Keyboard } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api";

/**
 * Filter out pure Whisper / STT hallucinations during silence
 * (e.g. "Thank you.", "Thanks for watching.", "Bye.", etc.)
 */
const filterHallucinations = (str) => {
  if (!str || typeof str !== "string") return "";
  const trimmed = str.trim();
  const lower = trimmed.toLowerCase().replace(/[.,!?;:"'\-]/g, "").trim();
  const bad = new Set([
    "thank you",
    "thank you so much",
    "thank you very much",
    "thanks",
    "thanks for watching",
    "thank you for watching",
    "bye",
    "goodbye",
    "you",
    "so",
    "subtitles by",
    "translated by",
    "subscribe",
    "like and subscribe",
    "mbc",
    "silence",
    "silence.",
    "okay thank you",
    "watching",
    "please subscribe",
  ]);
  if (bad.has(lower)) return "";
  return trimmed;
};

/**
 * NLP Text Post-Processing & Entity Normalization Pipeline
 * 1. Technical Entity Recognition (NER) & Casing (SQL, Null Hypothesis, Python, Machine Learning, etc.)
 * 2. Verbal Filler & Noise Removal (disfluency cleaning: "um", "uh", "err")
 * 3. Stutter / Repeated word deduplication ("the the" -> "the")
 * 4. Sentence Capitalization & Grammar normalization
 */
export function applyNLPTextPipeline(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  let text = rawText.trim();
  if (!text) return "";

  // 1. Remove verbal fillers if at start or standalone: "um", "uh", "uhh", "err"
  text = text.replace(/^(um+|uh+|uhh+|err+)\b\s*/gi, "");
  text = text.replace(/\s+\b(um+|uh+|uhh+|err+)\b(?=\s+)/gi, " ");

  // 2. Deduplicate stuttered adjacent words: "the the" -> "the", "is is" -> "is"
  text = text.replace(/\b(\w+)\s+\1\b/gi, "$1");

  // 3. Technical Named Entity Recognition (NER) & Normalization
  const techEntities = [
    { pattern: /\bnull\s*hypothesis\b/gi, replacement: "null hypothesis" },
    { pattern: /\balternative\s*hypothesis\b/gi, replacement: "alternative hypothesis" },
    { pattern: /\bprimary\s*key\b/gi, replacement: "primary key" },
    { pattern: /\bforeign\s*key\b/gi, replacement: "foreign key" },
    { pattern: /\bmachine\s*learning\b/gi, replacement: "machine learning" },
    { pattern: /\bdeep\s*learning\b/gi, replacement: "deep learning" },
    { pattern: /\bneural\s*network(s)?\b/gi, replacement: "neural network$1" },
    { pattern: /\bartificial\s*intelligence\b/gi, replacement: "artificial intelligence" },
    { pattern: /\bnode\s*js\b/gi, replacement: "Node.js" },
    { pattern: /\breact\s*js\b/gi, replacement: "React" },
    { pattern: /\bnext\s*js\b/gi, replacement: "Next.js" },
    { pattern: /\bexpress\s*js\b/gi, replacement: "Express.js" },
    { pattern: /\bjavascript\b/gi, replacement: "JavaScript" },
    { pattern: /\btypescript\b/gi, replacement: "TypeScript" },
    { pattern: /\bpython\b/gi, replacement: "Python" },
    { pattern: /\bmongodb\b/gi, replacement: "MongoDB" },
    { pattern: /\bpostgresql\b/gi, replacement: "PostgreSQL" },
    { pattern: /\bpostgres\b/gi, replacement: "PostgreSQL" },
    { pattern: /\bmysql\b/gi, replacement: "MySQL" },
    { pattern: /\bsqlite\b/gi, replacement: "SQLite" },
    { pattern: /\bsql\b/gi, replacement: "SQL" },
    { pattern: /\bnosql\b/gi, replacement: "NoSQL" },
    { pattern: /\bjwt\b/gi, replacement: "JWT" },
    { pattern: /\brest\s*api\b/gi, replacement: "REST API" },
    { pattern: /\brest\s*apis\b/gi, replacement: "REST APIs" },
    { pattern: /\bgraphql\b/gi, replacement: "GraphQL" },
    { pattern: /\bdocker\b/gi, replacement: "Docker" },
    { pattern: /\bkubernetes\b/gi, replacement: "Kubernetes" },
    { pattern: /\bapi\b/gi, replacement: "API" },
    { pattern: /\bapis\b/gi, replacement: "APIs" },
    { pattern: /\bjson\b/gi, replacement: "JSON" },
    { pattern: /\bhtml\b/gi, replacement: "HTML" },
    { pattern: /\bcss\b/gi, replacement: "CSS" },
    { pattern: /\bgit\b/gi, replacement: "Git" },
    { pattern: /\bgithub\b/gi, replacement: "GitHub" },
    { pattern: /\bgitlab\b/gi, replacement: "GitLab" },
    { pattern: /\bci\/cd\b/gi, replacement: "CI/CD" },
    { pattern: /\boops\b/gi, replacement: "OOP" },
  ];

  for (const { pattern, replacement } of techEntities) {
    text = text.replace(pattern, replacement);
  }

  // 4. Capitalize standalone pronoun " i " -> " I "
  text = text.replace(/\b(i)\b/g, "I");

  // 5. Sentence casing: capitalize first letter of string and after ., !, ?
  text = text.replace(/(^\s*|\.\s*|\?\s*|\!\s*)([a-z])/g, (_, prefix, char) => {
    return prefix + char.toUpperCase();
  });

  return text.trim();
}

/**
 * InterviewAnswerInput
 * 
 * Continuous Speech-to-Text with Non-Destructive Appending:
 * - When speaking, stopping, and speaking again, previous text is NEVER cleared.
 * - Words stream continuously and append directly into the input field.
 * - Real-time NLP entity recognition and formatting applied.
 */
const InterviewAnswerInput = forwardRef(function InterviewAnswerInput(
  {
    value = "",
    onChange,
    questionId = "",
    placeholder,
    rows = 6,
    className = "",
    textareaClassName = "",
    textareaStyle = {},
    accentColor = "#FF6B35",
    helperText = "Type or speak your answer below. It will be evaluated by AI for correctness and completeness.",
    showHelperText = true,
    showCharacterCount = true,
    showClearButton = true,
    disabled = false,
    defaultMode = "type", // "type" | "listen"
    mode: controlledMode,
    onModeChange,
    onListeningChange,
    actions,
  },
  ref
) {
  // Active mode: "type" | "listen"
  const [currentMode, setCurrentMode] = useState(controlledMode || defaultMode || "type");
  const [isListening, setIsListening] = useState(false);

  // Synchronization refs
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const textareaRef = useRef(null);

  // Dictation streaming buffers
  // committedTextRef stores all text committed prior to current speech utterance
  const committedTextRef = useRef(value || "");
  const currentSessionSpeechRef = useRef("");
  const isListeningModeRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const fallbackRecorderRef = useRef(null);
  const fallbackStreamRef = useRef(null);

  // Hardware & Recognition refs
  const recognitionRef = useRef(null);

  // Stop listening completely
  const stopVoiceRecording = useCallback(() => {
    isListeningModeRef.current = false;
    setIsListening(false);
    onListeningChange?.(false);

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (fallbackRecorderRef.current && fallbackRecorderRef.current.state !== "inactive") {
      try {
        fallbackRecorderRef.current.stop();
      } catch {}
      fallbackRecorderRef.current = null;
    }

    if (fallbackStreamRef.current) {
      try {
        fallbackStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      fallbackStreamRef.current = null;
    }

    // Commit final text cleanly
    if (valueRef.current) {
      committedTextRef.current = valueRef.current;
    }
    currentSessionSpeechRef.current = "";
  }, [onListeningChange]);

  // Restart native recognition seamlessly on pause without dropping committed text
  const restartListening = useCallback(() => {
    if (!isListeningModeRef.current) return;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    restartTimeoutRef.current = setTimeout(() => {
      if (isListeningModeRef.current) {
        startNativeRecognition();
      }
    }, 60);
  }, []);

  // Backend Whisper NLP Fallback
  const startWhisperFallback = async () => {
    if (!isListeningModeRef.current || fallbackRecorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      fallbackStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      fallbackRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 800 && isListeningModeRef.current) {
          const formData = new FormData();
          formData.append("audio", e.data, "audio_segment.webm");
          try {
            const res = await api.post("/api/interview/stt", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            if (res.data?.success && res.data.transcript) {
              const text = applyNLPTextPipeline(filterHallucinations(res.data.transcript));
              if (text && isListeningModeRef.current) {
                const current = (valueRef.current || "").trim();
                const updated = current ? `${current} ${text}` : text;
                valueRef.current = updated;
                committedTextRef.current = updated;
                onChange?.(updated);
              }
            }
          } catch (err) {
            console.warn("[Whisper Fallback] STT error:", err?.message);
          }
        }
      };

      recorder.start(2500);
    } catch (err) {
      console.warn("[Whisper Fallback] Mic error:", err?.message);
    }
  };

  // Native SpeechRecognition
  const startNativeRecognition = useCallback(() => {
    if (!isListeningModeRef.current) return false;

    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      startWhisperFallback();
      return false;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let interimText = "";
        let newlyFinal = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) {
            newlyFinal += trans + " ";
          } else {
            interimText += trans;
          }
        }

        if (newlyFinal) {
          const cleanFinal = filterHallucinations(newlyFinal);
          if (cleanFinal) {
            currentSessionSpeechRef.current = (
              currentSessionSpeechRef.current ? currentSessionSpeechRef.current.trim() + " " : ""
            ) + cleanFinal.trim();
          }
        }

        // Base text is everything previously committed in the textarea
        const base = (committedTextRef.current || "").trim();
        const sessionFinal = (currentSessionSpeechRef.current || "").trim();
        const interim = (interimText || "").trim();

        // Concatenate previous text + session finalized + live interim
        const parts = [base, sessionFinal, interim].filter(Boolean);
        const rawCombined = parts.join(" ");
        const nlpProcessed = applyNLPTextPipeline(rawCombined);

        if (nlpProcessed && nlpProcessed !== valueRef.current) {
          valueRef.current = nlpProcessed;
          onChange?.(nlpProcessed);
        }
      };

      recognition.onerror = (event) => {
        console.warn("[SpeechRecognition] error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          toast.error("Microphone permission denied. Please allow microphone access.");
          stopVoiceRecording();
          return;
        }

        if (event.error === "network") {
          startWhisperFallback();
          return;
        }

        if (isListeningModeRef.current) {
          restartListening();
        }
      };

      recognition.onend = () => {
        // Crucial: Commit the current full text into committedTextRef so pauses NEVER clear previous words!
        if (valueRef.current) {
          committedTextRef.current = valueRef.current;
        }
        currentSessionSpeechRef.current = "";

        if (isListeningModeRef.current) {
          restartListening();
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
      setIsListening(true);
      return true;
    } catch (err) {
      console.warn("[SpeechRecognition] start exception, using fallback:", err);
      startWhisperFallback();
      return false;
    }
  }, [onChange, restartListening, stopVoiceRecording]);

  // Start continuous listening
  const startContinuousListening = () => {
    if (disabled) return;

    isListeningModeRef.current = true;
    setIsListening(true);
    onListeningChange?.(true);

    // Snapshot existing text in textarea as committed base
    committedTextRef.current = valueRef.current || "";
    currentSessionSpeechRef.current = "";

    startNativeRecognition();
  };

  // Switch between Typing Mode and Listening Mode
  const switchMode = (newMode) => {
    if (disabled) return;
    if (newMode === currentMode) return;

    setCurrentMode(newMode);
    onModeChange?.(newMode);

    if (newMode === "type") {
      stopVoiceRecording();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      toast("Typing Mode active.", { icon: "⌨️", duration: 1500 });
    } else if (newMode === "listen") {
      startContinuousListening();
      toast("Listening Mode active — speak your answer...", { icon: "🎙️", duration: 2000 });
    }
  };

  // Clear Answer Text
  const handleClear = useCallback(() => {
    committedTextRef.current = "";
    currentSessionSpeechRef.current = "";
    valueRef.current = "";
    onChange?.("");
    toast("Answer cleared.", { duration: 1500 });
  }, [onChange]);

  // Imperative Ref Handle
  useImperativeHandle(
    ref,
    () => ({
      stopVoiceRecording,
      isListening,
      mode: currentMode,
      setMode: switchMode,
    }),
    [stopVoiceRecording, isListening, currentMode]
  );

  // Stop recording when switching questions
  useEffect(() => {
    stopVoiceRecording();
    committedTextRef.current = "";
    currentSessionSpeechRef.current = "";
    if (currentMode === "listen") {
      setTimeout(() => {
        startContinuousListening();
      }, 100);
    }
  }, [questionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceRecording();
    };
  }, [stopVoiceRecording]);

  const currentLength = (value || "").length;

  return (
    <div className={`space-y-2.5 flex flex-col ${className}`}>
      {/* Header bar: Helper text + Mode Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        {showHelperText && (
          <p
            className="text-xs sm:text-sm font-medium leading-tight flex-1 min-w-[200px]"
            style={{ color: "var(--text-secondary, rgba(255, 255, 255, 0.7))" }}
          >
            {helperText}
          </p>
        )}

        {/* Mode Selector Pill: Typing Mode & Listening Mode */}
        <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 shrink-0 shadow-inner">
          {/* Typing Mode Tab */}
          <button
            type="button"
            onClick={() => switchMode("type")}
            disabled={disabled}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
              currentMode === "type"
                ? "bg-white/15 text-white shadow-sm border border-white/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
            title="Switch to typing mode (keyboard input)"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Typing Mode</span>
          </button>

          {/* Listening Mode Tab */}
          <button
            type="button"
            onClick={() => switchMode("listen")}
            disabled={disabled}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
              currentMode === "listen"
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm shadow-orange-500/10"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
            title="Switch to listening mode (continuous voice input)"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Listening Mode</span>
            {currentMode === "listen" && isListening && (
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Direct Input Field (Textarea) */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <textarea
          ref={textareaRef}
          value={value || ""}
          onChange={(e) => {
            const nextVal = e.target.value;
            valueRef.current = nextVal;
            committedTextRef.current = nextVal;
            currentSessionSpeechRef.current = "";
            onChange?.(nextVal);
          }}
          disabled={disabled}
          placeholder={
            placeholder ||
            (currentMode === "listen"
              ? "Listening continuously... speak freely and your words will append here directly."
              : "Type your answer here using your keyboard...")
          }
          rows={rows}
          className={`w-full flex-1 p-3.5 border rounded-xl resize-y focus:outline-none focus:ring-2 font-normal leading-relaxed transition-all text-xs sm:text-sm ${textareaClassName}`}
          style={{
            background: "var(--input-bg, var(--card-bg, rgba(15, 18, 28, 0.7)))",
            borderColor:
              currentMode === "listen"
                ? isListening
                  ? "#10B981"
                  : "rgba(16, 185, 129, 0.45)"
                : "var(--card-border, rgba(255, 255, 255, 0.1))",
            color: "var(--text-primary, #ffffff)",
            ...textareaStyle,
          }}
        />
      </div>

      {/* Footer bar: Status, Character count, Clear button, and extra actions */}
      <div
        className="flex items-center justify-between text-xs pt-1 shrink-0"
        style={{ color: "var(--text-muted, rgba(255, 255, 255, 0.4))" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-white/40 flex items-center gap-1.5">
            {currentMode === "listen" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400/80">Continuous Speech Appending Active</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>Typing Mode Active</span>
              </>
            )}
          </span>
          {showCharacterCount && <span>{currentLength} characters</span>}
          {showClearButton && currentLength > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs hover:underline cursor-pointer text-white/50 hover:text-white transition-colors"
            >
              Clear Answer
            </button>
          )}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
});

export default InterviewAnswerInput;
