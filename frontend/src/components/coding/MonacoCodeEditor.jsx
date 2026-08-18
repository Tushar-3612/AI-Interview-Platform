import React, { useRef, useEffect, useCallback } from "react";
import { Editor } from "@monaco-editor/react";
import { initMonaco } from "../../monaco-init";
import { LANGUAGE_META } from "../../utils/coding/languageConfig";

/**
 * Monaco-based code editor.
 *
 * Features: VS Code theme, syntax highlighting, minimap, line numbers, code
 * folding, bracket pair colorization, multi-cursor, word wrap toggle, find /
 * replace, auto-indent, auto-closing brackets/quotes, VS Code-style
 * IntelliSense (built-in for JS/TS, snippet+keyword+stdlib for the rest), and
 * on-the-fly error squiggles fed by the parent via `markers`.
 *
 * Removed: CodeLens, Breadcrumbs, Lightbulb quick fixes, Command Palette,
 *          Rename Symbol, Peek Definition, Find References, Change All Occurrences
 */
const DEBUG_LINE_DECOR_ID = "debug-current-line";

const EDITOR_OPTIONS = (wordWrap, showMinimap = true) => ({
  automaticLayout: true,
  fontSize: 13,
  lineNumbers: "on",
  selectOnLineNumbersClick: true,
  renderLineHighlight: "all",
  lineHeight: 20,
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: false,
  wordWrap: wordWrap ? "on" : "off",
  wordWrapColumn: 80,
  wrappingIndent: "same",
  rulers: [80],
  whitespace: "boundary",
  unfoldLinesWithWrap: false,
  renderWhitespace: "boundary",
  renderControlCharacters: false,
  // ---- Editing helpers ----
  autoIndent: "advanced",
  autoClosingBrackets: "languageDefined",
  autoClosingQuotes: "languageDefined",
  autoSurround: "languageDefined",
  acceptSubstringOnPaste: true,
  // ---- Navigation / assistance ----
  minimap: { enabled: showMinimap, showSlider: "always", renderComments: "codesearch" },
  overviewRulerBorder: true,
  scrollbar: {
    vertical: "auto",
    horizontal: "auto",
    useShadows: false,
    verticalHasArrows: false,
  },
  // ---- Structure ----
  codeLens: false,
  folding: true,
  foldingStrategy: "auto",
  collapseFolds: "all",
  foldingHighlight: true,
  bracketPairColorization: {
    enabled: true,
    autoIndentColorBracketPairs: true,
  },
  guides: {
    bracketPairs: true,
    indentation: true,
    highlightActiveBracket: true,
    connectedOutlines: true,
  },
  // ---- Disabled features (removed unused commands) ----
  quickSuggestions: true,
  quickSuggestionSnippetSuggestions: "top",
  suggestOnTriggerCharacters: true,
  suggest: {
    showSnippets: true,
    showKeywords: true,
    showWords: true,
    showFunctions: true,
    showVariables: true,
    showClasses: true,
    showModules: true,
    showOperators: true,
    showProperties: true,
    showStructures: true,
    showReferences: false,
  },
  parameterHints: {
    enabled: true,
    cycle: true,
    onTriggerCharacter: true,
  },
  hover: {
    enabled: true,
    delay: 300,
    staleTimeout: 200,
    sticky: true,
  },
  multiCursorModifier: "alt",
  accessibilitySupport: "off",
  // Disable unused editor actions
  contextmenu: true,
  // Disable lightbulb / code actions indicator
  lightbulb: { enabled: false },
  // Disable breadcrumbs
  breadcrumb: { enabled: false },
  // Disable inline hints that clutter the UI
  inlineSuggest: { enabled: false },
});

const MONACO_KEYBINDINGS = [
  { key: { mod: true, code: "Enter" }, editor: "editor.action.insertLineBelow", when: null },
];

