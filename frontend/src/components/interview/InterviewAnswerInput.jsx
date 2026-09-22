import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Mic, MicOff, Loader2, Sparkles, Volume2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api";

/**
 * InterviewAnswerInput
 * 
 * Production-quality, unified Speech-to-Text answer input component.
 * Shared across Real Interview and Company Mock / Technical Interview.
 * 
 * Features:
 * 1. High-accuracy backend transcription via Groq Whisper Large V3 with technical vocabulary biasing.
 * 2. Adaptive Voice Activity Detection (VAD) with ambient noise floor calibration.
 * 3. Pre-roll & post-roll buffering to prevent clipping beginning and trailing syllables of words.
 * 4. Silence rejection designed to minimize background noise and hallucination during pauses.
 * 5. Pause resilience: 1–8 second natural pauses do not disconnect or reset the answer.
 * 6. Non-destructive manual typing: users can edit, delete, type, or clear anytime without loss.
 * 7. Live audio amplitude visualizer for immediate visual feedback.
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
    onListeningChange,
    actions,
  },
  ref
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for visual meter
  const [speechStatus, setSpeechStatus] = useState("idle"); // "idle" | "listening" | "speaking" | "processing"

  // Synchronization refs
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Hardware & Audio processing refs
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // VAD & Buffering refs
  const isSpeechActiveRef = useRef(false);
  const speechFramesCountRef = useRef(0);
  const silenceTimerRef = useRef(null);
  const preRollChunksRef = useRef([]); // holds last ~500ms of audio before speech
  const currentSegmentChunksRef = useRef([]); // holds audio of active speech segment
  const activeMimeTypeRef = useRef("audio/webm");
  const segmentSeqRef = useRef(0);
  const isRecordingRef = useRef(false);

  // Stop & Flush Recording
  const stopVoiceRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setAudioLevel(0);
    setSpeechStatus("idle");
    onListeningChange?.(false);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Flush any pending active speech segment before stopping
    if (currentSegmentChunksRef.current.length > 0 && speechFramesCountRef.current > 2) {
      const finalChunks = [...currentSegmentChunksRef.current];
      currentSegmentChunksRef.current = [];
      const blob = new Blob(finalChunks, { type: activeMimeTypeRef.current });
      if (blob.size > 800) {
        sendAudioToSTT(blob, ++segmentSeqRef.current);
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    isSpeechActiveRef.current = false;
    speechFramesCountRef.current = 0;
    preRollChunksRef.current = [];
    currentSegmentChunksRef.current = [];
  }, [onListeningChange]);

  // Send audio segment to backend Groq Whisper STT endpoint
  const sendAudioToSTT = async (audioBlob, segmentId) => {
    if (!audioBlob || audioBlob.size < 600) return;

    setIsTranscribing(true);
    setSpeechStatus("processing");

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, `speech_segment_${segmentId}.webm`);

      const res = await api.post("/api/interview/stt", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 25000,
      });

      if (res.data?.success && res.data.transcript) {
        const text = res.data.transcript.trim();
        if (text) {
          const current = valueRef.current || "";
          const updated = current ? `${current.trim()} ${text}` : text;
          valueRef.current = updated;
          onChange?.(updated);
        }
      }
    } catch (err) {
      console.warn("[STT] Transcription error:", err?.response?.data?.message || err.message);
      // Non-blocking toast: keep existing transcript safe
      if (err?.response?.status === 503) {
        toast.error("STT service not configured on backend. You can continue typing.", { id: "stt-err" });
      }
    } finally {
      setIsTranscribing(false);
      if (isRecordingRef.current) {
        setSpeechStatus(isSpeechActiveRef.current ? "speaking" : "listening");
      }
    }
  };

  // Start Voice Recording with Adaptive VAD & Ring Buffering
  const startVoiceRecording = async () => {
    if (disabled) return;

    // Check browser MediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Microphone access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // Determine best supported MIME type dynamically
      const candidateTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/wav",
      ];
      let selectedMime = "";
      if (typeof MediaRecorder !== "undefined") {
        for (const type of candidateTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            selectedMime = type;
            break;
          }
        }
      }
      activeMimeTypeRef.current = selectedMime || "audio/webm";

      // Initialize Web Audio Context for RMS Energy VAD
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Initialize MediaRecorder in time-sliced mode (250ms chunks)
      const options = selectedMime ? { mimeType: selectedMime } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      preRollChunksRef.current = [];
      currentSegmentChunksRef.current = [];
      isSpeechActiveRef.current = false;
      speechFramesCountRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          if (isSpeechActiveRef.current) {
            // Actively recording a spoken segment
            currentSegmentChunksRef.current.push(e.data);
          } else {
            // Idle/quiet: maintain pre-roll ring buffer (last ~2-3 slices = ~500-750ms)
            preRollChunksRef.current.push(e.data);
            if (preRollChunksRef.current.length > 3) {
              preRollChunksRef.current.shift();
            }
          }
        }
      };

      recorder.start(250); // Emit audio data every 250ms
      isRecordingRef.current = true;
      setIsRecording(true);
      setSpeechStatus("listening");
      onListeningChange?.(true);
      toast.success("Microphone active. Speak your answer...", { icon: "🎙️", duration: 2000 });

      // Adaptive VAD loop
      const buffer = new Float32Array(analyser.fftSize);
      let ambientNoise = 0.004; // initial ambient floor baseline

      const vadLoop = () => {
        if (!isRecordingRef.current) return;

        analyser.getFloatTimeDomainData(buffer);

        // Calculate Root Mean Square (RMS) energy
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i++) {
          sumSquares += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sumSquares / buffer.length);

        // Update visual audio meter (scaled 0-100)
        const meterLevel = Math.min(100, Math.round(rms * 500));
        setAudioLevel(meterLevel);

        // Adaptive threshold relative to ambient background noise with hysteresis
        const speechThreshold = Math.max(0.007, ambientNoise * 2.2 + 0.003);
        const silenceThreshold = Math.max(0.005, ambientNoise * 1.5 + 0.002);

        if (rms > speechThreshold) {
          // Voice activity detected
          if (!isSpeechActiveRef.current) {
            isSpeechActiveRef.current = true;
            setSpeechStatus("speaking");
            // Prepend pre-roll buffer so beginning of words is never clipped
            currentSegmentChunksRef.current = [...preRollChunksRef.current];
            preRollChunksRef.current = [];
          }

          speechFramesCountRef.current++;

          // Clear any pending silence timeout while user is actively speaking
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (rms < silenceThreshold) {
          // Slowly track ambient noise floor during quiet periods
          ambientNoise = ambientNoise * 0.95 + rms * 0.05;

          if (isSpeechActiveRef.current && !silenceTimerRef.current) {
            // Candidate paused or finished phrase: wait 1300ms post-roll window
            silenceTimerRef.current = setTimeout(() => {
              if (isSpeechActiveRef.current) {
                isSpeechActiveRef.current = false;
                setSpeechStatus("listening");

                const segmentChunks = [...currentSegmentChunksRef.current];
                currentSegmentChunksRef.current = [];
                const frameCount = speechFramesCountRef.current;
                speechFramesCountRef.current = 0;

                // Send segment if it contained legitimate speech duration (> 3 frames ~= 350ms)
                if (segmentChunks.length > 0 && frameCount >= 3) {
                  const blob = new Blob(segmentChunks, { type: activeMimeTypeRef.current });
                  sendAudioToSTT(blob, ++segmentSeqRef.current);
                }
              }
              silenceTimerRef.current = null;
            }, 1300); // 1.3s natural pause window
          }
        }

        animFrameRef.current = requestAnimationFrame(vadLoop);
      };

      animFrameRef.current = requestAnimationFrame(vadLoop);
    } catch (err) {
      console.error("[STT] Failed to start microphone recording:", err);
      toast.error("Could not access microphone. Please check permissions.");
      stopVoiceRecording();
    }
  };

  // Toggle Speech Recording Callback
  const toggleVoiceRecording = useCallback(() => {
    if (disabled) return;
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  }, [disabled, isRecording, stopVoiceRecording]);

  // Clear Text Callback
  const handleClear = useCallback(() => {
    onChange?.("");
    toast("Answer cleared.", { duration: 1500 });
  }, [onChange]);

  // Imperative Ref Handle
  useImperativeHandle(
    ref,
    () => ({
      stopVoiceRecording,
      toggleVoiceRecording,
      isListening: isRecording,
    }),
    [stopVoiceRecording, toggleVoiceRecording, isRecording]
  );

  // Reset microphone when switching questions
  useEffect(() => {
    stopVoiceRecording();
  }, [questionId, stopVoiceRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceRecording();
    };
  }, [stopVoiceRecording]);

  const currentLength = (value || "").length;

  return (
    <div className={`space-y-2.5 flex flex-col ${className}`}>
      {/* Header bar: Helper text + Speak Answer button */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {showHelperText && (
          <p
            className="text-xs sm:text-sm font-medium leading-tight flex-1 min-w-[200px]"
            style={{ color: "var(--text-secondary, rgba(255, 255, 255, 0.7))" }}
          >
            {helperText}
          </p>
        )}

        {/* Voice Dictation (Speak Answer) Button */}
        <button
          type="button"
          onClick={toggleVoiceRecording}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border shadow-sm select-none shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isRecording
              ? "rgba(239, 68, 68, 0.15)"
              : "rgba(255, 107, 53, 0.12)",
            borderColor: isRecording
              ? "rgba(239, 68, 68, 0.50)"
              : "rgba(255, 107, 53, 0.35)",
            color: isRecording ? "#EF4444" : accentColor,
          }}
          title={isRecording ? "Click to stop recording" : "Click to speak your answer"}
        >
          {isRecording ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <MicOff className="w-3.5 h-3.5" />
              <span>Listening... (Stop)</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Speak Answer</span>
            </>
          )}
        </button>
      </div>

      {/* Real-time Voice & Audio Status Banner when Recording or Transcribing */}
      {(isRecording || isTranscribing) && (
        <div
          className="p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all duration-200 shadow-sm shrink-0"
          style={{
            background: "rgba(255, 107, 53, 0.06)",
            borderColor: "rgba(255, 107, 53, 0.35)",
          }}
        >
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: accentColor }}>
            {isTranscribing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accentColor }} />
                <span>Transcribing speech...</span>
              </>
            ) : speechStatus === "speaking" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <Volume2 className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span className="text-red-400">Capturing voice...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span>Microphone active (Listening for speech)</span>
              </>
            )}
          </div>

          {/* Real-time Audio Level Bar Indicator */}
          {isRecording && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-mono">Mic Level</span>
              <div className="w-16 sm:w-24 h-2 bg-white/10 rounded-full overflow-hidden p-0.5 flex items-center">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.max(4, Math.min(100, audioLevel))}%`,
                    background: audioLevel > 40 ? "#EF4444" : accentColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Textarea container */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <textarea
          value={value || ""}
          onChange={(e) => {
            const nextVal = e.target.value;
            valueRef.current = nextVal;
            onChange?.(nextVal);
          }}
          disabled={disabled}
          placeholder={
            placeholder ||
            (isRecording
              ? "Speak or type your answer here..."
              : "Write or speak your answer here...")
          }
          rows={rows}
          className={`w-full flex-1 p-3.5 border rounded-xl resize-y focus:outline-none focus:ring-2 font-normal leading-relaxed transition-colors text-xs sm:text-sm ${textareaClassName}`}
          style={{
            background: "var(--input-bg, var(--card-bg, rgba(15, 18, 28, 0.7)))",
            borderColor: isRecording ? accentColor : "var(--card-border, rgba(255, 255, 255, 0.1))",
            color: "var(--text-primary, #ffffff)",
            ...textareaStyle,
          }}
        />
      </div>

      {/* Footer bar: Character count, Clear button, and extra actions (like Save) */}
      <div
        className="flex items-center justify-between text-xs pt-1 shrink-0"
        style={{ color: "var(--text-muted, rgba(255, 255, 255, 0.4))" }}
      >
        <div className="flex items-center gap-3">
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
