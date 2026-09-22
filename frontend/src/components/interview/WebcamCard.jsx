import React, { useEffect, useRef } from "react";
import { CameraOff, RefreshCw, Users, User, AlertTriangle } from "lucide-react";

/**
 * WebcamCard — Live webcam feed via getUserMedia with proctoring detection overlay.
 *
 * Props:
 *   isCameraOn     {boolean}        — show/hide camera
 *   stream         {MediaStream}    — live stream from parent
 *   userName       {string}         — user name for fallback avatar initials
 *   onRetryCamera  {function}       — callback to attempt re-acquiring camera
 *   personCount    {number}         — detected person count (0, 1, 2+)
 *   personStatus   {string}         — "ONE_PERSON" | "NO_PERSON" | "MULTIPLE_PEOPLE"
 *   onVideoElement {function}       — callback to pass video element reference for detection
 */
function WebcamCard({
  isCameraOn = true,
  stream = null,
  userName = "You",
  onRetryCamera,
  personCount = 1,
  personStatus = "ONE_PERSON",
  onVideoElement,
}) {
  const videoRef = useRef(null);

  // Attach stream to video element whenever stream OR isCameraOn state changes
  useEffect(() => {
    if (videoRef.current && stream && isCameraOn) {
      videoRef.current.srcObject = stream;
      videoRef.current
        .play()
        .then(() => {
          if (onVideoElement && videoRef.current) {
            onVideoElement(videoRef.current);
          }
        })
        .catch((err) => console.warn("Video play error:", err));
    } else if (onVideoElement) {
      onVideoElement(null);
    }
  }, [stream, isCameraOn, onVideoElement]);

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Render proctor state indicator
  const renderProctorBadge = () => {
    if (!isCameraOn || !stream) return null;

    if (personStatus === "MULTIPLE_PEOPLE" || personCount >= 2) {
      return (
        <div
          className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-lg animate-pulse"
          style={{
            background: "rgba(239, 68, 68, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <AlertTriangle className="w-3 h-3 text-white" />
          <span className="text-[9.5px] font-black uppercase text-white tracking-wide">
            Multiple People ({personCount})
          </span>
        </div>
      );
    }

    if (personStatus === "NO_PERSON" || personCount === 0) {
      return (
        <div
          className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-lg"
          style={{
            background: "rgba(245, 158, 11, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          <span className="text-[9.5px] font-black uppercase text-white tracking-wide">
            No Face Detected
          </span>
        </div>
      );
    }

    return (
      <div
        className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-md"
        style={{
          background: "rgba(16, 185, 129, 0.75)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        <span className="text-[9.5px] font-bold text-white tracking-wide">
          1 Person Verified
        </span>
      </div>
    );
  };

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
              <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <span className="text-lg font-bold text-amber-400">{initials}</span>
              </div>
              <span className="text-[11px] text-white/50">Camera disconnected</span>
              {onRetryCamera && (
                <button
                  onClick={onRetryCamera}
                  className="mt-1 px-3 py-1 rounded-lg text-[10px] font-bold bg-[#FF6B35]/15 hover:bg-[#FF6B35]/25 text-[#FF6B35] border border-[#FF6B35]/30 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-3 h-3" /> Retry Camera
                </button>
              )}
            </div>
          ) : (
            /* Camera deliberately turned off */
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-500/15 border border-amber-500/30">
                <span className="text-lg font-bold text-amber-400">{initials}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CameraOff className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[11px] text-white/40 font-medium">Camera off</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proctor status badge (Top-Right) */}
      {renderProctorBadge()}

      {/* Name badge overlay (Bottom-Left) */}
      <div
        className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
        style={{
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isCameraOn && stream ? "bg-emerald-400" : "bg-[#FF6B35]"
          }`}
        />
        <span className="text-[10px] font-bold text-white/90">
          {userName || "Tushar Nagare"} (You)
        </span>
      </div>
    </div>
  );
}

export default WebcamCard;