function MonacoCodeEditor({
  code,
  language = "javascript",
  onChange,
  onEditorReady,
  theme = "dark",
  wordWrap = false,
  readOnly = false,
  markers = [],
  debugLine = null,
  debugMode = false,
  split = false,
  showMinimap = true,
  className = "",
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const secondaryEditorRef = useRef(null);

  const handleBeforeMount = useCallback(
    (monacoInstance) => {
      initMonaco(monacoInstance);
      monacoRef.current = monacoInstance;
    },
    []
  );

  const setEditorMarkers = useCallback((editor, monacoInstance) => {
    const model = editor.getModel();
    if (!model || !monacoInstance) return;
    monacoInstance.editor.setModelMarkers(model, "coding-ide", markers);
  }, [markers]);

  const applyDebugDecoration = useCallback(
    (editor, monacoInstance) => {
      if (!editor || !monacoInstance) return;
      const model = editor.getModel();
      if (!model) return;
      const newDecorations = [];
      if (debugLine) {
        const line = typeof debugLine === "number" ? debugLine : 1;
        newDecorations.push({
          range: new monacoInstance.Range(line, 1, line, model.getLineMaxColumn(line)),
          options: {
            isWholeLine: true,
            className: "debug-current-line",
            zIndex: 50,
          },
        });
      }
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
      if (debugLine && editor.hasDocumentVisible()) {
        editor.revealLineInCenterIfOutsideViewport(debugLine);
      }
    },
    [debugLine]
  );

  const handleEditorMount = useCallback(
    (editor, monacoInstance) => {
      editorRef.current = editor;
      monacoRef.current = monacoInstance;
      onEditorReady && onEditorReady(editor, monacoInstance);

      setEditorMarkers(editor, monacoInstance);
      applyDebugDecoration(editor, monacoInstance);

      // ---- Keyboard shortcuts ----
      editor.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
        () => editor.trigger("editor", "coding.run"),
        null
      );
      editor.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.Enter,
        () => editor.trigger("editor", "coding.submit"),
        null
      );
      editor.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyF,
        () => editor.trigger("editor", "actions.find"),
        null
      );
      editor.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyH,
        () => editor.trigger("editor", "editor.action.startReplace"),
        null
      );
      editor.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Slash,
        () => editor.trigger("editor", "editor.action.commentLine"),
        null
      );
      editor.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyD,
        () => editor.trigger("editor", "editor.action.copyLinesDownAction"),
        null
      );

      // Disable unused actions via monaco API
      editor.updateOptions({
        // Disable lightbulb
        lightbulb: { enabled: false },
      });
    },
    [onEditorReady, wordWrap, readOnly, split, setEditorMarkers, applyDebugDecoration, showMinimap, theme]
  );

  useEffect(() => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;
    if (!editor || !monacoInstance) return;
    setEditorMarkers(editor, monacoInstance);
  }, [markers, setEditorMarkers]);

  useEffect(() => {
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;
    if (!editor || !monacoInstance) return;
    applyDebugDecoration(editor, monacoInstance);
  }, [debugLine, applyDebugDecoration]);

  useEffect(() => {
    const monacoInstance = monacoRef.current;
    if (!monacoInstance) return;
    monacoInstance.editor.setTheme(theme === "dark" ? "platform-dark" : "platform-light");
  }, [theme]);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.updateOptions({
      wordWrap: wordWrap ? "on" : "off",
      readOnly,
    });
  }, [wordWrap, readOnly]);

  const languageLabel = (LANGUAGE_META[language] || {}).label || language;
  const themeClass = theme === "dark" ? "codedx-dark" : "codedx-light";

  return (
    <div className={`relative w-full h-full ${themeClass} ${className}`} style={{ background: theme === "dark" ? "#0d1117" : "#ffffff" }}>
      <div className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 py-1 text-xs font-mono border-b`} style={{ background: "var(--toolbar-bg, #151b24)", color: "var(--text-muted, #9aa199)", borderColor: "var(--border, #2e3a4e)" }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
          {languageLabel}
          {debugMode && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "rgba(245,158,11,0.18)", color: "#fbbf24" }}>Debug</span>}
        </span>
      </div>
      <div className="absolute inset-0 pt-7 pb-0">
        <div className="w-full h-full grid" style={{ gridTemplateColumns: split ? "1fr 1px 1fr" : "1fr" }}>
          <div className="h-full w-full">
            <Editor
              beforeMount={handleBeforeMount}
              onMount={handleEditorMount}
              theme={theme === "dark" ? "platform-dark" : "platform-light"}
              language={language}
              value={code}
              onChange={onChange}
              options={EDITOR_OPTIONS(wordWrap)}
              loading={<div className="p-6 text-xs" style={{ color: "var(--text-muted)" }}>Loading editor…</div>}
            />
          </div>
          {split && (
            <>
              <div className="border-l" style={{ borderColor: "var(--border, #2e3a4e)" }} />
              <div className="h-full w-full">
                <Editor
                  beforeMount={handleBeforeMount}
                  onMount={(secondary) => {
                    secondaryEditorRef.current = secondary;
                    secondary.setModel(editorRef.current ? editorRef.current.getModel() : null);
                    secondary.updateOptions({ ...EDITOR_OPTIONS(wordWrap, showMinimap), readOnly: true });
                  }}
                  theme={theme === "dark" ? "platform-dark" : "platform-light"}
                  language={language}
                  value={code}
                  options={{ ...EDITOR_OPTIONS(wordWrap, showMinimap), readOnly: true }}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        .codedx-dark .debug-current-line { background: rgba(255,255,255,0.06) !important; }
        .codedx-light .debug-current-line { background: rgba(37,99,235,0.10) !important; }
        .codedx-dark .breadcrumb { display: none !important; }
        .codedx-light .breadcrumb { display: none !important; }
      `}</style>
    </div>
  );
}

export default MonacoCodeEditor;
