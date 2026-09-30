import { useState, useEffect, useRef, useCallback } from "react";
import api from "../utils/api";
import { getAuthToken } from "./useStudentProfile";

/**
 * Code Autosave Hook
 * Periodically sends code to /api/coding/autosave.
 * Manages save status: "idle", "dirty", "saving", "saved".
 */
export function useAutosaveCode({ attemptId, questionId, language, code, intervalMs = 6000 }) {
  const [saveStatus, setSaveStatus] = useState("idle");
  const codeRef = useRef(code);
  codeRef.current = code;
  const lastSavedCodeRef = useRef("");
  const timerRef = useRef(null);

  const save = useCallback(async (forcedCode = null) => {
    const codeToSave = forcedCode !== null ? forcedCode : codeRef.current;
    if (!attemptId || !questionId || !codeToSave) return;
    if (codeToSave === lastSavedCodeRef.current) return;

    setSaveStatus("saving");
    try {
      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post(
        "/api/coding/autosave",
        {
          attemptId,
          questionId,
          language,
          sourceCode: codeToSave,
        },
        { headers }
      );

      lastSavedCodeRef.current = codeToSave;
      setSaveStatus("saved");
    } catch {
      setSaveStatus("dirty");
    }
  }, [attemptId, questionId, language]);

  // When code changes, mark dirty and schedule debounced autosave
  useEffect(() => {
    if (!code || code === lastSavedCodeRef.current) return;
    setSaveStatus("dirty");

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save();
    }, intervalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code, save, intervalMs]);

  const markInitialCodeAsSaved = useCallback((initialCode) => {
    lastSavedCodeRef.current = initialCode || "";
    setSaveStatus("saved");
  }, []);

  return {
    saveStatus,
    triggerSave: () => save(),
    markInitialCodeAsSaved,
  };
}
