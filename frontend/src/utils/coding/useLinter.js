import { useEffect, useRef, useState, useCallback } from "react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { parseOutputMarkers, explainError } from "./errorExplanations";

const LINT_DEBOUNCE_MS = 1500;

/**
 * As-you-type linting for the code editor.
 *
 *  - JavaScript: Monaco's built-in TypeScript language worker provides
 *    real-time, accurate diagnostics (undefined vars, syntax, type issues)
 *    with NO backend calls — markers are shown automatically by Monaco.
 *  - Python / Java / C / C++ / C# / Go / Rust / Kotlin / PHP: debounced
 *    compile-check via the EXISTING `/api/practice/coding/run` endpoint with
 *    empty input. Compiler/runtime output is parsed into line/column markers
 *    (GCC / Java / Python formats) and annotated with an error explanation.
 *
 * Returns the current markers so the Output panel's "Compiler" tab can render
 * them. Markers are also pushed onto the editor model so the gutter shows
 * red squiggles while typing.
 */
export default function useLinter(monaco, editor, language, code, enabled = true) {
  const [markers, setMarkers] = useState([]);
  const latestRef = useRef({ language, code });
  const timerRef = useRef(null);
  const pendingRef = useRef(false);

  latestRef.current = { language, code };

  // Apply markers to the editor model (called by setModelMarkers internally)
  const apply = useCallback(
    (monacoInstance, ed, list) => {
      if (!monacoInstance || !ed) return;
      const model = ed.getModel();
      if (!model) return;
      const m = (list || []).map((x) => ({
        severity: x.severity === 2 ? monacoInstance.MarkerSeverity.Warning : monacoInstance.MarkerSeverity.Error,
        startLineNumber: x.line,
        startColumn: x.column,
        endLineNumber: x.endLine || x.line,
        endColumn: x.endColumn || x.column + (x.message ? x.message.length : 1),
        message: x.message,
      }));
      monacoInstance.editor.setModelMarkers(model, "coding-ide-lint", m);
    },
    []
  );

  const clear = useCallback(
    (monacoInstance, ed) => {
      if (!monacoInstance || !ed) return;
      const model = ed.getModel();
      if (model) monacoInstance.editor.setModelMarkers(model, "coding-ide-lint", []);
    },
    []
  );

  const runLint = useCallback(async () => {
    const { language: lang, code: src } = latestRef.current;
    if (!src || src.trim().length < 2) {
      setMarkers([]);
      clear(monaco, editor);
      return;
    }
    // JS/TS handled by the language service worker — don't double-run.
    if (lang === "javascript" || lang === "typescript" || lang === "typescriptreact" || lang === "jsx") {
      // Pull diagnostics that Monaco's TS worker already attached for display.
      const ed2 = editor;
      if (monaco && ed2) {
        const model = ed2.getModel();
        if (model) {
          const owned = monaco.editor.getModelMarkers({ resource: model.uri }).filter((mk) => mk.owner === "typescript");
          const list = owned.map((mk) => ({
            line: mk.startLineNumber,
            column: mk.startColumn,
            endLine: mk.endLineNumber,
            endColumn: mk.endColumn,
            severity: mk.severity,
            message: mk.message,
            explanation: explainError(mk.message),
          }));
          setMarkers(list);
        }
      }
      return;
    }

    pendingRef.current = true;
    try {
      const token = getAuthToken();
      const res = await api.post(
        "/api/practice/coding/run",
        { language: lang, code: src, input: "" },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const data = res.data || {};
      const raw = data.output || data.message || "";
      const isErr = data.type === "error" || data.type === "compile_error" || data.type === "runtime_error";
      const list = isErr ? parseOutputMarkers(raw) : [];
      const annotated = list.map((x) => ({ ...x, explanation: explainError(x.message) }));
      setMarkers(annotated);
      apply(monaco, editor, annotated);
    } catch (err) {
      const msg = err.response?.data?.message || "Lint request failed";
      setMarkers([{ line: 1, column: 1, severity: 1, message: msg, explanation: explainError(msg) }]);
    } finally {
      pendingRef.current = false;
    }
  }, [monaco, editor, apply, clear]);

  // Debounced lint on language/code change
  useEffect(() => {
    if (!enabled) return;
    if (monaco && editor && (language === "javascript" || language === "typescript")) {
      // JS diagnostics come from the language worker; just mirror them.
      const model = editor.getModel();
      if (!model) return;
      const reader = () => {
        const owned = monaco.editor.getModelMarkers({ resource: model.uri }).filter((mk) => mk.owner === "typescript");
        const list = owned.map((mk) => ({
          line: mk.startLineNumber,
          column: mk.startColumn,
          endLine: mk.endLineNumber,
          endColumn: mk.endColumn,
          severity: mk.severity,
          message: mk.message,
          explanation: explainError(mk.message),
        }));
        setMarkers(list);
      };
      const onChange = model.onDidChangeContent(reader);
      const onMarkers = monaco.editor.onDidChangeMarkers((uris) => {
        if (uris.some((u) => u.toString() === model.uri.toString())) reader();
      });
      reader();
      return () => {
        onChange.dispose();
        onMarkers.dispose();
      };
    }

    // Non-JS: debounced compile check
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runLint, LINT_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, monaco, editor, language, code, runLint]);

  // Clear stale markers when code is being edited (so squiggles don't linger
  // on a transiently-removed error until the debounce fires).
  useEffect(() => {
    const t = setTimeout(() => {
      if (language === "javascript" || language === "typescript") return;
      if (!code || code.trim().length < 2) {
        setMarkers([]);
        clear(monaco, editor);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [code, language, monaco, editor, clear]);

  return { markers, refresh: runLint };
}
