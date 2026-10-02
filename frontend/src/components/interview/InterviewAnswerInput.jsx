import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Mic, Keyboard, CheckCircle2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// DEV LOGGING — only fires in development, never leaks sensitive data in prod
// ─────────────────────────────────────────────────────────────────────────────
const IS_DEV = import.meta.env.DEV;
function devLog(tag, ...args) {
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.log(`[${tag}]`, ...args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HALLUCINATION FILTER — reject common silence/ambient-noise transcripts
// ─────────────────────────────────────────────────────────────────────────────
const HALLUCINATION_SET = new Set([
  "thank you", "thank you so much", "thank you very much",
  "thanks", "thanks for watching", "thank you for watching",
  "bye", "goodbye", "you", "so",
  "subtitles by", "translated by",
  "subscribe", "like and subscribe",
  "mbc", "silence", "silence.",
  "okay thank you", "watching", "please subscribe",
  "um", "uh", "hmm", "mmm", "ah", "oh",
]);

const filterHallucinations = (str) => {
  if (!str || typeof str !== "string") return "";
  const trimmed = str.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase().replace(/[.,!?;:"'\-]/g, "").trim();
  if (HALLUCINATION_SET.has(lower)) {
    devLog("HALLUCINATION FILTER", `Rejected: "${trimmed}"`);
    return "";
  }
  // Reject purely punctuation or single char
  if (trimmed.replace(/[^a-zA-Z0-9]/g, "").length < 2) return "";
  return trimmed;
};

// ─────────────────────────────────────────────────────────────────────────────
// PHONETIC TECHNICAL TERM DICTIONARY
// Maps what STT hears to what was actually said
// Ordered from most-specific multi-word to single-word to avoid over-substitution
// ─────────────────────────────────────────────────────────────────────────────
const PHONETIC_CORRECTIONS = [
  // Multi-word phonetic mistakes (order matters — longer first)
  { pattern: /\bno\s+sequel\b/gi, replacement: "NoSQL" },
  { pattern: /\bno\s+sql\b/gi, replacement: "NoSQL" },
  { pattern: /\bmy\s+sequel\b/gi, replacement: "MySQL" },
  { pattern: /\bmy\s+sql\b/gi, replacement: "MySQL" },
  { pattern: /\bpost\s+gres\b/gi, replacement: "PostgreSQL" },
  { pattern: /\bpost\s+grass\b/gi, replacement: "PostgreSQL" },
  { pattern: /\bpost\s+grease\b/gi, replacement: "PostgreSQL" },
  { pattern: /\bpost\s+grace\b/gi, replacement: "PostgreSQL" },
  { pattern: /\bpost\s+cres\b/gi, replacement: "PostgreSQL" },
  { pattern: /\bpost\s+gresql\b/gi, replacement: "PostgreSQL" },
  { pattern: /\bpostgres\s+sql\b/gi, replacement: "PostgreSQL" },
  { pattern: /\bmongo\s+db\b/gi, replacement: "MongoDB" },
  { pattern: /\bnode\s+js\b/gi, replacement: "Node.js" },
  { pattern: /\breact\s+js\b/gi, replacement: "React" },
  { pattern: /\bnext\s+js\b/gi, replacement: "Next.js" },
  { pattern: /\bexpress\s+js\b/gi, replacement: "Express.js" },
  { pattern: /\bvue\s+js\b/gi, replacement: "Vue.js" },
  { pattern: /\bangular\s+js\b/gi, replacement: "AngularJS" },
  { pattern: /\brest\s+api\b/gi, replacement: "REST API" },
  { pattern: /\brest\s+apis\b/gi, replacement: "REST APIs" },
  { pattern: /\bgraph\s+ql\b/gi, replacement: "GraphQL" },
  { pattern: /\bc\s+plus\s+plus\b/gi, replacement: "C++" },
  { pattern: /\bsee\s+plus\s+plus\b/gi, replacement: "C++" },
  { pattern: /\bmachine\s+learning\b/gi, replacement: "Machine Learning" },
  { pattern: /\bdeep\s+learning\b/gi, replacement: "Deep Learning" },
  { pattern: /\bneural\s+network(s)?\b/gi, replacement: "Neural Network$1" },
  { pattern: /\brandom\s+forest\b/gi, replacement: "Random Forest" },
  { pattern: /\blinear\s+regression\b/gi, replacement: "Linear Regression" },
  { pattern: /\blogistic\s+regression\b/gi, replacement: "Logistic Regression" },
  { pattern: /\bspring\s+boot\b/gi, replacement: "Spring Boot" },
  { pattern: /\bfast\s+api\b/gi, replacement: "FastAPI" },
  { pattern: /\bci\s+cd\b/gi, replacement: "CI/CD" },
  { pattern: /\bdev\s+ops\b/gi, replacement: "DevOps" },
  { pattern: /\bnull\s+hypothesis\b/gi, replacement: "null hypothesis" },
  { pattern: /\balternative\s+hypothesis\b/gi, replacement: "alternative hypothesis" },
  { pattern: /\bprimary\s+key\b/gi, replacement: "primary key" },
  { pattern: /\bforeign\s+key\b/gi, replacement: "foreign key" },
  { pattern: /\bartificial\s+intelligence\b/gi, replacement: "Artificial Intelligence" },
  { pattern: /\bnatural\s+language\s+processing\b/gi, replacement: "NLP" },
  // Single-word phonetic mistakes
  { pattern: /\bsequel\b/gi, replacement: "SQL" },
  { pattern: /\bjason\b/gi, replacement: "JSON" },
  { pattern: /\bkubernete\b/gi, replacement: "Kubernetes" },
  { pattern: /\bkubernates\b/gi, replacement: "Kubernetes" },
  { pattern: /\bkubernatis\b/gi, replacement: "Kubernetes" },
  { pattern: /\bexgboost\b/gi, replacement: "XGBoost" },
  { pattern: /\bpyorch\b/gi, replacement: "PyTorch" },
  { pattern: /\bscikit\s*learn\b/gi, replacement: "Scikit-learn" },
  // Named-entity casing normalizations
  { pattern: /\bjavascript\b/gi, replacement: "JavaScript" },
  { pattern: /\btypescript\b/gi, replacement: "TypeScript" },
  { pattern: /\bpython\b/gi, replacement: "Python" },
  { pattern: /\bmongodb\b/gi, replacement: "MongoDB" },
  { pattern: /\bpostgresql\b/gi, replacement: "PostgreSQL" },
  { pattern: /\bpostgres\b/gi, replacement: "PostgreSQL" },
  { pattern: /\bmysql\b/gi, replacement: "MySQL" },
  { pattern: /\bsqlite\b/gi, replacement: "SQLite" },
  { pattern: /\bnosql\b/gi, replacement: "NoSQL" },
  { pattern: /\bsql\b/gi, replacement: "SQL" },
  { pattern: /\bjwt\b/gi, replacement: "JWT" },
  { pattern: /\bgraphql\b/gi, replacement: "GraphQL" },
  { pattern: /\bdocker\b/gi, replacement: "Docker" },
  { pattern: /\bkubernetes\b/gi, replacement: "Kubernetes" },
  { pattern: /\bgithub\b/gi, replacement: "GitHub" },
  { pattern: /\bgitlab\b/gi, replacement: "GitLab" },
  { pattern: /\bgit\b/gi, replacement: "Git" },
  { pattern: /\bapi\b/gi, replacement: "API" },
  { pattern: /\bapis\b/gi, replacement: "APIs" },
  { pattern: /\bjson\b/gi, replacement: "JSON" },
  { pattern: /\bhtml\b/gi, replacement: "HTML" },
  { pattern: /\bcss\b/gi, replacement: "CSS" },
  { pattern: /\baws\b/gi, replacement: "AWS" },
  { pattern: /\bgcp\b/gi, replacement: "GCP" },
  { pattern: /\boops\b/gi, replacement: "OOP" },
  { pattern: /\boop\b/gi, replacement: "OOP" },
  { pattern: /\bxgboost\b/gi, replacement: "XGBoost" },
  { pattern: /\btensorflow\b/gi, replacement: "TensorFlow" },
  { pattern: /\bpytorch\b/gi, replacement: "PyTorch" },
  { pattern: /\bkeras\b/gi, replacement: "Keras" },
  { pattern: /\bmatplotlib\b/gi, replacement: "Matplotlib" },
  { pattern: /\bnumpy\b/gi, replacement: "NumPy" },
  { pattern: /\bpandas\b/gi, replacement: "Pandas" },
  { pattern: /\bcnn\b/gi, replacement: "CNN" },
  { pattern: /\brnn\b/gi, replacement: "RNN" },
  { pattern: /\blstm\b/gi, replacement: "LSTM" },
  { pattern: /\bnlp\b/gi, replacement: "NLP" },
  { pattern: /\bllm\b/gi, replacement: "LLM" },
  { pattern: /\bgpt\b/gi, replacement: "GPT" },
  { pattern: /\bwebpack\b/gi, replacement: "Webpack" },
  { pattern: /\bbabel\b/gi, replacement: "Babel" },
  { pattern: /\bdjango\b/gi, replacement: "Django" },
  { pattern: /\bfastapi\b/gi, replacement: "FastAPI" },
];

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT-AWARE CORRECTION
// Extracts technical terms from the question text and enforces correct casing
// ─────────────────────────────────────────────────────────────────────────────
function buildContextTerms(questionContext) {
  if (!questionContext) return [];
  const techPattern = /\b([A-Z][a-zA-Z0-9.+#_]*(?:\.[a-zA-Z0-9]+)*)\b/g;
  const matches = [];
  let m;
  while ((m = techPattern.exec(questionContext)) !== null) {
    const term = m[1];
    if (term.length >= 2 && !/^[A-Z]$/.test(term)) {
      matches.push(term);
    }
  }
  return [...new Set(matches)];
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL NLP + TECHNICAL CORRECTION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
export function applyNLPTextPipeline(rawText, context) {
  if (!rawText || typeof rawText !== "string") return "";
  let text = rawText.trim();
  if (!text) return "";

  devLog("NLP CLEANUP", "Input:", text);

  // 1. Remove verbal fillers at start or as standalone
  text = text.replace(/^(um+|uh+|uhh+|err+|hmm+|mm+)\b\s*/gi, "");
  text = text.replace(/\s+\b(um+|uh+|uhh+|err+|hmm+)\b(?=\s+)/gi, " ");

  // 2. Deduplicate stuttered adjacent words: "the the" -> "the"
  text = text.replace(/\b(\w+)\s+\1\b/gi, "$1");

  // 3. Phonetic Technical Term Normalization
  devLog("TECH CORRECTION", "Before:", text);
  for (const { pattern, replacement } of PHONETIC_CORRECTIONS) {
    text = text.replace(pattern, replacement);
  }
  devLog("TECH CORRECTION", "After:", text);

  // 4. Context-aware correction: enforce casing of terms in the question
  const questionContext = context && context.questionContext;
  if (questionContext) {
    const contextTerms = buildContextTerms(questionContext);
    if (contextTerms.length > 0) {
      devLog("CONTEXT CORRECTION", "Terms:", contextTerms);
      for (const term of contextTerms) {
        try {
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp("\\b" + escaped + "\\b", "gi");
          text = text.replace(regex, term);
        } catch (_) {
          // skip malformed
        }
      }
    }
  }

  // 5. Capitalize standalone "i" -> "I"
  text = text.replace(/\b(i)\b/g, "I");

  // 6. Sentence casing
  text = text.replace(/(^\s*|\.\s*|\?\s*|\!\s*)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase());

  // 7. Collapse extra whitespace
  text = text.replace(/\s{2,}/g, " ").trim();

  devLog("FINAL TRANSCRIPT", text);
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE CONSTANTS & HELPER
// ─────────────────────────────────────────────────────────────────────────────
const CONFIDENCE_LOW = 0.60;

function evaluateConfidence(event, resultIndex) {
  try {
    const conf = event.results[resultIndex] && event.results[resultIndex][0] && event.results[resultIndex][0].confidence;
    if (typeof conf === "number" && conf > 0) {
      devLog("CONFIDENCE", "Browser confidence:", conf.toFixed(3));
      return conf;
    }
  } catch (_) {}
  // Fallback estimate from word count
  const transcript = (event.results[resultIndex] && event.results[resultIndex][0] && event.results[resultIndex][0].transcript) || "";
  const wordCount = transcript.trim().split(/\s+/).length;
  const estimated = wordCount >= 4 ? 0.80 : wordCount >= 2 ? 0.70 : 0.55;
  devLog("CONFIDENCE", "Estimated:", estimated);
  return estimated;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const InterviewAnswerInput = forwardRef(function InterviewAnswerInput(
  {
    value,
    onChange,
    questionId,
    questionContext,
    questionTopic,
    placeholder,
    rows,
    className,
    textareaClassName,
    textareaStyle,
    accentColor,
    helperText,
    showHelperText,
    showCharacterCount,
    showClearButton,
    disabled,
    defaultMode,
    mode: controlledMode,
    onModeChange,
    onListeningChange,
    actions,
  },
  ref
) {
  // defaults
  value = value || "";
  questionId = questionId || "";
  questionContext = questionContext || "";
  questionTopic = questionTopic || "";
  rows = rows || 6;
  className = className || "";
  textareaClassName = textareaClassName || "";
  textareaStyle = textareaStyle || {};
  accentColor = accentColor || "#FF6B35";
  helperText = helperText !== undefined ? helperText : "Type or speak your answer below. It will be evaluated by AI for correctness and completeness.";
  showHelperText = showHelperText !== false;
  showCharacterCount = showCharacterCount !== false;
  showClearButton = showClearButton !== false;
  disabled = !!disabled;
  defaultMode = defaultMode || "type";

  // ── Mode & listening state ─────────────────────────────────────────────────
  const [currentMode, setCurrentMode] = useState(controlledMode || defaultMode);
  const [isListening, setIsListening] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const textareaRef = useRef(null);
  const committedTextRef = useRef(value || "");
  const currentSessionSpeechRef = useRef("");
  const isListeningModeRef = useRef(false);
  const isStartingRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastAcceptedRef = useRef("");

  // Keep context refs fresh to avoid stale closures in callbacks
  const questionContextRef = useRef(questionContext);
  const questionTopicRef = useRef(questionTopic);
  useEffect(() => { questionContextRef.current = questionContext; }, [questionContext]);
  useEffect(() => { questionTopicRef.current = questionTopic; }, [questionTopic]);

  // ── stopVoiceRecording ─────────────────────────────────────────────────────
  const stopVoiceRecording = useCallback(() => {
    isListeningModeRef.current = false;
    isStartingRef.current = false;
    setIsListening(false);
    if (onListeningChange) onListeningChange(false);

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    if (valueRef.current) {
      committedTextRef.current = valueRef.current;
    }
    currentSessionSpeechRef.current = "";
  }, [onListeningChange]);

  // ── restartListening ───────────────────────────────────────────────────────
  const restartListening = useCallback((delay) => {
    delay = delay || 200;
    if (!isListeningModeRef.current) return;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    restartTimeoutRef.current = setTimeout(() => {
      if (isListeningModeRef.current) startNativeRecognition();
    }, delay);
  }, []);

  // ── processAndAppendTranscript ─────────────────────────────────────────────
  const processAndAppendTranscript = useCallback((rawTranscript, confidence, isFinal) => {
    if (confidence === undefined) confidence = 1.0;
    if (isFinal === undefined) isFinal = true;
    if (!rawTranscript) return;

    // Hallucination filter
    const filtered = filterHallucinations(rawTranscript);
    if (!filtered) return;

    // Duplicate guard
    if (filtered.trim().toLowerCase() === lastAcceptedRef.current.toLowerCase()) {
      devLog("STT", "Duplicate skipped.");
      return;
    }

    // NLP + Technical correction
    const ctx = { questionContext: questionContextRef.current, questionTopic: questionTopicRef.current };
    const cleaned = applyNLPTextPipeline(filtered, ctx);
    if (!cleaned) return;

    // Confidence evaluation (final results only)
    if (isFinal) {
      devLog("CONFIDENCE", "Score:", confidence.toFixed(3), "for:", cleaned);
      if (confidence < CONFIDENCE_LOW && cleaned.split(/\s+/).length >= 3) {
        devLog("CONFIDENCE", "Low confidence — showing confirmation UI.");
        setPendingConfirmation({ text: cleaned });
        return;
      }
    }

    // Commit
    lastAcceptedRef.current = filtered.trim();
    currentSessionSpeechRef.current = (currentSessionSpeechRef.current
      ? currentSessionSpeechRef.current.trim() + " "
      : "") + cleaned.trim();

    const base = (committedTextRef.current || "").trim();
    const session = (currentSessionSpeechRef.current || "").trim();
    const combined = [base, session].filter(Boolean).join(" ");
    const final = applyNLPTextPipeline(combined, ctx);

    if (final && final !== valueRef.current) {
      valueRef.current = final;
      if (onChange) onChange(final);
    }
  }, [onChange]);

  // ── startNativeRecognition ─────────────────────────────────────────────────
  const startNativeRecognition = useCallback(() => {
    if (!isListeningModeRef.current || isStartingRef.current) return false;

    const SpeechRecognition = typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) {
      devLog("STT", "Not supported.");
      return false;
    }

    isStartingRef.current = true;

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onstart = null;
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isStartingRef.current = false;
        setIsListening(true);
        devLog("STT", "Started, lang:", recognition.lang);
      };

      recognition.onresult = (event) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = (event.results[i][0] && event.results[i][0].transcript) || "";
          if (event.results[i].isFinal) {
            devLog("STT", "Final:", trans);
            const conf = evaluateConfidence(event, i);
            processAndAppendTranscript(trans, conf, true);
          } else {
            interimText += trans;
          }
        }

        // Live interim preview (non-destructive)
        if (interimText) {
          const ctx = { questionContext: questionContextRef.current, questionTopic: questionTopicRef.current };
          const base = (committedTextRef.current || "").trim();
          const session = (currentSessionSpeechRef.current || "").trim();
          const interim = interimText.trim();
          const combined = [base, session, interim].filter(Boolean).join(" ");
          const preview = applyNLPTextPipeline(combined, ctx);
          if (preview && preview !== valueRef.current) {
            valueRef.current = preview;
            if (onChange) onChange(preview);
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        devLog("STT", "Error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          toast.error("Microphone permission denied. Please allow microphone access.");
          stopVoiceRecording();
          return;
        }
        if (isListeningModeRef.current) restartListening(300);
      };

      recognition.onend = () => {
        devLog("STT", "Ended — committing.");
        if (valueRef.current) committedTextRef.current = valueRef.current;
        currentSessionSpeechRef.current = "";
        if (isListeningModeRef.current) {
          restartListening(200);
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch (err) {
      isStartingRef.current = false;
      devLog("STT", "Start exception:", err && err.message);
      if (isListeningModeRef.current) restartListening(400);
      return false;
    }
  }, [onChange, processAndAppendTranscript, restartListening, stopVoiceRecording]);

  // ── startContinuousListening ───────────────────────────────────────────────
  const startContinuousListening = () => {
    if (disabled) return;
    isListeningModeRef.current = true;
    setIsListening(true);
    if (onListeningChange) onListeningChange(true);
    committedTextRef.current = valueRef.current || "";
    currentSessionSpeechRef.current = "";
    lastAcceptedRef.current = "";
    startNativeRecognition();
  };

  // ── Watchdog Heartbeat ─────────────────────────────────────────────────────
  useEffect(() => {
    if (currentMode !== "listen" || !isListeningModeRef.current) return;
    const watchdog = setInterval(() => {
      if (isListeningModeRef.current && !isStartingRef.current) {
        if (!recognitionRef.current || !isListening) {
          devLog("STT", "Watchdog restart.");
          startNativeRecognition();
        }
      }
    }, 1500);
    return () => clearInterval(watchdog);
  }, [currentMode, isListening, startNativeRecognition]);

  // ── switchMode ─────────────────────────────────────────────────────────────
  const switchMode = (newMode) => {
    if (disabled) return;
    if (newMode === currentMode) {
      if (newMode === "listen" && !isListening) {
        startContinuousListening();
        toast("Listening Mode active — speak your answer...", { icon: "🎙️", duration: 2000 });
      }
      return;
    }
    setCurrentMode(newMode);
    if (onModeChange) onModeChange(newMode);
    setPendingConfirmation(null);

    if (newMode === "type") {
      stopVoiceRecording();
      setTimeout(() => { if (textareaRef.current) textareaRef.current.focus(); }, 50);
      toast("Typing Mode active.", { icon: "⌨️", duration: 1500 });
    } else {
      startContinuousListening();
      toast("Listening Mode active — speak your answer...", { icon: "🎙️", duration: 2000 });
    }
  };

  // ── Confirmation handlers ──────────────────────────────────────────────────
  const handleConfirmAccept = useCallback(() => {
    if (!pendingConfirmation) return;
    const ctx = { questionContext: questionContextRef.current, questionTopic: questionTopicRef.current };
    const cleaned = pendingConfirmation.text;
    lastAcceptedRef.current = cleaned;
    currentSessionSpeechRef.current = (currentSessionSpeechRef.current
      ? currentSessionSpeechRef.current.trim() + " "
      : "") + cleaned.trim();
    const base = (committedTextRef.current || "").trim();
    const session = (currentSessionSpeechRef.current || "").trim();
    const nlpProcessed = applyNLPTextPipeline([base, session].filter(Boolean).join(" "), ctx);
    if (nlpProcessed) {
      valueRef.current = nlpProcessed;
      if (onChange) onChange(nlpProcessed);
    }
    setPendingConfirmation(null);
    devLog("CONFIDENCE", "User confirmed.");
  }, [pendingConfirmation, onChange]);

  const handleConfirmRepeat = useCallback(() => {
    setPendingConfirmation(null);
    devLog("CONFIDENCE", "User requested repeat.");
  }, []);

  // ── handleClear ────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    committedTextRef.current = "";
    currentSessionSpeechRef.current = "";
    valueRef.current = "";
    lastAcceptedRef.current = "";
    setPendingConfirmation(null);
    if (onChange) onChange("");
    toast("Answer cleared.", { duration: 1500 });
  }, [onChange]);

  // ── Imperative Ref ─────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    stopVoiceRecording,
    isListening,
    mode: currentMode,
    setMode: switchMode,
  }), [stopVoiceRecording, isListening, currentMode]);

  // ── Auto-start on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (defaultMode === "listen") {
      const t = setTimeout(startContinuousListening, 250);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Question change: reset & restart ──────────────────────────────────────
  useEffect(() => {
    stopVoiceRecording();
    committedTextRef.current = "";
    currentSessionSpeechRef.current = "";
    lastAcceptedRef.current = "";
    setPendingConfirmation(null);
    if (currentMode === "listen") {
      const t = setTimeout(startContinuousListening, 300);
      return () => clearTimeout(t);
    }
  }, [questionId]);

  // ── Unmount cleanup ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopVoiceRecording(); };
  }, [stopVoiceRecording]);

  const currentLength = (value || "").length;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
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

        {/* Mode Selector Pill */}
        <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 shrink-0 shadow-inner">
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
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Textarea + Confirmation Pill */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <textarea
          ref={textareaRef}
          value={value || ""}
          onChange={(e) => {
            const nextVal = e.target.value;
            valueRef.current = nextVal;
            committedTextRef.current = nextVal;
            currentSessionSpeechRef.current = "";
            if (onChange) onChange(nextVal);
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
                ? isListening ? "#10B981" : "rgba(16, 185, 129, 0.45)"
                : "var(--card-border, rgba(255, 255, 255, 0.1))",
            color: "var(--text-primary, #ffffff)",
            ...textareaStyle,
          }}
        />

        {/* "Did I hear you correctly?" confirmation pill */}
        {pendingConfirmation && (
          <div
            className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs"
            style={{
              background: "rgba(234, 179, 8, 0.08)",
              borderColor: "rgba(234, 179, 8, 0.3)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <span className="shrink-0 mt-0.5">🎙️</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-yellow-400/90 mb-1 text-[11px] uppercase tracking-wide">
                Did I hear you correctly?
              </p>
              <p className="text-white/80 italic break-words">"{pendingConfirmation.text}"</p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleConfirmAccept}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all font-bold text-[11px]"
                >
                  <CheckCircle2 className="w-3 h-3" /> Correct
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRepeat}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-white/70 border border-white/15 hover:bg-white/10 transition-all font-bold text-[11px]"
                >
                  <RefreshCw className="w-3 h-3" /> Repeat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div
        className="flex items-center justify-between text-xs pt-1 shrink-0"
        style={{ color: "var(--text-muted, rgba(255, 255, 255, 0.4))" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-white/40 flex items-center gap-1.5">
            {currentMode === "listen" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400/80">Continuous Speech Active</span>
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