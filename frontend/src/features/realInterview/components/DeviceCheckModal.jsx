import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Mic,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Video,
  Volume2,
  Lock,
} from "lucide-react";

/**
 * Pre-Interview Device Check Modal
 *
 * Mandatory gate verifying camera & microphone permissions and active hardware
 * streams before allowing the candidate into the Real AI Interview.
 */
function DeviceCheckModal({ isOpen = true, onProceed, candidateName = "Candidate" }) {
  const [cameraStatus, setCameraStatus] = useState("checking"); // 'checking' | 'granted' | 'denied' | 'error'
  const [micStatus, setMicStatus] = useState("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [micVolume, setMicVolume] = useState(0);

  const previewVideoRef = useRef(null);
  const activeStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  const cleanupAudioAnalyser = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
  };

  const cleanupStream = () => {
    cleanupAudioAnalyser();
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      activeStreamRef.current = null;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  };

  const runDeviceCheck = useCallback(async () => {
    cleanupStream();
    setCameraStatus("checking");
    setMicStatus("checking");
    setErrorMessage("");

    // Check secure context
    if (
      typeof window !== "undefined" &&
      window.isSecureContext === false &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setCameraStatus("error");
      setMicStatus("error");
      setErrorMessage("Camera & microphone require a secure connection (HTTPS) or localhost.");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus("error");
      setMicStatus("error");
      setErrorMessage("Your browser does not support webcam/audio capture APIs.");
      return;
    }

    try {
      // Request combined camera & audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      activeStreamRef.current = stream;

      // Validate Video Track
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0 && videoTracks[0].readyState === "live") {
        setCameraStatus("granted");
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          previewVideoRef.current.play().catch(() => {});
        }
      } else {
        setCameraStatus("error");
        setErrorMessage("No active video feed received from your webcam.");
      }

      // Validate Audio Track & attach volume meter
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0 && audioTracks[0].readyState === "live") {
        setMicStatus("granted");
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.5;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkVolume = () => {
              if (!activeStreamRef.current) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              setMicVolume(Math.min(100, Math.round((average / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            checkVolume();
          }
        } catch (audioErr) {
          console.warn("[DeviceCheck] AudioContext visualizer warning:", audioErr);
        }
      } else {
        setMicStatus("error");
        setErrorMessage("No active audio signal received from your microphone.");
      }
    } catch (err) {
      console.warn("[DeviceCheck] getUserMedia error:", err);
      const errName = err.name || "";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setCameraStatus("denied");
        setMicStatus("denied");
        setErrorMessage(
          "Permission denied. Please click the camera icon in your browser address bar, allow camera and microphone access, then click 'Retry'."
        );
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        setCameraStatus("error");
        setMicStatus("error");
        setErrorMessage("No camera or microphone found on this device. Please connect a device and retry.");
      } else if (errName === "NotReadableError" || errName === "TrackStartError") {
        setCameraStatus("error");
        setMicStatus("error");
        setErrorMessage(
          "Hardware is in use by another application (Zoom, Teams, Meet). Please close other video apps and retry."
        );
      } else {
        setCameraStatus("error");
        setMicStatus("error");
        setErrorMessage(err.message || "Failed to acquire camera and microphone permissions.");
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      runDeviceCheck();
    }
    return () => {
      cleanupStream();
    };
  }, [isOpen, runDeviceCheck]);

  if (!isOpen) return null;

  const isAllReady = cameraStatus === "granted" && micStatus === "granted";

  const handleContinue = () => {
    if (!isAllReady || !activeStreamRef.current) return;
    cleanupAudioAnalyser();
    const stream = activeStreamRef.current;
    // Release ownership to parent StartInterview
    activeStreamRef.current = null;
    onProceed?.(stream);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-xl rounded-3xl bg-[#0B0F19] border border-white/15 text-white shadow-2xl overflow-hidden flex flex-col"
          style={{
            boxShadow: "0 25px 70px rgba(0,0,0,0.85), 0 0 35px rgba(255,107,53,0.15)",
          }}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "radial-gradient(circle, rgba(255,107,53,0.3) 0%, rgba(255,107,53,0.08) 100%)",
                  border: "1px solid rgba(255,107,53,0.35)",
                }}
              >
                <ShieldCheck className="w-5 h-5 text-[#FF6B35]" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white leading-tight">
                  Pre-Interview Device Check
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  Mandatory hardware check for {candidateName}
                </p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-white/70 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-[#FF6B35]" /> Proctor Gate
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Live Camera Preview Card */}
            <div className="relative w-full h-52 sm:h-56 rounded-2xl bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center">
              {cameraStatus === "granted" ? (
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2.5 text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                    <Video className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-white/60 font-medium">
                    {cameraStatus === "checking"
                      ? "Requesting camera permissions..."
                      : "Webcam preview unavailable"}
                  </p>
                </div>
              )}

              {/* Status Badge in Preview */}
              <div className="absolute top-3 right-3">
                {cameraStatus === "granted" ? (
                  <span className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-emerald-500/80 backdrop-blur-md text-white border border-white/20 flex items-center gap-1.5 shadow-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Camera Ready
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-amber-500/80 backdrop-blur-md text-white border border-white/20 flex items-center gap-1.5 shadow-lg">
                    <AlertTriangle className="w-3.5 h-3.5" /> Camera Required
                  </span>
                )}
              </div>
            </div>

            {/* Device Verification Status List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Camera Verification Tile */}
              <div
                className={`p-3.5 rounded-2xl border transition-all ${
                  cameraStatus === "granted"
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                    : cameraStatus === "checking"
                    ? "bg-white/5 border-white/10 text-white/70"
                    : "bg-red-950/25 border-red-500/40 text-red-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Camera className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold text-white">Camera Access</span>
                  </div>
                  {cameraStatus === "granted" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : cameraStatus === "checking" ? (
                    <RefreshCw className="w-3.5 h-3.5 text-white/50 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <p className="text-[11px] mt-1.5 opacity-80 leading-snug">
                  {cameraStatus === "granted"
                    ? "HD Webcam active & verified"
                    : cameraStatus === "checking"
                    ? "Requesting permission..."
                    : "Camera permission required"}
                </p>
              </div>

              {/* Microphone Verification Tile */}
              <div
                className={`p-3.5 rounded-2xl border transition-all ${
                  micStatus === "granted"
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                    : micStatus === "checking"
                    ? "bg-white/5 border-white/10 text-white/70"
                    : "bg-red-950/25 border-red-500/40 text-red-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Mic className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold text-white">Microphone</span>
                  </div>
                  {micStatus === "granted" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : micStatus === "checking" ? (
                    <RefreshCw className="w-3.5 h-3.5 text-white/50 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                {micStatus === "granted" ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <div className="flex-1 h-1.5 bg-emerald-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-75"
                        style={{ width: `${Math.max(8, micVolume)}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-mono font-bold text-emerald-400">Live</span>
                  </div>
                ) : (
                  <p className="text-[11px] mt-1.5 opacity-80 leading-snug">
                    {micStatus === "checking" ? "Testing audio track..." : "Microphone permission required"}
                  </p>
                )}
              </div>
            </div>

            {/* Error Message Notice */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-white/10 bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={runDeviceCheck}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white/80 hover:text-white flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry / Check Again</span>
            </button>

            <button
              type="button"
              disabled={!isAllReady}
              onClick={handleContinue}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                isAllReady
                  ? "bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] text-white hover:brightness-110 cursor-pointer shadow-[#FF6B35]/30"
                  : "bg-white/10 text-white/30 border border-white/5 cursor-not-allowed shadow-none"
              }`}
            >
              <span>Continue to Interview</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default DeviceCheckModal;
