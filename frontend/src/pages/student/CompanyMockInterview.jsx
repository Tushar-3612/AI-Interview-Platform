import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Play,
  Clock,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Shield,
  Maximize,
  Monitor,
  Copy,
  MousePointerClick,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

// Section components
import AptitudeSection from "./CompanyMockSections/AptitudeSection";
import TechnicalSection from "./CompanyMockSections/TechnicalSection";
import CodingSection from "./CompanyMockSections/CodingSection";
import ResultSection from "./CompanyMockSections/ResultSection";

const SECTIONS = ["aptitude", "technical", "coding"];
const SECTION_LABELS = { aptitude: "Aptitude", technical: "Technical", coding: "Coding" };

/**
 * Server-authoritative timer model:
 *  - status: not_started | in_progress (active) | paused | completed | auto_submitted | expired
 *  - expiresAt: absolute deadline (ms epoch) of ACTIVE time; shifted forward on every resume.
 *  - pausedAt: when the current pause began (null when running).
 *  - remaining (while paused) is frozen at expiresAt - pausedAt.
 * The frontend timer is display-only; the backend is authoritative.
 */
function CompanyMockInterview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = getAuthToken();

  // State
  const [phase, setPhase] = useState("select"); // select, structure, instructions, security, exam, result
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [resumeCandidate, setResumeCandidate] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [isResume, setIsResume] = useState(false);
  const [questions, setQuestions] = useState({ aptitude: [], technical: [], coding: [] });
  const [currentSection, setCurrentSection] = useState("aptitude");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({ aptitude: {}, technical: {}, coding: {} });
  const [codingDrafts, setCodingDrafts] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState("java");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Timer (display only, seconds)
  const [timeLeft, setTimeLeft] = useState(0);
  const [lockReason, setLockReason] = useState(null); // fullscreen_exit | tab_switch | both | fullscreen_required
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Refs (source of truth for async listeners)
  const timerRef = useRef(null);
  const tokenRef = useRef(token);
  const phaseRef = useRef(phase);
  const attemptRef = useRef(null);
  const currentSectionRef = useRef(currentSection);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const lockReasonRef = useRef(null);
  const allowFullscreenExitRef = useRef(false);
  const submittingRef = useRef(false);
  const autoSubmittingRef = useRef(false);
  const examContainerRef = useRef(null);
  const handleSubmitRef = useRef(null);
  const serverStateRef = useRef({ status: "not_started", expiresAtMs: null, pausedAtMs: null, frozenRemainingMs: null });

  // Debounced autosave bookkeeping (PART 23): we keep frontend state immediate
  // but only hit the backend after the student stops typing for ~700ms. This is
  // the single biggest fix for the rate-limiting problem — it prevents one
  // backend request per keystroke.
  const saveTimers = useRef({});
  const debouncedSave = (key, fn, delay = 700) => {
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key].timer);
    saveTimers.current[key] = {
      timer: setTimeout(() => {
        delete saveTimers.current[key];
        fn();
      }, delay),
      fn,
    };
  };
  const flushSaves = () => {
    Object.values(saveTimers.current).forEach((entry) => {
      clearTimeout(entry.timer);
      try { entry.fn(); } catch { /* ignore */ }
    });
    saveTimers.current = {};
  };

  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { attemptRef.current = attempt; }, [attempt]);
  useEffect(() => { currentSectionRef.current = currentSection; }, [currentSection]);
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);
  useEffect(() => { lockReasonRef.current = lockReason; }, [lockReason]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);

  // Keep body class in sync (hide navbar while assessment active). The navbar is
  // hidden for the entire active mock flow — from the structure/instructions/
  // security gates through the live exam — and restored on select/result.
  useEffect(() => {
    if (["exam", "security", "instructions", "structure"].includes(phase)) {
      document.body.classList.add("assessment-active");
    } else {
      document.body.classList.remove("assessment-active");
    }
    return () => document.body.classList.remove("assessment-active");
  }, [phase]);

  // ---------- Load companies ----------
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [practiceRes, statsRes] = await Promise.all([
          api.get("/api/practice/home", { headers }),
          api.get("/api/student/dashboard-stats", { headers }).catch(() => null),
        ]);
        const list = (practiceRes.data?.companies || []).filter((c) => c.status !== "inactive");
        setCompanies(list);
        const target = statsRes?.data?.targetCompany || "";
        if (target) {
          const match = list.find((c) => (c.id || c._id) === target);
          if (match) setSelectedCompany({ ...match, id: match.id || match._id });
        }
      } catch (error) {
        console.error("Load companies error:", error);
      }
    };
    loadCompanies();
  }, [token]);

  // Detect an in-progress / paused / abandoned attempt so the select screen can
  // offer a dedicated "Continue Mock Interview" card (PART 9 / PART 32 / PART 33).
  useEffect(() => {
    const checkResume = async () => {
      try {
        const { data } = await api.get("/api/company-mock/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const attempts = data.attempts || [];
        const resumable = attempts.find((a) =>
          ["in_progress", "paused", "abandoned", "not_started"].includes(a.status)
        );
        if (resumable) setResumeCandidate(resumable);
      } catch {
        // best effort
      }
    };
    checkResume();
  }, [token]);

  // ---------- Load result view ----------
  useEffect(() => {
    const resultId = searchParams.get("result");
    if (!resultId) return;
    const loadResult = async () => {
      try {
        const { data } = await api.get(`/api/company-mock/attempt/${resultId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.attempt) {
          setResult({
            scores: data.attempt.scores,
            feedback: data.attempt.feedback,
            security: data.attempt.security,
          });
          setSelectedCompany({ id: data.attempt.companyId, name: data.attempt.companyName });
          setPhase("result");
        }
      } catch (error) {
        console.error("Load result error:", error);
      }
    };
    loadResult();
  }, [searchParams, token]);

  // ---------- Helpers ----------
  const authHeaders = () => ({ Authorization: `Bearer ${tokenRef.current}` });

  const applyServerState = (data) => {
    serverStateRef.current = {
      status: data.status,
      expiresAtMs: data.expiresAt ? new Date(data.expiresAt).getTime() : serverStateRef.current.expiresAtMs,
      pausedAtMs: data.pausedAt ? new Date(data.pausedAt).getTime() : null,
      frozenRemainingMs: typeof data.remainingMs === "number" ? data.remainingMs : serverStateRef.current.frozenRemainingMs,
    };
    setAttempt((a) => (a ? { ...a, status: data.status } : a));
  };

  const enterFullscreen = async () => {
    const elem = examContainerRef.current || document.documentElement;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      }
    } catch {
      // User may deny or browser may block; handled by caller via document.fullscreenElement check
    }
    return !!document.fullscreenElement;
  };

  const exitFullscreen = () => {
    allowFullscreenExitRef.current = true;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const getCurrentQuestionId = () => {
    const sectionQuestions = questions[currentSectionRef.current] || [];
    return sectionQuestions[currentQuestionIndexRef.current]?.questionId || null;
  };

  const saveProgressState = async (section, index) => {
    const att = attemptRef.current;
    if (!att?._id) return;
    try {
      await api.post(
        "/api/company-mock/progress",
        { attemptId: att._id, currentSection: section, currentQuestionIndex: index },
        { headers: authHeaders() }
      );
    } catch {
      // best effort
    }
  };

  // ---------- Server pause / resume ----------
  const pauseAssessment = useCallback(async (reason) => {
    const att = attemptRef.current;
    if (!att?._id) return;
    if (serverStateRef.current.status !== "in_progress") return; // idempotent
    try {
      flushSaves();
      await saveProgressState(currentSectionRef.current, currentQuestionIndexRef.current);
      const { data } = await api.post(
        "/api/company-mock/pause",
        {
          attemptId: att._id,
          reason,
          section: currentSectionRef.current,
          questionId: getCurrentQuestionId(),
        },
        { headers: authHeaders() }
      );
      serverStateRef.current = {
        status: data.status,
        expiresAtMs: serverStateRef.current.expiresAtMs,
        pausedAtMs: data.pausedAt ? new Date(data.pausedAt).getTime() : null,
        frozenRemainingMs: data.remainingMs,
      };
      setAttempt((a) => (a ? { ...a, status: data.status } : a));
    } catch (error) {
      console.error("Pause error:", error);
    }
  }, []);

  const resumeAssessment = useCallback(async () => {
    const att = attemptRef.current;
    if (!att?._id) return;
    if (serverStateRef.current.status !== "paused") return; // idempotent
    try {
      const { data } = await api.post(
        "/api/company-mock/resume",
        {
          attemptId: att._id,
          section: currentSectionRef.current,
          questionId: getCurrentQuestionId(),
        },
        { headers: authHeaders() }
      );
      serverStateRef.current = {
        status: data.status,
        expiresAtMs: data.expiresAt ? new Date(data.expiresAt).getTime() : serverStateRef.current.expiresAtMs,
        pausedAtMs: null,
        frozenRemainingMs: null,
      };
      setAttempt((a) => (a ? { ...a, status: data.status } : a));
      setLockReason(null);
      lockReasonRef.current = null;
    } catch (error) {
      console.error("Resume error:", error);
    }
  }, []);

  const maybeResume = useCallback(() => {
    if (phaseRef.current !== "exam") return;
    if (lockReasonRef.current && document.fullscreenElement && document.visibilityState === "visible") {
      resumeAssessment();
    }
  }, [resumeAssessment]);

  // Return-to-assessment action from the blocking security modal.
  // Only resumes after fullscreen is confirmed AND the tab is visible.
  const handleReturnToAssessment = useCallback(async () => {
    if (!document.fullscreenElement) {
      await enterFullscreen();
    }
    if (document.fullscreenElement && document.visibilityState === "visible") {
      await resumeAssessment();
    } else {
      toast.error("Please allow fullscreen mode to continue the assessment.");
    }
  }, [enterFullscreen, resumeAssessment]);

  // Exit Mock Interview — show confirmation first; never destroy the attempt.
  const handleConfirmExit = useCallback(async () => {
    const att = attemptRef.current;
    try {
      flushSaves();
      await saveProgressState(currentSectionRef.current, currentQuestionIndexRef.current);
      if (att?._id) {
        await api.post(
          "/api/company-mock/exit",
          {
            attemptId: att._id,
            section: currentSectionRef.current,
            questionId: getCurrentQuestionId(),
          },
          { headers: authHeaders() }
        );
      }
    } catch (error) {
      console.error("Exit attempt error:", error);
    } finally {
      setShowExitConfirm(false);
      exitFullscreen();
      navigate("/company-mock/history");
    }
  }, [saveProgressState, getCurrentQuestionId, exitFullscreen, navigate]);

  // ---------- Timer (single interval, server-authoritative) ----------
  useEffect(() => {
    if (phase !== "exam") return;

    const tick = () => {
      const s = serverStateRef.current;
      const now = Date.now();
      if (s.status === "in_progress" && s.expiresAtMs) {
        const rem = Math.max(0, s.expiresAtMs - now);
        setTimeLeft(Math.floor(rem / 1000));
        if (rem <= 0 && !autoSubmittingRef.current) {
          autoSubmittingRef.current = true;
          handleSubmitRef.current?.();
        }
      } else if (s.status === "paused" && s.frozenRemainingMs != null) {
        setTimeLeft(Math.floor(s.frozenRemainingMs / 1000));
      }
    };

    tick();
    timerRef.current = setInterval(tick, 250);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ---------- Security listeners (single set, cleaned up on unmount/phase change) ----------
  useEffect(() => {
    if (phase !== "exam") return;

    // Unified lock trigger. If already locked by a different event, escalate to
    // a combined "both" lock so we never stack multiple modals (req 21).
    const triggerLock = (reason) => {
      const prev = lockReasonRef.current;
      if (prev && prev !== "fullscreen_required") {
        setLockReason("both");
        lockReasonRef.current = "both";
      } else if (prev !== "fullscreen_required") {
        setLockReason(reason);
        lockReasonRef.current = reason;
      }
    };

    const handleFullscreenChange = () => {
      const fs = !!document.fullscreenElement;
      if (!fs) {
        if (allowFullscreenExitRef.current) return; // intentional exit (submit)
        if (phaseRef.current !== "exam") return;
        if (serverStateRef.current.status === "in_progress") {
          pauseAssessment("fullscreen_exit");
        }
        triggerLock("fullscreen_exit");
      } else {
        maybeResume();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (allowFullscreenExitRef.current || submittingRef.current) return;
        if (phaseRef.current !== "exam") return;
        if (serverStateRef.current.status === "in_progress") {
          pauseAssessment("tab_switch");
        }
        triggerLock("tab_switch");
      } else {
        maybeResume();
      }
    };

    const handleBlur = () => {
      if (allowFullscreenExitRef.current || submittingRef.current) return;
      if (phaseRef.current !== "exam") return;
      if (serverStateRef.current.status === "in_progress") {
        pauseAssessment("tab_switch");
      }
      triggerLock("tab_switch");
    };

    const handleFocus = () => {
      maybeResume();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [phase, pauseAssessment, maybeResume]);

  // ---------- Security restrictions (copy / paste / cut / right-click) ----------
  // Active for the ENTIRE Company Mock assessment, including the coding IDE.
  // We block clipboard operations and the context menu, but we deliberately do
  // NOT touch Monaco's editing shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+F / Ctrl+H /
  // Ctrl+/ / Ctrl+Space / arrows / Home / End / Shift+Arrow), so the IDE stays
  // fully usable (PART 26 / PART 28 / PART 29).
  useEffect(() => {
    if (phase !== "exam") return;

    // Throttle security-event recording so a single browser event can never
    // generate a burst of records (PART 37). At most one POST per eventType
    // per 1500ms.
    const lastSent = {};
    const recordEvent = (eventType) => {
      const att = attemptRef.current;
      if (!att?._id) return;
      const now = Date.now();
      if (lastSent[eventType] && now - lastSent[eventType] < 1500) return;
      lastSent[eventType] = now;
      api
        .post(
          "/api/company-mock/security-event",
          { attemptId: att._id, eventType },
          { headers: authHeaders() }
        )
        .catch(() => {});
    };

    const blockClipboard = (e) => {
      e.preventDefault();
      const t = e.type; // copy | cut | paste
      recordEvent(t === "copy" ? "copy_attempt" : t === "cut" ? "cut_attempt" : "paste_attempt");
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      recordEvent("right_click_attempt");
    };

    // Keyboard shortcuts for clipboard (Ctrl/Cmd + C/V/X and Shift+Insert).
    const handleKeyDown = (e) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        recordEvent("copy_attempt");
      } else if (isMod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        recordEvent("paste_attempt");
      } else if (isMod && (e.key === "x" || e.key === "X")) {
        e.preventDefault();
        recordEvent("cut_attempt");
      } else if (e.shiftKey && (e.key === "Insert" || e.key === "Ins")) {
        e.preventDefault();
        recordEvent("paste_attempt");
      }
    };

    document.addEventListener("copy", blockClipboard);
    document.addEventListener("cut", blockClipboard);
    document.addEventListener("paste", blockClipboard);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("copy", blockClipboard);
      document.removeEventListener("cut", blockClipboard);
      document.removeEventListener("paste", blockClipboard);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [phase]);

  // ---------- Flow: create / resume attempt ----------
  const handleStartInterview = async (companyOverride) => {
    const company = companyOverride || selectedCompany;
    if (!company) {
      toast.error("Please select a company");
      return;
    }
    setSelectedCompany(company);
    setLoading(true);
    try {
      const companyId = company.id || company._id;
      const { data } = await api.post(
        "/api/company-mock/start",
        { companyId },
        { headers: authHeaders() }
      );

      const attemptData = data.attempt || {};
      const newAttempt = {
        _id: data.attemptId || attemptData._id,
        companyId: data.companyId || attemptData.companyId,
        status: data.status || attemptData.status || "not_started",
        expiresAt: data.expiresAt || attemptData.expiresAt,
        startedAt: data.startedAt || attemptData.startedAt,
        pausedAt: data.pausedAt || attemptData.pausedAt,
        totalPausedMs: data.totalPausedMs ?? attemptData.totalPausedMs ?? 0,
        config: data.config || attemptData.config,
      };
      setAttempt(newAttempt);
      attemptRef.current = newAttempt;

      setQuestions({
        aptitude: data.aptitude || [],
        technical: data.technical || [],
        coding: data.coding || [],
      });

      if (data.resume) {
        const aptAnswers = {};
        (attemptData.aptitudeAnswers || []).forEach((a) => {
          aptAnswers[a.questionId] = a.selectedOption;
        });
        const techAnswers = {};
        (attemptData.technicalAnswers || []).forEach((a) => {
          techAnswers[a.questionId] = a.answer;
        });
        setAnswers({ aptitude: aptAnswers, technical: techAnswers, coding: {} });
        setCurrentSection(attemptData.currentSection || "aptitude");
        setCurrentQuestionIndex(attemptData.currentQuestionIndex || 0);
        if (attemptData.selectedCodingLanguage) setSelectedLanguage(attemptData.selectedCodingLanguage);
        setIsResume(true);

        // If the existing attempt is still "running" (e.g. after a refresh while
        // not in fullscreen), lock it on the server immediately so the timer
        // does not keep counting while the student is not in the assessment.
        if (newAttempt.status === "in_progress") {
          api.post(
            "/api/company-mock/pause",
            { attemptId: newAttempt._id, reason: "fullscreen_exit" },
            { headers: authHeaders() }
          )
            .then(() => {
              setAttempt((a) => (a ? { ...a, status: "paused" } : a));
              attemptRef.current = { ...attemptRef.current, status: "paused" };
            })
            .catch(() => {});
        }

        setPhase("security"); // reuse security gate as resume gate
        toast.success("Resuming your in-progress mock interview");
      } else {
        if (data.warnings?.length) data.warnings.forEach((w) => toast.warning(w));
        setIsResume(false);
        setPhase("structure");
      }
    } catch (error) {
      console.error("Start interview error:", error);
      toast.error(error.response?.data?.message || "Failed to start interview");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToInstructions = () => setPhase("instructions");
  const handleBeginExam = () => setPhase("security");

  // Begin (fresh) or resume — MUST be after fullscreen is confirmed.
  const handleStartExam = async () => {
    const att = attemptRef.current;
    if (!att?._id) return;
    setLoading(true);
    try {
      await enterFullscreen();
      if (!document.fullscreenElement) {
        // Fullscreen request failed — do NOT start the timer or the test.
        setLockReason("fullscreen_required");
        lockReasonRef.current = "fullscreen_required";
        setLoading(false);
        return;
      }

      // Fetch authoritative server status before deciding begin vs resume.
      const statusResp = await api.get(`/api/company-mock/status/${att._id}`, { headers: authHeaders() });
      const serverStatus = statusResp.data.status;

      let resp;
      if (serverStatus === "paused" || serverStatus === "abandoned") {
        resp = await api.post(
          "/api/company-mock/resume",
          { attemptId: att._id, section: currentSectionRef.current, questionId: getCurrentQuestionId() },
          { headers: authHeaders() }
        );
      } else {
        resp = await api.post(
          "/api/company-mock/begin",
          { attemptId: att._id },
          { headers: authHeaders() }
        );
      }

      applyServerState(resp.data);
      setLockReason(null);
      lockReasonRef.current = null;
      setPhase("exam");
    } catch (error) {
      console.error("Start exam error:", error);
      toast.error(error.response?.data?.message || "Failed to start assessment");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Save answer ----------
  const handleSaveAnswer = (section, questionId, answer) => {
    // Update local state immediately for a snappy UI.
    setAnswers((prev) => ({
      ...prev,
      [section]: { ...prev[section], [questionId]: answer },
    }));
    const att = attemptRef.current;
    if (!att) return;
    // Debounced backend autosave (PART 23) — NOT on every selection/keystroke.
    debouncedSave(`answer:${section}:${questionId}`, async () => {
      try {
        await api.post(
          "/api/company-mock/answer",
          { attemptId: att._id, section, questionId, answer, timeTakenMs: 0 },
          { headers: authHeaders() }
        );
      } catch (error) {
        console.error("Save answer error:", error);
      }
    });
  };

  // ---------- Save coding draft ----------
  const handleSaveCodingDraft = (questionId, language, code) => {
    setCodingDrafts((prev) => ({ ...prev, [`${questionId}:${language}`]: code }));
    const att = attemptRef.current;
    if (!att) return;
    // Debounced backend autosave (PART 23). Frontend state is instant so the
    // editor never blocks; the backend write is coalesced.
    debouncedSave(`draft:${questionId}:${language}`, async () => {
      try {
        await api.post(
          "/api/company-mock/coding-draft",
          { attemptId: att._id, questionId, language, code },
          { headers: authHeaders() }
        );
      } catch (error) {
        console.error("Save coding draft error:", error);
      }
    });
  };

  // ---------- Navigation ----------
  const handleNext = () => {
    flushSaves();
    const sectionQuestions = questions[currentSection] || [];
    let nextSection = currentSection;
    let nextIndex = currentQuestionIndex;
    if (currentQuestionIndex < sectionQuestions.length - 1) {
      nextIndex = currentQuestionIndex + 1;
    } else {
      const idx = SECTIONS.indexOf(currentSection);
      if (idx < SECTIONS.length - 1) {
        nextSection = SECTIONS[idx + 1];
        nextIndex = 0;
      }
    }
    setCurrentSection(nextSection);
    setCurrentQuestionIndex(nextIndex);
    saveProgressState(nextSection, nextIndex);
  };

  const handlePrevious = () => {
    flushSaves();
    let prevSection = currentSection;
    let prevIndex = currentQuestionIndex;
    if (currentQuestionIndex > 0) {
      prevIndex = currentQuestionIndex - 1;
    } else {
      const idx = SECTIONS.indexOf(currentSection);
      if (idx > 0) {
        prevSection = SECTIONS[idx - 1];
        prevIndex = (questions[prevSection] || []).length - 1;
      }
    }
    setCurrentSection(prevSection);
    setCurrentQuestionIndex(prevIndex);
    saveProgressState(prevSection, prevIndex);
  };

  const handleJumpToQuestion = (section, index) => {
    flushSaves();
    setCurrentSection(section);
    setCurrentQuestionIndex(index);
    saveProgressState(section, index);
  };

  // ---------- Submit ----------
  const getCodingAttemptedCount = () => {
    const coding = questions.coding || [];
    let count = 0;
    for (const q of coding) {
      const langs = ["java", "cpp", "c", "python"];
      if (langs.some((l) => (codingDrafts[`${q.questionId}:${l}`] || "").trim())) count++;
    }
    return count;
  };

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    const att = attemptRef.current;
    if (!att?._id) return;

    setShowSubmitConfirm(false);
    setSubmitting(true);
    submittingRef.current = true;
    flushSaves();
    exitFullscreen();
    try {
      const { data } = await api.post(
        "/api/company-mock/submit",
        { attemptId: att._id, codingLanguages: { selected: selectedLanguage } },
        { headers: authHeaders() }
      );
      setResult(data);
      setPhase("result");
      clearInterval(timerRef.current);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error(error.response?.data?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [selectedLanguage]);

  // Manual submit → show confirmation modal first (PART 21). The auto-submit
  // timer calls handleSubmit() directly (no modal).
  const requestSubmit = () => {
    if (submittingRef.current) return;
    setShowSubmitConfirm(true);
  };

  // Set ref for handleSubmit (used by timer auto-submit)
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // ---------- Format helpers ----------
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getAnsweredCount = (section) => {
    const sectionAnswers = answers[section] || {};
    return Object.keys(sectionAnswers).filter((k) => sectionAnswers[k] !== "" && sectionAnswers[k] != null).length;
  };

  // Per-question answered check (used by the question palette — PART 9 / PART 33).
  const isQuestionAnswered = (section, index) => {
    const q = questions[section]?.[index];
    if (!q) return false;
    if (section === "coding") {
      const langs = ["java", "cpp", "c", "python"];
      return langs.some((l) => (codingDrafts[`${q.questionId}:${l}`] || "").trim());
    }
    const ans = answers[section]?.[q.questionId];
    return ans != null && ans !== "";
  };

  // ---------- Render ----------
  if (phase === "select") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Company Mock Interview Practice
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Practice company-style mock interviews with curated questions. This is a simulation, not an official company interview.
            </p>
          </div>

          {/* Continue existing mock (PART 32) — shown before starting a new one */}
          {resumeCandidate && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="student-card p-6 mb-8 border-2"
              style={{ borderColor: "var(--primary)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--primary)" }}>
                      Continue Existing Mock
                    </p>
                    <h3 className="text-lg font-bold mt-1" style={{ color: "var(--text-primary)" }}>
                      {resumeCandidate.companyName}
                    </h3>
                    <div className="text-xs mt-1 space-y-0.5" style={{ color: "var(--text-muted)" }}>
                      <p>
                        Aptitude: {resumeCandidate.aptitudeAnswers?.length || 0}/{resumeCandidate.config?.aptitudeCount || resumeCandidate.aptitudeAnswers?.length || 0}
                        {"  ·  "}Technical: {resumeCandidate.technicalAnswers?.length || 0}/{resumeCandidate.config?.technicalCount || resumeCandidate.technicalAnswers?.length || 0}
                        {"  ·  "}Coding: {(resumeCandidate.codingAnswers || []).length}/{resumeCandidate.config?.codingCount || (resumeCandidate.codingAnswers || []).length || 0}
                      </p>
                      <p>
                        Last position: {SECTION_LABELS[resumeCandidate.currentSection || "aptitude"]} — Question{" "}
                        ((resumeCandidate.currentQuestionIndex || 0) + 1)
                      </p>
                      <p>Status: {resumeCandidate.status === "completed" ? "Completed" : "In Progress"} · Last saved:{" "}
                        {new Date(resumeCandidate.updatedAt || resumeCandidate.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                <button
                  onClick={() =>
                    handleStartInterview({
                      id: resumeCandidate.companyId,
                      name: resumeCandidate.companyName,
                    })
                  }
                  disabled={loading}
                  className="px-6 py-3 rounded-xl font-bold text-white cursor-pointer flex items-center gap-2"
                  style={{ background: "var(--primary)" }}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  Continue Mock Interview
                </button>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((company) => (
              <motion.button
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedCompany?.id === company.id
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-[var(--border)] hover:border-[var(--primary)]/50"
                }`}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: company.color || "var(--primary)", color: "#fff" }}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {company.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {company.package || "Placement Drive"}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {selectedCompany && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
              <button
                onClick={handleStartInterview}
                disabled={loading}
                className="px-8 py-3 rounded-xl font-bold text-white cursor-pointer flex items-center gap-2"
                style={{ background: "var(--primary)" }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                Start {selectedCompany.name} Mock Interview
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  if (phase === "structure") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="student-card p-8">
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            {selectedCompany?.name} Mock Interview
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl border border-[var(--border)]">
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{questions.aptitude.length}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aptitude Questions</p>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border)]">
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{questions.technical.length}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Technical Questions</p>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border)]">
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{questions.coding.length}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Coding Problems</p>
            </div>
          </div>
          <div className="flex gap-4 mt-8">
            <button
              onClick={() => { setPhase("select"); setSelectedCompany(null); setIsResume(false); }}
              className="px-6 py-2.5 rounded-xl border font-semibold cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Back
            </button>
            <button
              onClick={handleProceedToInstructions}
              className="px-6 py-2.5 rounded-xl font-bold text-white cursor-pointer flex items-center gap-2"
              style={{ background: "var(--primary)" }}
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === "instructions") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="student-card p-8">
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            {selectedCompany?.name} Mock Interview Instructions
          </h2>

          <div className="space-y-4 mb-8">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Disclaimer:</strong> This is a practice simulation. Questions are curated for practice purposes and are NOT official company questions.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl border border-[var(--border)]">
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{questions.aptitude.length}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aptitude Questions</p>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)]">
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{questions.technical.length}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Technical Questions</p>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)]">
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{questions.coding.length}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Coding Problems</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Rules:</p>
              <ul className="text-sm space-y-1" style={{ color: "var(--text-secondary)" }}>
                <li>• The assessment must be taken in <strong>fullscreen</strong> mode.</li>
                <li>• The timer starts only after fullscreen is entered and pauses if you exit fullscreen or switch tabs.</li>
                <li>• Paused time does NOT count toward your assessment duration.</li>
                <li>• Tab switching and fullscreen exits are monitored and recorded.</li>
                <li>• Copy/paste is restricted (except in the coding section).</li>
                <li>• Auto-save is enabled. You can resume if interrupted.</li>
                <li>• All sections must be completed: Aptitude → Technical → Coding.</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setPhase("structure")}
              className="px-6 py-2.5 rounded-xl border font-semibold cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Back
            </button>
            <button
              onClick={handleBeginExam}
              className="px-6 py-2.5 rounded-xl font-bold text-white cursor-pointer flex items-center gap-2"
              style={{ background: "var(--primary)" }}
            >
              Begin Exam <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === "security") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="student-card p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-[var(--primary)]" />
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            {isResume ? "Assessment Security Check — Resume" : "Assessment Security Check"}
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-8 text-left">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)]">
              <Maximize className="w-5 h-5 text-green-500" />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>Fullscreen required to start</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)]">
              <Monitor className="w-5 h-5 text-amber-500" />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>Tab switching monitored</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)]">
              <Copy className="w-5 h-5 text-red-500" />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>Copy/paste restricted</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)]">
              <MousePointerClick className="w-5 h-5 text-red-500" />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>Right-click restricted</span>
            </div>
          </div>

          <button
            onClick={handleStartExam}
            disabled={loading}
            className="px-8 py-3 rounded-xl font-bold text-white cursor-pointer flex items-center gap-2 mx-auto"
            style={{ background: "var(--primary)" }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Maximize className="w-5 h-5" />}
            {isResume ? "Enter Fullscreen & Resume" : "Enter Fullscreen & Start"}
          </button>

          {lockReason === "fullscreen_required" && (
            <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-col items-center gap-3">
              <p className="text-sm text-red-400 font-semibold">
                Fullscreen is required to start the assessment.
              </p>
              <button
                onClick={handleStartExam}
                className="px-4 py-2 rounded-xl font-bold text-white text-sm cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                Try Again
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (phase === "exam") {
    return (
      <div id="company-mock-assessment" ref={examContainerRef} className="min-h-screen bg-[var(--bg-primary)]">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-[var(--card-bg)] border-b border-[var(--border)] px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/images/metadata.png"
                alt="PrepHire"
                draggable={false}
                className="h-7 w-auto object-contain select-none"
                style={{ maxHeight: "30px" }}
              />
              <h1 className="font-bold" style={{ color: "var(--text-primary)" }}>
                {selectedCompany?.name} Mock Interview
              </h1>
              <div className="flex gap-2">
                {SECTIONS.map((section) => (
                  <button
                    key={section}
                    onClick={() => handleJumpToQuestion(section, 0)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      currentSection === section
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {SECTION_LABELS[section]}
                    <span className="ml-1 text-[10px]">
                      ({getAnsweredCount(section)}/{questions[section]?.length || 0})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${timeLeft < 300 ? "bg-red-500/10 text-red-500" : "bg-[var(--bg-primary)]"}`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
                {attempt?.status === "paused" && (
                  <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-semibold">
                    PAUSED
                  </span>
                )}
              </div>
              <button
                onClick={requestSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-xl font-bold text-white text-sm cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
              </button>
            </div>
          </div>
        </div>

        {/* Question palette — jump directly to any question in the current section (PART 9 / PART 33) */}
        <div className="sticky top-[65px] z-40 bg-[var(--bg-primary)] border-b border-[var(--border)] px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-1.5">
            {(questions[currentSection] || []).map((q, idx) => {
              const answered = isQuestionAnswered(currentSection, idx);
              const active = idx === currentQuestionIndex;
              return (
                <button
                  key={q.questionId}
                  onClick={() => handleJumpToQuestion(currentSection, idx)}
                  title={`Question ${idx + 1}${answered ? " (answered)" : ""}`}
                  className={`relative w-8 h-8 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                    active
                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                      : answered
                      ? "bg-green-500/15 text-green-500 border-green-500/40"
                      : "bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border)]"
                  }`}
                >
                  {idx + 1}
                  {answered && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-green-500 text-white flex items-center justify-center text-[8px] leading-none">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {currentSection === "aptitude" && (
              <AptitudeSection
                key="aptitude"
                questions={questions.aptitude}
                currentIndex={currentQuestionIndex}
                answers={answers.aptitude}
                onSave={(questionId, answer) => handleSaveAnswer("aptitude", questionId, answer)}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onJumpTo={handleJumpToQuestion}
              />
            )}
            {currentSection === "technical" && (
              <TechnicalSection
                key="technical"
                questions={questions.technical}
                currentIndex={currentQuestionIndex}
                answers={answers.technical}
                onSave={(questionId, answer) => handleSaveAnswer("technical", questionId, answer)}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onJumpTo={handleJumpToQuestion}
              />
            )}
            {currentSection === "coding" && (
              <CodingSection
                key="coding"
                questions={questions.coding}
                currentIndex={currentQuestionIndex}
                drafts={codingDrafts}
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                onSaveDraft={handleSaveCodingDraft}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onJumpTo={handleJumpToQuestion}
                attemptId={attempt?._id}
                token={token}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Question Navigator */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--card-bg)] border-t border-[var(--border)] p-4 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Question {currentQuestionIndex + 1} of {questions[currentSection]?.length || 0}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentSection === "aptitude" && currentQuestionIndex === 0}
                className="px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <ChevronLeft className="w-4 h-4 inline" /> Previous
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                Next <ChevronRight className="w-4 h-4 inline" />
              </button>
            </div>
          </div>
        </div>

        {/* Blocking lock overlay (fullscreen exit / tab switch / combined) — rendered
            through a portal at document.body level so it sits above every assessment
            element (editor, header, dropdowns) regardless of ancestor stacking contexts. */}
        <AnimatePresence>
          {lockReason && lockReason !== "fullscreen_required" && createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="assessment-lock-overlay"
              role="alertdialog"
              aria-modal="true"
            >
              <div className="max-w-md mx-4 p-8 rounded-2xl border text-center bg-[var(--card-bg)] border-[var(--border)] shadow-2xl">
                {lockReason === "fullscreen_exit" ? (
                  <>
                    <Maximize className="w-12 h-12 mx-auto mb-4 text-red-500" />
                    <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Mock Interview Paused</h2>
                    <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
                      You have exited fullscreen mode.
                    </p>
                    <p className="text-sm mb-3 text-left" style={{ color: "var(--text-secondary)" }}>
                      For security and fairness, this Company Mock Interview must remain in fullscreen mode while the assessment is active.
                    </p>
                    <p className="text-sm mb-2 text-left" style={{ color: "var(--text-secondary)" }}>
                      Your progress has been safely saved. Your timer has been paused. No answers, coding drafts, or completed questions have been lost.
                    </p>
                    <p className="text-sm mb-4 text-left" style={{ color: "var(--text-secondary)" }}>
                      To continue the assessment, return to fullscreen mode. If you choose to exit the mock interview, your current progress will remain saved and you can resume this attempt later.
                    </p>
                    <div className="text-left mb-5 p-3 rounded-xl border text-[11px] space-y-1" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      <p>• Your progress is saved automatically.</p>
                      <p>• The timer is paused while outside the assessment.</p>
                      <p>• Your current question and section are preserved.</p>
                      <p>• Your coding drafts are preserved separately for each language.</p>
                      <p>• This security event has been recorded.</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleReturnToAssessment}
                        className="px-6 py-3 rounded-xl font-bold text-white cursor-pointer"
                        style={{ background: "var(--primary)" }}
                      >
                        Continue Mock Interview
                      </button>
                      <button
                        onClick={() => setShowExitConfirm(true)}
                        className="px-6 py-3 rounded-xl font-semibold cursor-pointer border"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        Exit This Mock Interview
                      </button>
                    </div>
                  </>
                ) : lockReason === "tab_switch" ? (
                  <>
                    <Monitor className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                    <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Tab Switch Detected</h2>
                    <p className="text-sm mb-2 text-left" style={{ color: "var(--text-secondary)" }}>
                      Your assessment was paused because you left the mock interview window.
                    </p>
                    <p className="text-sm mb-2 text-left" style={{ color: "var(--text-secondary)" }}>
                      Your progress has been saved and your timer has been paused.
                    </p>
                    <p className="text-sm mb-6 text-left" style={{ color: "var(--text-secondary)" }}>
                      Return to the assessment to continue.
                    </p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleReturnToAssessment}
                        className="px-6 py-3 rounded-xl font-bold text-white cursor-pointer"
                        style={{ background: "var(--primary)" }}
                      >
                        Continue Mock Interview
                      </button>
                      <button
                        onClick={() => setShowExitConfirm(true)}
                        className="px-6 py-3 rounded-xl font-semibold cursor-pointer border"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        Exit This Mock Interview
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Monitor className="w-12 h-12 mx-auto mb-4 text-red-500" />
                    <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Mock Interview Paused</h2>
                    <p className="text-sm mb-2 text-left" style={{ color: "var(--text-secondary)" }}>
                      Fullscreen was exited or the assessment window was left.
                    </p>
                    <p className="text-sm mb-2 text-left" style={{ color: "var(--text-secondary)" }}>
                      Your progress has been saved.
                    </p>
                    <p className="text-sm mb-6 text-left" style={{ color: "var(--text-secondary)" }}>
                      The assessment timer is paused. This activity has been recorded.
                    </p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleReturnToAssessment}
                        className="px-6 py-3 rounded-xl font-bold text-white cursor-pointer"
                        style={{ background: "var(--primary)" }}
                      >
                        Continue Mock Interview
                      </button>
                      <button
                        onClick={() => setShowExitConfirm(true)}
                        className="px-6 py-3 rounded-xl font-semibold cursor-pointer border"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        Exit Mock Interview
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>,
            document.body
          )}
        </AnimatePresence>

        {/* Exit Mock Interview confirmation — also a portal above the lock overlay */}
        <AnimatePresence>
          {showExitConfirm && createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="assessment-exit-confirm-overlay"
              role="alertdialog"
              aria-modal="true"
            >
              <div className="max-w-sm mx-4 p-8 rounded-2xl border text-center bg-[var(--card-bg)] border-[var(--border)] shadow-2xl">
                <h2 className="text-lg font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                  Exit Mock Interview?
                </h2>
                <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                  Your current progress will be saved. You can continue this mock interview later from the Company Mock Interview section.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold cursor-pointer border"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Continue Mock
                  </button>
                  <button
                    onClick={handleConfirmExit}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white cursor-pointer"
                    style={{ background: "var(--primary)" }}
                  >
                    Save &amp; Exit
                  </button>
                </div>
              </div>
            </motion.div>,
            document.body
          )}
        </AnimatePresence>

        {/* Final Submit confirmation — portal above everything (PART 21) */}
        <AnimatePresence>
          {showSubmitConfirm && createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="assessment-exit-confirm-overlay"
              role="alertdialog"
              aria-modal="true"
            >
              <div className="max-w-sm mx-4 p-8 rounded-2xl border text-center bg-[var(--card-bg)] border-[var(--border)] shadow-2xl">
                <h2 className="text-lg font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                  SUBMIT MOCK INTERVIEW?
                </h2>
                <div className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
                  You have attempted:
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                    <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      {getAnsweredCount("aptitude")}/{questions.aptitude?.length || 0}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Aptitude</p>
                  </div>
                  <div className="p-2 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                    <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      {getAnsweredCount("technical")}/{questions.technical?.length || 0}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Technical</p>
                  </div>
                  <div className="p-2 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                    <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      {getCodingAttemptedCount()}/{questions.coding?.length || 0}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Coding</p>
                  </div>
                </div>
                <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                  Are you sure you want to submit? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold cursor-pointer border"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white cursor-pointer flex items-center justify-center gap-2"
                    style={{ background: "var(--primary)" }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
                  </button>
                </div>
              </div>
            </motion.div>,
            document.body
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <ResultSection
        result={result}
        company={selectedCompany}
        onBackToDashboard={() => navigate("/dashboard")}
        onViewHistory={() => navigate("/company-mock/history")}
      />
    );
  }

  return null;
}

export default CompanyMockInterview;
