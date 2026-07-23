import React, { useEffect, useRef } from "react";
import { CameraOff, RefreshCw } from "lucide-react";

/**
 * WebcamCard — Live webcam feed via getUserMedia.
 *
 * Props:
 *   isCameraOn     {boolean}        — show/hide camera
 *   stream         {MediaStream}    — live stream from parent
 *   userName       {string}         — user name for fallback avatar initials
 *   onRetryCamera  {function}       — callback to attempt re-acquiring camera
 */
function WebcamCard({ isCameraOn = true, stream = null, userName = "You", onRetryCamera }) {
  const videoRef = useRef(null);

  // Attach stream to video element whenever stream OR isCameraOn state changes
  useEffect(() => {
    if (videoRef.current && stream && isCameraOn) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => console.warn("Video play error:", err));
    }
  }, [stream, isCameraOn]);

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="relative w-full h-full rounded-2xl overflow-hidden"
      style={{ background: "#0a0c12" }}
    >
      {/* Live video */}
      {isCameraOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" /* mirror */ }}
        />
      ) : (
        /* Camera-off / error fallback */
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
          {isCameraOn && !stream ? (
            /* Loading / Permission pending or error */
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                <span className="text-base font-bold text-blue-400">{initials}</span>
              </div>
              <span className="text-[11px] text-white/50">Camera disconnected</span>
              {onRetryCamera && (
                <button
                  onClick={onRetryCamera}
                  className="mt-1 px-3 py-1 rounded-lg text-[10px] font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-3 h-3" /> Retry Camera
                </button>
              )}
            </div>
          ) : (
            /* Camera deliberately turned off */
            <div className="flex flex-col items-center gap-2 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: "radial-gradient(circle, rgba(37,99,235,0.15), rgba(37,99,235,0.05))",
                  border: "1px solid rgba(37,99,235,0.2)",
                }}
              >
                <span className="text-lg font-bold text-blue-300">{initials}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CameraOff className="w-3 h-3 text-white/30" />
                <span className="text-[11px] text-white/30 font-medium">Camera off</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Name badge overlay */}
      <div
        className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-lg flex items-center gap-1.5"
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isCameraOn && stream ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
        <span className="text-[10px] font-semibold text-white/80">
          {userName} (You)
        </span>
      </div>
    </div>
  );
}

export default WebcamCard;

