import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";

/**
 * Robust HTML5 Fullscreen detection across all browser engines
 */
export function getIsFullscreen() {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

/**
 * Vendor-agnostic fullscreen request
 */
export async function requestFullscreenSafe(element = document.documentElement) {
  if (!element) return Promise.reject(new Error("No element"));
  const rfs =
    element.requestFullscreen ||
    element.webkitRequestFullscreen ||
    element.mozRequestFullScreen ||
    element.msRequestFullscreen;

  if (typeof rfs === "function") {
    return rfs.call(element);
  }
  return Promise.reject(new Error("Fullscreen API not supported in this browser"));
}

/**
 * Core Exam Lockdown Hook (HackerRank / Unstop Grade Security)
 * Manages Fullscreen, Focus/Visibility state machine, Opaque Focus-loss Shield,
 * Tab session locks, and Capture-phase Clipboard/Keyboard/Navigation barriers.
 */
export function useExamLockdown({
  attemptId,
  isCodingQuestion = false,
  submitted = false,
  reportViolation,
  recordIntegrity,
}) {
  // State machine: "ACTIVE" | "AWAY" | "RETURNING" | "SUBMITTED"
  const [examState, setExamState] = useState("ACTIVE");
  const [isFullscreen, setIsFullscreen] = useState(getIsFullscreen());
  const [isAway, setIsAway] = useState(false);
  const [isDuplicateSession, setIsDuplicateSession] = useState(false);

  // References
  const awayStartRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const lastCoalesceRef = useRef(0);
  const sessionIdRef = useRef(
    `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  // Safe wrapper for triggering strikes with client-side 2500ms coalescing
  const triggerCoalescedStrike = useCallback(
    (eventType) => {
      if (submitted) return;
      const now = Date.now();
      if (now - lastCoalesceRef.current < 2500) {
        return; // Deduplicate simultaneous compound events (e.g. blur + visibilitychange + fullscreen_exit)
      }
      lastCoalesceRef.current = now;
      if (typeof reportViolation === "function") {
        reportViolation(eventType);
      }
    },
    [submitted, reportViolation]
  );

  // Fullscreen Entry
  const enterFullscreen = useCallback(async () => {
    try {
      await requestFullscreenSafe(document.documentElement);
      setIsFullscreen(true);
    } catch (err) {
      console.warn("Fullscreen request error:", err);
      toast.error("Please allow fullscreen mode to continue your assessment.", {
        id: "fullscreen-denied",
      });
    }
  }, []);

  // Explicit Resume Assessment Handler
  const resumeAssessment = useCallback(async () => {
    try {
      if (!getIsFullscreen()) {
        await enterFullscreen();
      }
      window.focus();

      if (awayStartRef.current) {
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - awayStartRef.current) / 1000)
        );
        awayStartRef.current = null;
        if (typeof recordIntegrity === "function") {
          recordIntegrity("window_blur", durationSec, {
            awayDurationSeconds: durationSec,
            resumedAt: new Date().toISOString(),
          });
        }
      }

      setIsAway(false);
      setExamState("ACTIVE");
    } catch (err) {
      console.warn("Resume assessment error:", err);
    }
  }, [enterFullscreen, recordIntegrity]);

  // 1. FULLSCREEN EVENT LISTENERS
  useEffect(() => {
    if (submitted) return;

    const onFullscreenChange = () => {
      const inFull = getIsFullscreen();
      setIsFullscreen(inFull);
      if (!inFull && !submitted) {
        setIsAway(true);
        setExamState("AWAY");
        triggerCoalescedStrike("fullscreen_exit");
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("MSFullscreenChange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("mozfullscreenchange", onFullscreenChange);
      document.removeEventListener("MSFullscreenChange", onFullscreenChange);
    };
  }, [submitted, triggerCoalescedStrike]);

  // 2. WINDOW FOCUS & TAB VISIBILITY STATE MACHINE
  useEffect(() => {
    if (submitted) {
      setExamState("SUBMITTED");
      setIsAway(false);
      return;
    }

    const handleFocusLost = (eventType = "window_blur") => {
      if (submitted) return;
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);

      blurTimeoutRef.current = setTimeout(() => {
        if (!document.hasFocus() || document.hidden) {
          setIsAway(true);
          setExamState("AWAY");
          if (!awayStartRef.current) {
            awayStartRef.current = Date.now();
          }
          triggerCoalescedStrike(eventType);
        }
      }, 50);
    };

    const handleFocusGained = () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      if (submitted) return;

      // Only auto-dismiss if in full screen and focus is truly restored
      if (document.hasFocus() && getIsFullscreen()) {
        if (awayStartRef.current) {
          const durationSec = Math.max(
            1,
            Math.round((Date.now() - awayStartRef.current) / 1000)
          );
          awayStartRef.current = null;
          if (typeof recordIntegrity === "function") {
            recordIntegrity("window_blur", durationSec, {
              awayDurationSeconds: durationSec,
            });
          }
        }
        setIsAway(false);
        setExamState("ACTIVE");
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleFocusLost("tab_switch");
      } else {
        if (document.hasFocus() && getIsFullscreen()) {
          handleFocusGained();
        }
      }
    };

    const handlePageHide = () => {
      handleFocusLost("window_blur");
    };

    window.addEventListener("blur", () => handleFocusLost("window_blur"));
    window.addEventListener("focus", handleFocusGained);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("freeze", handlePageHide);

    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      window.removeEventListener("blur", () => handleFocusLost("window_blur"));
      window.removeEventListener("focus", handleFocusGained);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("freeze", handlePageHide);
    };
  }, [submitted, triggerCoalescedStrike, recordIntegrity]);

  // 3. MULTI-TAB / DUPLICATE SESSION LOCK VIA BROADCASTCHANNEL
  useEffect(() => {
    if (!attemptId || submitted || typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return;
    }

    const channelName = `exam_lock_attempt_${attemptId}`;
    const channel = new BroadcastChannel(channelName);

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data || data.sessionId === sessionIdRef.current) return;

      if (data.type === "CLAIM_SESSION") {
        setIsDuplicateSession(true);
        setIsAway(true);
        if (typeof recordIntegrity === "function") {
          recordIntegrity("duplicate_session", 0, {
            conflictingSession: data.sessionId,
            action: "duplicate_tab_detected",
          });
        }
      } else if (data.type === "PING_EXISTING") {
        channel.postMessage({
          type: "CLAIM_SESSION",
          sessionId: sessionIdRef.current,
        });
      }
    };

    channel.postMessage({
      type: "PING_EXISTING",
      sessionId: sessionIdRef.current,
    });

    return () => {
      channel.close();
    };
  }, [attemptId, submitted, recordIntegrity]);

  // 4. CONTEXT MENU & TEXT SELECTION GUARDS (CAPTURE PHASE)
  useEffect(() => {
    if (submitted) return;

    const handleContextMenu = (e) => {
      const target = e.target;
      // Allow context menu only if explicitly inside Monaco code editor
      if (target?.closest?.(".monaco-editor") || target?.closest?.(".monaco-aria-container")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      toast.error("Right click / Context menu is disabled during the assessment", {
        id: "ctx-menu-blocked",
      });
      if (typeof recordIntegrity === "function") {
        recordIntegrity("context_menu_attempt", 0, { target: target?.tagName });
      }
    };

    const handleSelectStart = (e) => {
      const target = e.target;
      if (!target) return;
      // Allow selecting ONLY inside Monaco editor, text inputs, textareas
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest?.(".monaco-editor") ||
        target.closest?.(".monaco-aria-container")
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("selectstart", handleSelectStart, true);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("selectstart", handleSelectStart, true);
    };
  }, [submitted, recordIntegrity]);

  // 5. MULTI-LAYER CLIPBOARD & DRAG/DROP PROTECTIONS (CAPTURE PHASE)
  useEffect(() => {
    if (submitted) return;

    const handleCopyCut = (e) => {
      const target = e.target;
      const isMonaco =
        target?.closest?.(".monaco-editor") ||
        target?.closest?.(".monaco-aria-container");

      if (!isCodingQuestion && !isMonaco) {
        e.preventDefault();
        e.stopPropagation();
        toast.error("Copying and cutting question content is strictly disabled", {
          id: "clipboard-lock",
        });
        if (typeof recordIntegrity === "function") {
          recordIntegrity(e.type === "copy" ? "copy_attempt" : "cut_attempt", 0, {
            action: e.type,
          });
        }
      }
    };

    const handlePaste = (e) => {
      const target = e.target;
      const isMonaco =
        target?.closest?.(".monaco-editor") ||
        target?.closest?.(".monaco-aria-container");

      if (!isCodingQuestion && !isMonaco) {
        e.preventDefault();
        e.stopPropagation();
        toast.error("Pasting is disabled for this question", {
          id: "clipboard-lock",
        });
        if (typeof recordIntegrity === "function") {
          recordIntegrity("paste_attempt", 0, {});
        }
      } else {
        const text = e.clipboardData?.getData("text") || "";
        if (text.length > 50 && typeof recordIntegrity === "function") {
          recordIntegrity("paste_burst", 0, {
            length: text.length,
            snippet: text.slice(0, 60),
          });
        }
      }
    };

    const handleDragStart = (e) => {
      const target = e.target;
      if (
        target?.closest?.(".monaco-editor") ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (typeof recordIntegrity === "function") {
        recordIntegrity("drag_drop_attempt", 0, { action: "dragstart" });
      }
    };

    const handleDragOver = (e) => {
      const target = e.target;
      if (
        target?.closest?.(".monaco-editor") ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e) => {
      const target = e.target;
      if (
        target?.closest?.(".monaco-editor") ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (typeof recordIntegrity === "function") {
        recordIntegrity("drag_drop_attempt", 0, { action: "drop" });
      }
    };

    window.addEventListener("copy", handleCopyCut, true);
    window.addEventListener("cut", handleCopyCut, true);
    window.addEventListener("paste", handlePaste, true);
    window.addEventListener("dragstart", handleDragStart, true);
    window.addEventListener("dragover", handleDragOver, true);
    window.addEventListener("drop", handleDrop, true);

    return () => {
      window.removeEventListener("copy", handleCopyCut, true);
      window.removeEventListener("cut", handleCopyCut, true);
      window.removeEventListener("paste", handlePaste, true);
      window.removeEventListener("dragstart", handleDragStart, true);
      window.removeEventListener("dragover", handleDragOver, true);
      window.removeEventListener("drop", handleDrop, true);
    };
  }, [submitted, isCodingQuestion, recordIntegrity]);

  // 6. ADVANCED KEYBOARD SHORTCUTS INTERCEPTION (CAPTURE PHASE)
  useEffect(() => {
    if (submitted) return;

    const handleKeyDown = (e) => {
      const key = (e.key || "").toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const altKey = e.altKey;

      // DevTools shortcuts: F12, Ctrl/Cmd+Shift+I, Ctrl/Cmd+Shift+J, Ctrl/Cmd+Shift+C
      if (
        key === "f12" ||
        (ctrlOrMeta && e.shiftKey && ["i", "j", "c"].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        toast.error("Developer inspection shortcuts are disabled", {
          id: "devtools-lock",
        });
        if (typeof recordIntegrity === "function") {
          recordIntegrity("devtools_attempt", 0, { key });
        }
        return;
      }

      // Page inspection / print / save: Ctrl/Cmd+U, Ctrl/Cmd+P, Ctrl/Cmd+S
      if (ctrlOrMeta && ["u", "p", "s"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof recordIntegrity === "function") {
          recordIntegrity("keyboard_security_attempt", 0, { shortcut: `ctrl+${key}` });
        }
        return;
      }

      // Page reload shortcuts: Ctrl/Cmd+R, Ctrl/Cmd+Shift+R, F5
      if ((ctrlOrMeta && key === "r") || key === "f5") {
        e.preventDefault();
        e.stopPropagation();
        toast("Please use in-test navigation instead of page refresh", { icon: "🔒", id: "reload-warn" });
        return;
      }

      // Address bar shortcut: Ctrl/Cmd+L
      if (ctrlOrMeta && key === "l") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Browser navigation shortcuts: Alt+Left, Alt+Right
      if (altKey && ["arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Tab switching shortcuts where interceptable: Ctrl+Tab, Ctrl+Shift+Tab
      if (ctrlOrMeta && key === "tab") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Clipboard / Select-all on non-coding questions: Ctrl/Cmd+C, Ctrl/Cmd+V, Ctrl/Cmd+X, Ctrl/Cmd+A
      if (ctrlOrMeta && ["c", "v", "x", "a"].includes(key)) {
        const target = e.target;
        const isEditor =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.closest?.(".monaco-editor") ||
          target?.closest?.(".monaco-aria-container");

        if (!isCodingQuestion && !isEditor) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [submitted, isCodingQuestion, recordIntegrity]);

  // 7. NAVIGATION & UNLOAD INTERCEPTION
  useEffect(() => {
    if (submitted) return;

    const handleBeforeUnload = (e) => {
      if (!submitted) {
        e.preventDefault();
        e.returnValue = "Assessment in progress. Leaving this page may auto-submit your test.";
        return e.returnValue;
      }
    };

    const handlePopState = (e) => {
      if (!submitted) {
        window.history.pushState(null, "", window.location.href);
        toast.error("Navigation is disabled during the assessment. Use the in-test controls.", {
          id: "nav-blocked",
        });
      }
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [submitted]);

  return {
    examState,
    isFullscreen,
    isAway,
    isDuplicateSession,
    enterFullscreen,
    resumeAssessment,
  };
}
