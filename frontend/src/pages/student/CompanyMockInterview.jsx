import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import CompanyMockCodingIDE from "../../components/coding/CompanyMockCodingIDE";
import {
  AlertTriangle,
  Maximize2,
  ShieldAlert,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Clock,
  Building2,
  CheckCircle2,
  Circle,
  Hourglass,
  Mic,
  MicOff,
} from "lucide-react";

const SECTION_ORDER = ["aptitude", "technical", "coding"];
const SECTION_META = {
  aptitude: { label: "Aptitude", color: "#38BDF8" },
  technical: { label: "Technical", color: "#A78BFA" },
  coding: { label: "Coding", color: "#34D399" },
};

function isFullscreenActive() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

function requestFullscreen() {
  const el = document.documentElement;
  const rfs =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;
  if (rfs) return rfs.call(el);
  return Promise.reject(new Error("Fullscreen API not supported"));
}

function exitFullscreenAPI() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
  return Promise.resolve();
}

function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function CompanyMockInterview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = getAuthToken();
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const urlCompanyId = searchParams.get("companyId");
  const resultParam = searchParams.get("result");
  const resumeParam = searchParams.get("resume");

  // ── Phase: booting | gate | assessment ──
  const [phase, setPhase] = useState("booting");
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(urlCompanyId || "");
  const [companyName, setCompanyName] = useState("");
  const [resumeData, setResumeData] = useState(null);
  // Resume-specific state so the attemptId + full question payload survive the
  // fullscreen permission transition without being lost or re-created.
  const [resumeAttemptId, setResumeAttemptId] = useState(null);
  const resumeAttemptRef = useRef(null);
  const resumeQuestionsRef = useRef(null);

  // ── Assessment state ──
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState({ aptitude: [], technical: [], coding: [] });
  const [currentSection, setCurrentSection] = useState("aptitude");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({ aptitude: {}, technical: {}, coding: {} });
  const [codingSubmissions, setCodingSubmissions] = useState([]);
  const [selectedCodingLanguage, setSelectedCodingLanguage] = useState("java");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);

  // ── Anti-cheat ──
  const securityEventsRef = useRef([]);
  const lastTabSwitchAtRef = useRef(0);
  const saveProgressRef = useRef(null);
  const submitFinalRef = useRef(null);

  // ── Save serialization: prevent overlapping autosaves ──
  const saveInProgressRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const saveDebounceTimerRef = useRef(null);

  // ── Duplicate-submission guard: only ONE final submission may execute ──
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Fullscreen ──
  const [fullscreenExited, setFullscreenExited] = useState(false);
  const everEnteredFs = useRef(false);

  // Live state refs for auto-save (avoids stale closures).
  const stateRef = useRef({ answers, currentSection, currentIndex, codingSubmissions, selectedCodingLanguage, attempt, remainingSeconds, questions });
  useEffect(() => {
    stateRef.current = {
      answers,
      currentSection,
      currentIndex,
      codingSubmissions,
      selectedCodingLanguage,
      attempt,
      remainingSeconds,
      questions,
    };
  }, [answers, currentSection, currentIndex, codingSubmissions, selectedCodingLanguage, attempt, remainingSeconds, questions]);

  // Redirect an incoming ?result=… link to the dedicated result page.
  useEffect(() => {
    if (resultParam) {
      setSearchParams({}, { replace: true });
      navigate(`/company-mock/result/${resultParam}`, { replace: true });
    }
  }, [resultParam, navigate, setSearchParams]);

  // Fullscreen tracking.
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = isFullscreenActive();
      if (isFS) {
        everEnteredFs.current = true;
        setFullscreenExited(false);
      } else if (everEnteredFs.current && phase === "assessment") {
        setFullscreenExited(true);
        saveProgress({ skipGuard: false });
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Queue an anti-cheat event to be persisted with the next save.
  const queueSecurityEvent = useCallback((type, metadata = {}) => {
    securityEventsRef.current.push({
      type,
      timestamp: new Date().toISOString(),
      section: stateRef.current.currentSection || null,
      questionId:
        stateRef.current.currentSection === "coding"
          ? String((stateRef.current.questions?.["coding"]?.[stateRef.current.currentIndex]?._id) || "")
          : String((stateRef.current.questions?.[stateRef.current.currentSection]?.[stateRef.current.currentIndex]?._id) || ""),
      metadata: {
        remainingSeconds: stateRef.current.remainingSeconds ?? 0,
        ...metadata,
      },
    });
  }, []);

  // ── TAB SWITCH DETECTION + COPY/CUT/CONTEXT PREVENTION ──
  useEffect(() => {
    if (phase !== "assessment") return;

    const isEditableTarget = (target) => {
      if (!target) return false;
      if (typeof target.closest !== "function") return false;
      return !!(
        target.closest(".monaco-editor") ||
        target.closest(".monaco-aria-container") ||
        (target.tagName === "TEXTAREA" && target.classList?.contains("inputarea")) ||
        target.isContentEditable
      );
    };

    // 3-strike violation handler (switches, minimizations, Alt+Tab)
    const reportViolation = (trigger = "window_blur") => {
      const now = Date.now();
      // Debounce rapid dual triggers (e.g. blur + visibilitychange firing simultaneously during Alt+Tab)
      if (now - lastTabSwitchAtRef.current < 1200) return;
      lastTabSwitchAtRef.current = now;

      setTabWarnings((prev) => {
        const next = prev + 1;
        queueSecurityEvent("TAB_SWITCH", { trigger, count: next });

        if (next >= 3) {
          toast.error("🚨 3 of 3: Mock interview auto-submitted", {
            id: "mock-violation-toast",
            duration: 5000,
          });
          submitFinalRef.current?.();
        } else if (next === 1) {
          toast.error("⚠️ Warning 1 of 3", {
            id: "mock-violation-toast",
            duration: 4000,
          });
          saveProgressRef.current?.({ skipGuard: true });
        } else if (next === 2) {
          toast.error("🚨 Warning 2 of 3 (Final Warning)", {
            id: "mock-violation-toast",
            duration: 5000,
          });
          saveProgressRef.current?.({ skipGuard: true });
        }
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation("tab_hidden");
      }
    };

    const handleWindowBlur = () => {
      reportViolation("window_blur");
    };

    const handleWindowFocus = () => {
      // Focus restored
    };

    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length >= 3) {
        reportViolation("three_finger_touch");
      }
    };

    const handleResize = () => {
      if (document.hidden || window.outerWidth === 0 || window.outerHeight === 0) {
        reportViolation("minimize");
      }
    };

    const preventCopy = (e) => {
      if (isEditableTarget(e.target)) return; // allow Monaco IDE copy
      e.preventDefault();
      queueSecurityEvent("COPY_ATTEMPT");
      toast.error("Copy action restricted for interview security.", { id: "copy-toast" });
      saveProgress({ skipGuard: true });
    };

    const preventCut = (e) => {
      if (isEditableTarget(e.target)) return; // allow Monaco IDE cut
      e.preventDefault();
      queueSecurityEvent("CUT_ATTEMPT");
      toast.error("Cut action restricted for interview security.", { id: "cut-toast" });
      saveProgress({ skipGuard: true });
    };

    const preventContextMenu = (e) => {
      if (isEditableTarget(e.target)) return; // allow Monaco IDE context menu
      e.preventDefault();
      queueSecurityEvent("CONTEXT_MENU");
      toast.error("Right-click context menu restricted.", { id: "contextmenu-toast" });
      saveProgress({ skipGuard: true });
    };

    const preventShortcutCopy = (e) => {
      if (isEditableTarget(e.target)) return; // allow IDE shortcuts
      const k = e.key?.toLowerCase?.();
      const isCopyCut = (e.ctrlKey || e.metaKey) && (k === "c" || k === "x");
      if (isCopyCut) {
        e.preventDefault();
        queueSecurityEvent(k === "c" ? "COPY_ATTEMPT" : "CUT_ATTEMPT");
        toast.error(k === "c" ? "Copy action restricted for interview security." : "Cut action restricted for interview security.", {
          id: k === "c" ? "copy-toast" : "cut-toast",
        });
        saveProgress({ skipGuard: true });
      }
    };

    const preventSelectStart = (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("resize", handleResize);
    window.addEventListener("copy", preventCopy);
    window.addEventListener("cut", preventCut);
    window.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("keydown", preventShortcutCopy);
    document.addEventListener("selectstart", preventSelectStart);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("copy", preventCopy);
      window.removeEventListener("cut", preventCut);
      window.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("keydown", preventShortcutCopy);
      document.removeEventListener("selectstart", preventSelectStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  useEffect(() => {
    document.body.classList.add("interview-active");
    window.scrollTo(0, 0);
    return () => document.body.classList.remove("interview-active");
  }, []);

  // Leave fullscreen cleanly on unmount.
  useEffect(() => {
    return () => {
      if (isFullscreenActive()) exitFullscreenAPI().catch(() => {});
    };
  }, []);

  // Auto-save on a debounce while assessment is active.
  useEffect(() => {
    if (phase !== "assessment") return;
    const t = setInterval(() => {
      saveProgress({ skipGuard: true });
    }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Warn + persist on close / navigate away.
  useEffect(() => {
    if (phase !== "assessment") return;
    const handleBeforeUnload = (e) => {
      fireAndForgetSave();
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Cleanup debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current);
    };
  }, []);

  // Timer countdown. Decrements the remaining active time every second from the
  // current saved value, stopping at 00:00 (auto-finalization is triggered below).
  useEffect(() => {
    if (phase !== "assessment") return;
    const t = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Auto-finalize the mock the moment the timer reaches 00:00. It submits
  // through the exact same final-scoring path ("End Mock Interview") so a
  // timed-out result is computed by the one authoritative backend function.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (phase !== "assessment" || remainingSeconds > 0 || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    toast("Time is up! Submitting your mock interview...");
    const t = setTimeout(() => submitFinalRef.current?.(), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingSeconds]);

  // Fetch companies (fallback when no company preselected).
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/api/companies", { headers: authHeaders });
        setCompanies(data || []);
      } catch {
        setCompanies([]);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boot: if a specific resume was requested via ?resume=attemptId, restore that
  // exact attempt immediately. Otherwise show the gate and surface unfinished mocks.
  useEffect(() => {
    const boot = async () => {
      if (resumeParam) {
        // Resume: load the exact saved attempt up-front (for display), keep the
        // attemptId + full payload in refs, and show the fullscreen permission
        // screen FIRST. On "Enter Fullscreen & Start" we open the SAME attempt.
        setLoading(true);
        try {
          const { data } = await api.get(
            `/api/mock-interview/resume?attemptId=${encodeURIComponent(resumeParam)}`,
            { headers: authHeaders }
          );
          if (data && data.completed && data.result) {
            // The attempt's active time already elapsed and was auto-finalized.
            setLoading(false);
            navigate(`/company-mock/result/${data.result.attemptId}`, { replace: true });
            return;
          }
          if (data && data.hasAttempt) {
            setResumeAttemptId(resumeParam);
            resumeAttemptRef.current = data.resume;
            resumeQuestionsRef.current = {
              aptitude: data.aptitude || [],
              technical: data.technical || [],
              coding: data.coding || [],
            };
            setResumeData(data.resume);
            setCompanyName(data.resume.companyName);
            setPhase("gate");
            setLoading(false);
            return;
          }
        } catch {
          // fall through to gate with empty state
        }
        setLoading(false);
        setPhase("gate");
        return;
      }

      // Normal flow: check for an unfinished attempt to show resume options.
      try {
        const { data } = await api.get("/api/mock-interview/resume", { headers: authHeaders });
        if (data && data.completed && data.result) {
          setPhase("gate");
          await new Promise((r) => setTimeout(r, 0));
          navigate(`/company-mock/result/${data.result.attemptId}`, { replace: true });
          return;
        }
        if (data && data.hasAttempt) {
          setResumeData(data.resume);
          setCompanyName(data.resume.companyName);
        }
      } catch {
        // fall through to gate
      } finally {
        setPhase("gate");
      }
    };
    if (!resultParam) boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (isFullscreenActive()) {
      everEnteredFs.current = true;
      return true;
    }
    try {
      await requestFullscreen();
      everEnteredFs.current = true;
      setFullscreenExited(false);
      return true;
    } catch (err) {
      console.warn("Fullscreen request error:", err);
      toast.error("Fullscreen is required to continue.");
      return false;
    }
  }, []);

  const handleReenterFullscreen = () => {
    enterFullscreen().then((ok) => {
      if (ok) setFullscreenExited(false);
    });
  };

  // Build + send the save payload from live state.
  const buildSavePayload = () => {
    const st = stateRef.current;
    const codingPayload = {};
    const codingSubArr = st.codingSubmissions || [];
    Object.entries(st.answers.coding || {}).forEach(([qid, code]) => {
      const sub = codingSubArr.find((c) => String(c.questionId) === String(qid));
      codingPayload[qid] = {
        code,
        language: st.selectedCodingLanguage,
        ...(sub ? { status: sub.status, passedCount: sub.passedCount, totalCount: sub.totalCount, score: sub.score } : {}),
      };
    });
    // Drain any pending anti-cheat events so they persist with this save.
    const pendingEvents = securityEventsRef.current;
    securityEventsRef.current = [];
    return {
      attemptId: st.attempt?.attemptId,
      currentSection: st.currentSection,
      currentQuestionIndex: st.currentIndex,
      aptitudeAnswers: st.answers.aptitude || {},
      technicalAnswers: st.answers.technical || {},
      codingAnswers: codingPayload,
      codingSubmissions: st.codingSubmissions,
      selectedCodingLanguage: st.selectedCodingLanguage,
      securityEvents: pendingEvents,
    };
  };

  // Debounced, serialized progress save — prevents overlapping requests.
  // If a save is in-flight when another is triggered, the latest state is
  // saved automatically once the in-flight request completes.
  const executeSave = useCallback(() => {
    const st = stateRef.current;
    if (!st.attempt || !st.attempt.attemptId) return;
    if (saveInProgressRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    saveInProgressRef.current = true;
    pendingSaveRef.current = false;
    const payload = buildSavePayload();
    api
      .post("/api/mock-interview/save", payload, { headers: authHeaders })
      .catch(() => {})
      .finally(() => {
        saveInProgressRef.current = false;
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          executeSave();
        }
      });
  }, [authHeaders]);

  const saveProgress = useCallback(({ skipGuard = false } = {}) => {
    saveProgressRef.current = saveProgress;
    // Debounce: coalesce rapid-fire saves into a single request
    if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current);
    saveDebounceTimerRef.current = setTimeout(executeSave, 300);
  }, [executeSave]);

  const fireAndForgetSave = useCallback(() => {
    const st = stateRef.current;
    if (!st.attempt || !st.attempt.attemptId) return;
    const payload = buildSavePayload();
    try {
      navigator.sendBeacon?.("/api/mock-interview/save", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    } catch {
      api.post("/api/mock-interview/save", payload, { headers: authHeaders }).catch(() => {});
    }
  }, [authHeaders]);

  useEffect(() => {
    saveProgressRef.current = saveProgress;
  }, [saveProgress]);

  const startNewMock = async (withCompanyId) => {
    const cid = withCompanyId || companyId;
    if (!cid) {
      toast.error("Please select a company first.");
      return;
    }
    const ok = await enterFullscreen();
    if (!ok) return;
    setLoading(true);
    try {
      const { data } = await api.post(
        "/api/mock-interview/start",
        { companyId: cid },
        { headers: authHeaders }
      );
      setupAssessment(data, null, data.expiresAt);
      setResumeData(null);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to start mock interview");
    } finally {
      setLoading(false);
    }
  };

  const resumeMock = async () => {
    // Prefer the attemptId + full payload captured at boot (from ?resume=…),
    // so the SAME attempt opens after the fullscreen transition — never lost,
    // never re-created, no re-selection of questions.
    const attemptId = resumeAttemptId || resumeData?.attemptId;
    if (!attemptId) return;

    const ok = await enterFullscreen();
    if (!ok) return;

    setLoading(true);
    try {
      if (resumeAttemptRef.current && String(resumeAttemptRef.current.attemptId) === String(attemptId)) {
        setupAssessment(resumeAttemptRef.current, resumeQuestionsRef.current, null);
        setCompanyName(resumeAttemptRef.current.companyName);
        resumeAttemptRef.current = null;
        resumeQuestionsRef.current = null;
        setResumeData(null);
        setLoading(false);
        return;
      }

      // Fallback (resume selected from the gate's unfinished list): fetch the
      // EXACT saved attempt by its stored ID — restores identical questions,
      // never regenerates or shuffles.
      const { data } = await api.get(
        `/api/mock-interview/resume?attemptId=${encodeURIComponent(attemptId)}`,
        { headers: authHeaders }
      );
      if (!data || !data.hasAttempt) {
        toast.error("No saved attempt to resume.");
        setLoading(false);
        return;
      }
      setupAssessment(data.resume, data, null);
      setCompanyName(data.resume.companyName);
      setResumeData(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to resume mock interview");
    } finally {
      setLoading(false);
    }
  };

  // Populate the assessment from either a fresh start or a resume.
  const setupAssessment = (attemptObj, questionData, expiresAt) => {
    setAttempt(attemptObj);
    if (questionData) {
      setQuestions({
        aptitude: questionData.aptitude || [],
        technical: questionData.technical || [],
        coding: questionData.coding || [],
      });
      setCurrentSection(attemptObj.currentSection || "aptitude");
      setCurrentIndex(attemptObj.currentQuestionIndex || 0);
      setAnswers({
        aptitude: attemptObj.answers?.aptitude || {},
        technical: attemptObj.answers?.technical || {},
        coding: attemptObj.answers?.coding || {},
      });
      setCodingSubmissions(attemptObj.codingSubmissions || []);
      setSelectedCodingLanguage(attemptObj.selectedCodingLanguage || "java");
      setRemainingSeconds(attemptObj.remainingSeconds || 0);
      setCompanyName(attemptObj.companyName || "");
    } else {
      setQuestions({
        aptitude: attemptObj.aptitude || [],
        technical: attemptObj.technical || [],
        coding: attemptObj.coding || [],
      });
      setCurrentSection("aptitude");
      setCurrentIndex(0);
      setAnswers({ aptitude: {}, technical: {}, coding: {} });
      setCodingSubmissions([]);
      setSelectedCodingLanguage("java");
      setCompanyName(attemptObj.companyName || "");
      const ms = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
      setRemainingSeconds(Math.max(0, Math.floor(ms / 1000)));
    }
    setPhase("assessment");
  };

  const sectionQuestions = questions[currentSection] || [];
  const question = sectionQuestions[currentIndex];
  const sectionCounts = {
    aptitude: { answered: Object.keys(answers.aptitude).filter((k) => (answers.aptitude[k] || "").toString().trim() !== "").length, total: (questions.aptitude || []).length },
    technical: { answered: Object.keys(answers.technical).filter((k) => (answers.technical[k] || "").toString().trim() !== "").length, total: (questions.technical || []).length },
    coding: { answered: Object.keys(answers.coding).filter((k) => (answers.coding[k] || "").toString().trim() !== "").length, total: (questions.coding || []).length },
  };
  const meta = SECTION_META[currentSection];

  // ── Answer handlers ──
  const selectOption = (qid, opt) => {
    setAnswers((prev) => {
      const next = {
        ...prev,
        [currentSection]: { ...prev[currentSection], [qid]: opt },
      };
      return next;
    });
    // immediate-ish save (debounced by interval + explicit)
    setTimeout(() => saveProgress({ skipGuard: true }), 250);
  };

  const updateCoding = (qid, code) => {
    setAnswers((prev) => ({
      ...prev,
      coding: { ...prev.coding, [qid]: code },
    }));
  };

  const updateTechnicalText = (qid, text) => {
    setAnswers((prev) => ({
      ...prev,
      technical: { ...prev.technical, [qid]: text },
    }));
    setTimeout(() => saveProgress({ skipGuard: true }), 250);
  };

  // ── Voice Dictation (Speech to Text) with Real-Time Streaming ──
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [liveInterimSpeech, setLiveInterimSpeech] = useState("");
  const recognitionRef = useRef(null);

  const stopVoiceRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListeningVoice(false);
    setLiveInterimSpeech("");
  }, []);

  useEffect(() => {
    stopVoiceRecording();
  }, [currentIndex, currentSection, stopVoiceRecording]);

  useEffect(() => {
    return () => {
      stopVoiceRecording();
    };
  }, [stopVoiceRecording]);

  const toggleVoiceRecording = (qid) => {
    if (isListeningVoice) {
      stopVoiceRecording();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(
        "Speech recognition is not supported in this browser. Please use Google Chrome or Edge to speak your answer."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListeningVoice(true);
        setLiveInterimSpeech("");
        toast.success("Microphone active. Speak your answer...", { icon: "🎙️" });
      };

      recognition.onresult = (event) => {
        let interimText = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalChunk += item[0].transcript + " ";
          } else {
            interimText += item[0].transcript;
          }
        }

        setLiveInterimSpeech(interimText);

        if (finalChunk.trim()) {
          setAnswers((prev) => {
            const current = (prev.technical && prev.technical[qid]) || "";
            const updated = current
              ? `${current.trim()} ${finalChunk.trim()}`
              : finalChunk.trim();
            return {
              ...prev,
              technical: { ...prev.technical, [qid]: updated },
            };
          });
          setTimeout(() => saveProgress({ skipGuard: true }), 250);
        }
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e.error);
        if (e.error !== "no-speech") {
          toast.error(`Microphone error: ${e.error}`);
        }
        stopVoiceRecording();
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
        setLiveInterimSpeech("");
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      toast.error("Could not access microphone.");
      setIsListeningVoice(false);
      setLiveInterimSpeech("");
    }
  };

  // ── Navigation ──
  const goNext = () => {
    saveProgress({ skipGuard: true });
    if (currentIndex < sectionQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (currentSection === "aptitude") {
      setCurrentSection("technical");
      setCurrentIndex(0);
    } else if (currentSection === "technical") {
      setCurrentSection("coding");
      setCurrentIndex(0);
    }
  };

  const goPrev = () => {
    saveProgress({ skipGuard: true });
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else if (currentSection === "coding") {
      setCurrentSection("technical");
      setCurrentIndex((questions.technical || []).length - 1);
    } else if (currentSection === "technical") {
      setCurrentSection("aptitude");
      setCurrentIndex((questions.aptitude || []).length - 1);
    }
  };

  const switchSection = (sec) => {
    if (sec === currentSection) return;
    saveProgress({ skipGuard: true });
    setCurrentSection(sec);
    setCurrentIndex(0);
  };

  // ── Coding submission capture ──
  const handleCodingSubmission = (qid, result) => {
    if (!qid || !result) return;
    setCodingSubmissions((prev) => {
      const idx = prev.findIndex((c) => String(c.questionId) === String(qid));
      const entry = {
        questionId: qid,
        status: result.status || "failed",
        passedCount: result.passedCount ?? result.passed ?? 0,
        totalCount: result.totalCount ?? result.total ?? 0,
        score: result.score ?? 0,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry];
    });
    setTimeout(() => saveProgress({ skipGuard: true }), 250);
  };

  // Coding question-id set that have a recorded submission (for the tab done-state).
  const codingSolvedSet = useMemo(() => {
    const s = new Set();
    (codingSubmissions || []).forEach((c) => {
      if (c && c.questionId) s.add(String(c.questionId));
    });
    return s;
  }, [codingSubmissions]);

  // Jump to a specific coding question (used by the coding IDE question tabs).
  const navigateCoding = (index) => {
    if (currentSection !== "coding") return;
    saveProgress({ skipGuard: true });
    if (index >= 0 && index < sectionQuestions.length) {
      setCurrentIndex(index);
    }
  };

  // ── End Mock Interview ──
  const submitFinal = async () => {
    submitFinalRef.current = submitFinal;
    if (submittingRef.current) {
      console.warn("[COMPANY MOCK] Blocked duplicate final submission.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setLoading(true);
    console.log("[COMPANY MOCK] FINAL SUBMIT CLICKED");
    console.log("[COMPANY MOCK] ATTEMPT ID:", attempt?.attemptId);
    console.log("[COMPANY MOCK] CALLING /api/mock-interview/submit");
    try {
      setConfirmEnd(false);
      const aptitudeAnswers = Object.entries(answers.aptitude)
        .map(([qid, v]) => ({ questionId: qid, selectedOption: v }))
        .filter((a) => (a.selectedOption || "").toString().trim() !== "");
      const technicalAnswers = Object.entries(answers.technical)
        .map(([qid, v]) => {
          const q = (questions.technical || []).find((tq) => tq._id === qid || tq.questionId === qid);
          const isFreeText = q && (!q.options || q.options.length === 0);
          return {
            questionId: qid,
            selectedOption: isFreeText ? null : v,
            answer: isFreeText ? v : v,
          };
        })
        .filter((a) => {
          const val = a.answer || a.selectedOption || "";
          return val.toString().trim() !== "";
        });
      const codingAnswers = Object.entries(answers.coding)
        .map(([qid, code]) => {
          const sub = codingSubmissions.find((c) => String(c.questionId) === String(qid));
          return {
            questionId: qid,
            code,
            language: sub?.language || selectedCodingLanguage,
            ...(sub
              ? { status: sub.status, passedCount: sub.passedCount, totalCount: sub.totalCount, score: sub.score }
              : {}),
          };
        })
        .filter((c) => (c.code || "").toString().trim() !== "");

      const { data } = await api.post(
        "/api/mock-interview/submit",
        { attemptId: attempt.attemptId, aptitudeAnswers, technicalAnswers, codingAnswers },
        { headers: authHeaders }
      );
      console.log("[COMPANY MOCK] RESPONSE:", data?.result?.status || data?.message);
      if (isFullscreenActive()) exitFullscreenAPI().catch(() => {});
      navigate(`/company-mock/result/${data.result?.attemptId || attempt.attemptId}`, { replace: true });
    } catch (error) {
      console.error("[COMPANY MOCK] SUBMIT ERROR:", error?.response?.data || error.message);
      const msg = error?.response?.status === 400
        ? (error.response.data?.message || "Bad request")
        : error?.response?.status === 401
          ? "Authentication error — please sign in again."
          : error?.response?.status === 404
            ? "Attempt not found."
            : error?.response?.status >= 500
              ? "Server error — please try again."
              : !error?.response
                ? "Network error — check your connection and retry."
                : "Failed to submit mock interview";
      toast.error(msg);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    submitFinalRef.current = submitFinal;
  });

  // ════════════════════════════════════════════════════════
  //  BOOTING
  // ════════════════════════════════════════════════════════
  if (phase === "booting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--primary)" }} />
        <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>Loading Mock Interview…</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  //  FULLSCREEN GATE / RESUME
  // ════════════════════════════════════════════════════════
  if (phase === "gate") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="w-full max-w-md space-y-4">
          {/* Fullscreen requirement */}
          <div className="rounded-3xl p-8 text-center flex flex-col items-center gap-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--admin-accent-bg)", color: "var(--primary)" }}>
              <Maximize2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Fullscreen Required</h2>
              <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                Please allow fullscreen to start your mock interview.
              </p>
            </div>

            {!resumeData && (
              <div className="w-full">
                {!companyId && (
                  <select
                    className="w-full p-2.5 border rounded-lg mb-4"
                    style={{ background: "var(--input-bg)", color: "var(--text-primary)", borderColor: "var(--border)" }}
                    value={companyId || ""}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    <option value="" disabled>-- Select Company --</option>
                    {companies.map((c) => (
                      <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => startNewMock()}
                  disabled={loading || !companyId}
                  className="w-full py-3.5 px-6 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)", boxShadow: "0 4px 20px rgba(255,107,53,0.35)" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Maximize2 className="w-4 h-4" />}
                  Enter Fullscreen &amp; Start
                </button>
              </div>
            )}
          </div>

          {/* Resume card if an unfinished attempt exists */}
          {resumeData && (
            <div className="rounded-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2">
                <Hourglass className="w-5 h-5" style={{ color: "var(--primary)" }} />
                <h3 className="text-lg font-bold">Resume Mock Interview</h3>
              </div>
              <p className="text-sm font-bold flex items-center gap-1.5">
                <Building2 className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Company: {resumeData.companyName || "—"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                saved progress detected
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <ResumeRow label="Aptitude" value={`${resumeData.progress.aptitude.answered}/${resumeData.progress.aptitude.total}`} />
                <ResumeRow label="Technical" value={`${resumeData.progress.technical.answered}/${resumeData.progress.technical.total}`} />
                <ResumeRow label="Coding" value={`${resumeData.progress.coding.answered}/${resumeData.progress.coding.total}`} />
                <ResumeRow label="Remaining Time" value={fmtTime(resumeData.remainingSeconds || 0)} />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={resumeMock}
                  disabled={loading}
                  className="w-full py-3 px-6 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)", boxShadow: "0 4px 20px rgba(255,107,53,0.35)" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Maximize2 className="w-4 h-4" />}
                  {resumeAttemptId ? "Enter Fullscreen & Start" : "Resume Interview"}
                </button>
                {!resumeAttemptId && (
                  <button
                    onClick={() => startNewMock()}
                    disabled={loading || !companyId}
                    className="w-full py-3 px-6 rounded-xl text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                    style={{ border: "1px solid var(--border)", color: "var(--text-primary)", background: "transparent" }}
                  >
                    Start New Mock
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  //  ASSESSMENT
  // ════════════════════════════════════════════════════════
  const isLastQuestion = currentSection === "coding" && currentIndex === sectionQuestions.length - 1;

  return (
    <div
      className={currentSection === "coding"
        ? "h-screen overflow-hidden flex flex-col select-none"
        : "min-h-screen flex flex-col select-none"}
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
      }}
    >
      {/* Header bar */}
      <header className="sticky top-0 z-40 px-4 md:px-6 py-3 border-b" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-5 h-5 shrink-0" style={{ color: "var(--primary)" }} />
            <span className="font-bold truncate">{companyName || "Company"} Mock Interview</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-semibold" style={{ background: "color-mix(in srgb, var(--error) 12%, transparent)", color: remainingSeconds <= 300 ? "var(--error)" : "var(--text-primary)" }}>
              <Clock className="w-4 h-4" />
              {fmtTime(remainingSeconds)}
            </div>
            <button
              onClick={() => setConfirmEnd(true)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)" }}
            >
              End Mock Interview
            </button>          </div>
        </div>

        {/* Section tabs */}
        <div className="flex flex-wrap gap-2 mt-3">
          {SECTION_ORDER.map((sec) => {
            const m = SECTION_META[sec];
            const isActive = sec === currentSection;
            const { answered, total } = sectionCounts[sec];
            return (
              <button
                key={sec}
                onClick={() => switchSection(sec)}
                className="px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold border transition-all"
                style={{
                  color: isActive ? "#fff" : "var(--text-secondary)",
                  background: isActive ? `linear-gradient(135deg, ${m.color} 0%, ${m.color}dd 100%)` : "var(--card-bg)",
                  borderColor: isActive ? m.color : "var(--border)",
                  boxShadow: isActive ? `0 0 14px ${m.color}55` : "none",
                }}
              >
                {m.label} <span className="opacity-90">({answered}/{total})</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Body */}
      <div className={currentSection === "coding" ? "flex-1 w-full flex flex-col min-h-0" : "flex-1 w-full max-w-4xl mx-auto p-4 md:p-6"}>
        {/* Progress line */}
        <div className={["flex items-center justify-between mb-4", currentSection === "coding" ? "px-4 md:px-6 pt-4" : ""].join(" ")}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
            <span className="capitalize">{meta.label}</span>
          </div>
          <div className="text-sm font-medium px-3 py-1 rounded-full" style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}>
            Question {currentIndex + 1} of {sectionQuestions.length}
          </div>
        </div>
        <div className={["h-1.5 w-full rounded-full overflow-hidden", currentSection === "coding" ? "px-4 md:px-6 mb-2" : "mb-6"].join(" ")}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${sectionQuestions.length ? ((currentIndex + 1) / sectionQuestions.length) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${meta.color}, ${meta.color}aa)`,
            }}
          />
        </div>

        {!question ? (
          <div className="text-center py-16">
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>No questions available in this section.</p>
          </div>
        ) : currentSection === "coding" ? (
          <div className="flex-1 min-h-0">
            <CompanyMockCodingIDE
              key={question._id}
              question={question}
              questions={questions.coding || []}
              activeIndex={currentIndex}
              solvedSet={codingSolvedSet}
              onNavigate={navigateCoding}
              initialCode={answers.coding[question._id] || question.starterCode || ""}
              initialLanguage={selectedCodingLanguage}
              onCodeChange={(code) => updateCoding(question._id, code)}
              onLanguageChange={(lang) => {
                setSelectedCodingLanguage(lang);
                const sub = codingSubmissions.find((c) => String(c.questionId) === String(question._id));
                setCodingSubmissions((prev) => {
                  if (!sub) return prev;
                  return prev.map((c) => (String(c.questionId) === String(question._id) ? { ...c, language: lang } : c));
                });
              }}
              onSubmissionResult={(result) => handleCodingSubmission(question._id, result)}
            />
          </div>
        ) : (
          <div className="rounded-xl border p-6 md:p-8 mb-6" style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            {/* Question Details Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                {question.questionType === "MCQ" ? "MCQ" : "Technical"}
              </span>
              {question.difficulty && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{
                  background: question.difficulty === "Hard" ? "rgba(239,68,68,0.12)" : question.difficulty === "Easy" ? "rgba(16,185,129,0.12)" : "rgba(234,179,8,0.12)",
                  color: question.difficulty === "Hard" ? "var(--error)" : question.difficulty === "Easy" ? "var(--success)" : "var(--warning)",
                }}>
                  {question.difficulty}
                </span>
              )}
              {question.marks != null && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>
                  {question.marks} Marks
                </span>
              )}
              {question.questionStatus && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{
                  background: question.questionStatus === "interview_reported" ? "rgba(245,158,11,0.12)" : "rgba(107,114,128,0.12)",
                  color: question.questionStatus === "interview_reported" ? "#F59E0B" : "#6B7280",
                }}>
                  {question.questionStatus === "interview_reported" ? "Interview Reported" : "Practice"}
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold mb-6">{question.text || question.question || question.title}</h2>
            {question.options && question.options.length > 0 ? (
              <div className="space-y-3">
                {question.options.map((opt, i) => {
                  const isSelected = answers[currentSection][question._id] === opt;
                  return (
                    <label
                      key={i}
                      className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors"
                      style={{
                        background: isSelected ? `color-mix(in srgb, ${meta.color} 14%, transparent)` : "transparent",
                        borderColor: isSelected ? meta.color : "var(--card-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <input type="radio" name={`q-${question._id}`} value={opt} checked={isSelected} onChange={() => selectOption(question._id, opt)} className="hidden" />
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: meta.color }} />
                      ) : (
                        <Circle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                      )}
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Type or speak your answer below. It will be evaluated by AI for correctness and completeness.
                  </p>

                  {/* Voice Dictation (Speak Answer) Button */}
                  <button
                    type="button"
                    onClick={() => toggleVoiceRecording(question._id)}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border shadow-sm select-none"
                    style={{
                      background: isListeningVoice
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(255, 107, 53, 0.12)",
                      borderColor: isListeningVoice
                        ? "rgba(239, 68, 68, 0.50)"
                        : "rgba(255, 107, 53, 0.35)",
                      color: isListeningVoice ? "#EF4444" : "#FF6B35",
                    }}
                    title={
                      isListeningVoice
                        ? "Click to stop recording"
                        : "Click to speak your answer"
                    }
                  >
                    {isListeningVoice ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <MicOff className="w-4 h-4" />
                        <span>Listening... (Stop)</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>Speak Answer</span>
                      </>
                    )}
                  </button>
                </div>

                {isListeningVoice && (
                  <div
                    className="p-3.5 rounded-xl border flex flex-col gap-2 transition-all duration-200 shadow-sm"
                    style={{
                      background: "rgba(255, 107, 53, 0.06)",
                      borderColor: "rgba(255, 107, 53, 0.35)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#FF6B35]">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B35] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF6B35]"></span>
                        </span>
                        <Mic className="w-4 h-4 animate-bounce text-[#FF6B35]" />
                        <span>Live Voice Stream</span>
                      </div>
                      <span className="text-[11px] text-gray-400 font-medium">Real-time speech recognition</span>
                    </div>

                    <div
                      className="p-2.5 rounded-lg text-sm font-medium leading-relaxed min-h-[36px] flex items-center"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px dashed rgba(255, 107, 53, 0.30)",
                        color: liveInterimSpeech ? "var(--text-primary)" : "var(--text-muted)",
                      }}
                    >
                      {liveInterimSpeech ? (
                        <span className="text-[#FF6B35] font-semibold italic">
                          “{liveInterimSpeech}”
                        </span>
                      ) : (
                        <span className="italic opacity-70">
                          Listening... Start speaking into your microphone to see live transcript.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <textarea
                    value={answers[currentSection][question._id] || ""}
                    onChange={(e) => updateTechnicalText(question._id, e.target.value)}
                    placeholder={
                      isListeningVoice
                        ? "Speak or type your answer here..."
                        : "Write or speak your answer here..."
                    }
                    rows={8}
                    className="w-full p-4 border rounded-xl resize-y focus:outline-none focus:ring-2 font-normal leading-relaxed transition-colors"
                    style={{
                      background: "var(--input-bg, var(--card-bg))",
                      borderColor: isListeningVoice ? "#FF6B35" : "var(--card-border)",
                      color: "var(--text-primary)",
                      focusRingColor: meta.color,
                    }}
                  />

                  {/* Real-time live speech floating indicator inside textarea */}
                  {isListeningVoice && liveInterimSpeech && (
                    <div
                      className="absolute bottom-4 left-4 right-4 p-2 rounded-lg text-xs flex items-center gap-2 pointer-events-none backdrop-blur-md shadow-lg"
                      style={{
                        background: "rgba(15, 18, 28, 0.85)",
                        border: "1px solid rgba(255, 107, 53, 0.40)",
                        color: "#FF8A3D",
                      }}
                    >
                      <span className="font-bold">Live:</span>
                      <span className="truncate italic">{liveInterimSpeech}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{(answers[currentSection][question._id] || "").length} characters</span>
                  {(answers[currentSection][question._id] || "").length > 0 && (
                    <button
                      type="button"
                      onClick={() => updateTechnicalText(question._id, "")}
                      className="text-xs hover:underline cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Clear answer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className={["flex justify-between items-center", currentSection === "coding" ? "px-4 md:px-6 py-4 border-t mt-2" : ""].join(" ")}>
          <button
            onClick={goPrev}
            disabled={currentSection === "aptitude" && currentIndex === 0}
            className="flex items-center gap-2 px-6 py-2 border rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--card-bg)" }}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          {isLastQuestion ? (
            <button
              onClick={() => setConfirmEnd(true)}
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-2 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? "Submitting..." : "End & Submit Mock Interview"}
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex items-center gap-2 px-6 py-2 text-white rounded-lg hover:opacity-90"
              style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)" }}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tab & Window Switch Warning Banner */}
      {tabWarnings > 0 && phase === "assessment" && (
        <div className={`sticky bottom-0 z-40 px-4 py-2 text-xs text-center font-bold flex items-center justify-center gap-2 ${
          tabWarnings >= 2 ? "bg-red-600 text-white animate-pulse" : "bg-amber-500 text-black"
        }`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {tabWarnings >= 2
            ? "🚨 Warning 2 of 3 (Final Warning)"
            : `⚠️ Warning ${tabWarnings} of 3`}
        </div>
      )}

      {/* Fullscreen exit overlay */}
      {fullscreenExited && phase === "assessment" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none" style={{ background: "rgba(5,6,9,0.96)", backdropFilter: "blur(16px)" }}>
          <div className="max-w-md w-full p-6 rounded-3xl text-center flex flex-col items-center gap-4" style={{ background: "linear-gradient(145deg,#0e1222 0%,#070913 100%)", border: "1px solid rgba(239,68,68,0.3)", boxShadow: "0 0 50px rgba(239,68,68,0.2)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171" }}>
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Fullscreen exited</h2>
              <p className="text-xs text-white/70 mt-2 leading-relaxed">
                Please return to fullscreen to continue your mock interview.
              </p>
            </div>
            <button
              onClick={handleReenterFullscreen}
              className="w-full py-3.5 px-6 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}
            >
              <Maximize2 className="w-4 h-4" /> Return to Fullscreen
            </button>
            <p className="text-[10px] text-white/30 font-mono">Progress is saved automatically</p>
          </div>
        </div>
      )}

      {/* End confirmation */}
      {confirmEnd && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none" style={{ background: "rgba(8,11,20,0.88)", backdropFilter: "blur(4px)" }}>
          <div className="max-w-md w-full p-6 rounded-3xl text-center flex flex-col items-center gap-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)", color: "var(--error)" }}>
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold">End Mock Interview?</h3>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                This will submit and permanently grade your mock interview. This action cannot be undone.
              </p>
            </div>
            <div className="w-full flex gap-2">
              <button
                onClick={() => setConfirmEnd(false)}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <button
                onClick={submitFinal}
                disabled={loading || submitting}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#EF4444 0%,#DC2626 100%)" }}
              >
                {loading || submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "End & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumeRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}
