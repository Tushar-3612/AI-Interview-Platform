import { useState, useEffect, useRef } from "react";
import { Camera, CameraOff, Maximize2, Minimize2, RefreshCw, Mic, MicOff } from "lucide-react";
import toast from "react-hot-toast";

/**
 * WebcamCard Component
 * Renders the candidate's real-time webcam feed with professional toggles.
 */
function WebcamCard({ isCameraOn = true, onToggleCamera, isMicOn = true, onToggleMic }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isMirror, setIsMirror] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize and dispose of webcam stream
  useEffect(() => {
    async function startCamera() {
      if (isCameraOn) {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
            audio: false, // Audio is managed separately
          });
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        } catch (error) {
          console.error("Error accessing webcam:", error);
          toast.error("Webcam access denied or unavailable. Showing placeholder.");
        }
      } else {
        stopCamera();
      }
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isCameraOn]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Keep state sync with escape button or exit full screen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`glass-card rounded-[16px] overflow-hidden relative group transition-all duration-300 w-full h-full ${
        isFullscreen ? "flex items-center justify-center bg-black" : ""
      }`}
    >
      {/* Video element */}
      {isCameraOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-transform duration-300 ${
            isMirror ? "scale-x-[-1]" : "scale-x-[1]"
          }`}
        />
      ) : (
        /* Placeholder styling */
        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
            <CameraOff className="w-8 h-8 text-slate-500" />
          </div>
          <span className="text-xs font-medium tracking-wide uppercase">
            Webcam Feed Disabled
          </span>
        </div>
      )}

      {/* Grid overlay for tech look */}
      {isCameraOn && stream && (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
      )}

      {/* Rec indicator */}
      {isCameraOn && stream && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2 border border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-[10px] font-bold text-white tracking-widest uppercase">
            LIVE FEED
          </span>
        </div>
      )}

      {/* Bottom overlay controls */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
        <span className="text-[11px] font-semibold text-white/90">
          Roshan Langhi (You)
        </span>

        <div className="flex items-center gap-2">
          {/* Mirror toggle */}
          <button
            type="button"
            onClick={() => {
              setIsMirror(!isMirror);
              toast.success(isMirror ? "Mirror Mode Off" : "Mirror Mode On");
            }}
            title="Mirror Mode"
            disabled={!isCameraOn}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Mic toggle */}
          <button
            type="button"
            onClick={onToggleMic}
            title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isMicOn 
                ? "bg-white/10 hover:bg-white/20 text-white" 
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
          >
            {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>

          {/* Camera toggle */}
          <button
            type="button"
            onClick={onToggleCamera}
            title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isCameraOn 
                ? "bg-white/10 hover:bg-white/20 text-white" 
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
          >
            {isCameraOn ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WebcamCard;
