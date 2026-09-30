import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

/**
 * Authoritative Coding Timer Hook
 * Listens to backend-provided expiresAt.
 * Sends warnings at 10 minutes, 5 minutes, and 1 minute.
 * Triggers onTimeUp callback when remaining is 0.
 */
export function useCodingTimer({ expiresAt, onTimeUp, active = true }) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  const warned10Ref = useRef(false);
  const warned5Ref = useRef(false);
  const warned1Ref = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (!expiresAt || !active) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      // Warning at 10 minutes (600s)
      if (remaining <= 600 && remaining > 590 && !warned10Ref.current) {
        warned10Ref.current = true;
        toast("⚠️ 10 minutes remaining in assessment!", {
          id: "timer-warn-10",
          duration: 5000,
          style: { background: "#F59E0B", color: "#fff", fontWeight: "bold" },
        });
      }

      // Warning at 5 minutes (300s)
      if (remaining <= 300 && remaining > 290 && !warned5Ref.current) {
        warned5Ref.current = true;
        toast("⚠️ 5 minutes remaining! Review your code submissions.", {
          id: "timer-warn-5",
          duration: 5000,
          style: { background: "#EF4444", color: "#fff", fontWeight: "bold" },
        });
      }

      // Warning at 1 minute (60s)
      if (remaining <= 60 && remaining > 50 && !warned1Ref.current) {
        warned1Ref.current = true;
        toast("🚨 1 minute remaining! Final auto-submission imminent.", {
          id: "timer-warn-1",
          duration: 5000,
          style: { background: "#DC2626", color: "#fff", fontWeight: "bold" },
        });
      }

      // Time up
      if (remaining <= 0) {
        clearInterval(interval);
        if (onTimeUpRef.current) {
          onTimeUpRef.current();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, active]);

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const formattedTime = `${hours > 0 ? String(hours).padStart(2, "0") + ":" : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isLowTime = remainingSeconds <= 300; // Under 5 minutes
  const isCritical = remainingSeconds <= 60; // Under 1 minute

  return {
    remainingSeconds,
    formattedTime,
    isLowTime,
    isCritical,
  };
}
