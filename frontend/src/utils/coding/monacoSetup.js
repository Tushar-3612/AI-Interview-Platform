/**
 * Monaco setup: theme registration, language configuration, and lightweight
 * IntelliSense (completion + hover) providers for the platform languages.
 *
 * JavaScript / TypeScript use Monaco's built-in TypeScript language worker
 * (rich IntelliSense + real-time diagnostics) and therefore get NO custom
 * providers here. For every other language we register a lightweight
 * completion + hover provider backed by the metadata in languageConfig.
 */
import {
  LANGUAGE_META,
  LANGUAGE_SNIPPETS,
  LANGUAGE_HOVER,
  LANGUAGE_KEYWORDS,
  COMPLETION_KINDS,
} from "./languageConfig";

const SUPPORTED = Object.keys(LANGUAGE_META).filter((k) => k !== "javascript" && k !== "typescript");

const WORD_PATTERN = /(-?\d*\.\d|[_\p{L}\p{N}$@#]*:[<># ]*|-?\d*\.?\d(?:@[^;]+;)?|[#@]\w*|\b[a-zA-Z_$]\w*)/gu;
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function makeAutoClosingPairs(meta) {
  const pairs = [
    { open: "{", close: "}", notIn: ["string", "comment"] },
    { open: "[", close: "]", notIn: ["string", "comment"] },
    { open: "(", close: ")", notIn: ["string", "comment"] },
    { open: '"', close: '"', notIn: ["string", "comment"] },
    { open: "'", close: "'", notIn: ["string", "comment"] },
  ];
  if (meta.monacoId === "python" || meta.monacoId === "php") {
    pairs.push({ open: "`", close: "`", notIn: ["string", "comment"] });
  }
  return pairs;
}

export function registerMonacoThemes(monacoInstance) {
  if (!monacoInstance) return;

  monacoInstance.editor.defineTheme("platform-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "invalid", foreground: "f662d2", fontStyle: "underline" },
      { token: "comment", foreground: "6a9955" },
      { token: "commentDirective", foreground: "6a9955" },
      { token: "keyword", foreground: "569cd3" },
      { token: "keyword.control", foreground: "c586c1" },
      { token: "keyword.operator", foreground: "9cdcfe" },
      { token: "storage", foreground: "9cdcfe" },
      { token: "storage.type", foreground: "4ec9b0" },
      { token: "type", foreground: "4ec9b0" },
      { token: "type.class", foreground: "4ec9b0" },
      { token: "type.primitive", foreground: "4ec9b0" },
      { token: "class", foreground: "4ec9b0", fontStyle: "bold" },
      { token: "tag", foreground: "808080" },
      { token: "attribute", foreground: "9cdcfe" },
      { token: "import", foreground: "c586c1" },
      { token: "string", foreground: "ce9178" },
      { token: "string.interpolated", foreground: "d7ba7d" },
      { token: "string.regexp", foreground: "d7369d" },
      { token: "variable", foreground: "9cdcfe" },
      { token: "variable.other.read", foreground: "dcdcaa" },
      { token: "variable.other.write", foreground: "9cdcfe" },
      { token: "variable.parameter", foreground: "9cdcfe" },
      { token: "function", foreground: "dcdcaa" },
      { token: "method", foreground: "dcdcaa" },
      { token: "function.declaration", foreground: "dcdcaa" },
      { token: "number", foreground: "b5cea8" },
      { token: "constant", foreground: "4ec9b0" },
      { token: "constant.numeric", foreground: "b5cea8" },
      { token: "constant.language", foreground: "4ec9b0" },
      { token: "operator", foreground: "d4d4d4" },
      { token: "punctuation", foreground: "d4d4d4" },
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#c9d1d1",
      "editor.inactiveSelectionBackground": "#264f78",
      "editor.selectionBackground": "#264f78",
      "editor.selectionForeground": "#ffffff",
      "editor.lineHighlightBackground": "#151b24",
      "editor.lineHighlightBorder": "#23863633",
      "editorCaret.foreground": "#aeafad",
      "editorCursor.foreground": "#aeafad",
      "editorRuler.foreground": "#393939",
      "editorIndentGuide.activeBackground": "#404040",
      "editorIndentGuide.background": "#264f78",
      "editorWhitespace.foreground": "#1f2533",
      "editorFoldedTextBackground": "#151b24",
      "editorCodeLens.foreground": "#9cdcfe",
      "editorCodeLens.foreground2": "#9cdcfe",
      "editorBracketHighlight.color1": "#ffb86c",
      "editorBracketHighlight.color2": "#8be9fd",
      "editorBracketHighlight.color3": "#ff79c6",
      "editorBracketHighlight.color4": "#50fa7b",
      "editorBracketHighlight.color5": "#bd93f9",
      "editorBracketHighlight.color6": "#ff5554",
      "editorBracketHighlight.unexpectedBracketAerrorBackground": "#594d71",
      "editorBracketHighlight.unexpectedBracketBerrorBackground": "#594d71",
      "editorBracketHighlight.unexpectedBracketCerrorBackground": "#594d71",
      "editorBracketHighlight.unexpectedBracketDerrorBackground": "#594d71",
      "editorBracketHighlight.unexpectedBracketEerrorBackground": "#594d71",
      "editorBracketHighlight.unexpectedBracketFerrorBackground": "#594d71",
      "editorBracketHighlight.unexpectedBracketGerrorBackground": "#594d71",
      "editorBracketHighlight.unexpectedBracketHerrorBackground": "#594d71",
      "editor.wordHighlightBackground": "#274472",
      "editor.wordHighlightBorder": "#4a9dff",
      "editor.wordHighlightStrongBackground": "#454560",
      "editor.wordHighlightStrongBorder": "#4ec9b0",
      "editorHoverWidget.background": "#1f2733",
      "editorHoverWidget.border": "#457b9d",
      "editorHoverWidget.foreground": "#c9d1d1",
      "editorHoverWidget.statusBarBackground": "#253448",
      "editorSuggestWidget.background": "#1f2733",
      "editorSuggestWidget.border": "#457b9d",
      "editorSuggestWidget.foreground": "#c9d1d1",
      "editorSuggestWidget.selectedBackground": "#274472",
      "editorSuggestWidget.selectedBorder": "#4a9dff",
      "editorSuggestWidget.peerColor": "#67a3cc",
      "editorSuggestWidget.detailsBackground": "#1d2530",
      "editorSuggestWidget.detailsBorder": "#3b4a61",
      "editorSuggestWidget.highlightMatchedWords": "#569cd3",
      "editorWidget.background": "#1f2733",
      "editorWidget.border": "#457b9d",
      "editorWidget.foreground": "#c9d1d1",
      "panel.background": "#151b24",
      "panel.foreground": "#c9d1d1",
      "panel.border": "#457b9d",
      "panelTitle.activeForeground": "#ffffff",
      "panelTitle.inactiveForeground": "#9aa199",
      "editorOverviewRuler.currentContentForeground": "#4a9dff",
      "editorOverviewRuler.currentContentSeparator": "#4a9dff",
      "minimap.background": "#0d1117",
      "minimap.foreground": "#c9d1d1",
      "minimapGutter.meta": "#ffffff1f",
      "minimapGutter.comment": "#6a9955",
      "minimapSlider.background": "#4a9dff55",
      "minimapSlider.hoverBackground": "#4a9dff88",
      "minimapSlider.activeBackground": "#4a9dffaa",
      "scrollbar.shadow": "#090909",
      "scrollbarSlider.background": "#47474766",
      "scrollbarSlider.hoverBackground": "#63636388",
      "scrollbarSlider.activeBackground": "#888888cc",
      "list.hoverBackground": "#1a1f29",
      "list.activeSelectionBackground": "#274472",
      "list.inactiveSelectionBackground": "#1d2d3e",
      "list.focusBackground": "#1a1f29",
      "notification.background": "#1f2733",
      "notification.foreground": "#c9d1d1",
      "notification.errorBackground": "#1f2733",
      "notification.errorForeground": "#ef5555",
    },
  });

  monacoInstance.editor.defineTheme("platform-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "invalid", foreground: "f662d2", fontStyle: "underline" },
      { token: "comment", foreground: "6a9955" },
      { token: "keyword", foreground: "569cd3" },
      { token: "type", foreground: "267f99" },
      { token: "class", foreground: "267f99", fontStyle: "bold" },
      { token: "tag", foreground: "808080" },
      { token: "attribute", foreground: "9a8fce" },
      { token: "import", foreground: "c586c1" },
      { token: "string", foreground: "a31515" },
      { token: "variable", foreground: "006699" },
      { token: "function", foreground: "795e7b" },
      { token: "method", foreground: "795e7b" },
      { token: "number", foreground: "098658" },
      { token: "constant", foreground: "098658" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#000000",
      "editor.inactiveSelectionBackground": "#b8d7ff",
      "editor.selectionBackground": "#b8d7ff",
      "editor.lineHighlightBackground": "#dae8fc",
      "editor.lineHighlightBorder": "#b4d3ff",
      "editorCaret.foreground": "#000000",
      "editorCursor.foreground": "#000000",
      "editorRuler.foreground": "#e8e8e8",
      "editorIndentGuide.activeBackground": "#666666",
      "editorIndentGuide.background": "#e8e8e8",
      "editorWhitespace.foreground": "#d7d7d7",
      "editorBracketHighlight.color1": "#a341ff",
      "editorBracketHighlight.color2": "#0480dc",
      "editorBracketHighlight.color3": "#d69d00",
      "editor.wordHighlightBackground": "#a8c1ff",
      "editor.wordHighlightBorder": "#4a9dff",
      "editor.wordHighlightStrongBackground": "#92b8ff",
      "editor.wordHighlightStrongBorder": "#4a9dff",
      "editorHoverWidget.background": "#f3f4f6",
      "editorHoverWidget.border": "#d1d5db",
      "editorHoverWidget.foreground": "#111827",
      "editorSuggestWidget.background": "#f3f4f6",
      "editorSuggestWidget.border": "#d1d5db",
      "editorSuggestWidget.foreground": "#111827",
      "editorSuggestWidget.selectedBackground": "#d1e8ff",
      "editorSuggestWidget.peerColor": "#669",
      "editorWidget.background": "#f3f4f6",
      "editorWidget.border": "#d1d5db",
      "minimap.background": "#ffffff",
      "list.hoverBackground": "#f0f7ff",
    },
  });
}

export function configureMonacoLanguages(monacoInstance) {
  if (!monacoInstance || !monacoInstance.languages) return;

  for (const key of SUPPORTED) {
    const meta = LANGUAGE_META[key];
    const langId = meta.monacoId;

    // Language configuration: brackets, auto-closing, comments, folding, word pattern
    try {
      monacoInstance.languages.setLanguageConfiguration(langId, {
        comments: {
          lineComment: meta.commentLine,
          blockComment: [meta.commentBlock.start, meta.commentBlock.end],
        },
        brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
        autoClosingPairs: makeAutoClosingPairs(meta),
        surroundingPairs: [
          { open: "(", close: ")" },
          { open: "[", close: "]" },
          { open: "{", close: "}" },
          { open: '"', close: '"' },
          { open: "'", close: "'" },
        ],
        folding: {
          markers: {
            start: new RegExp(`${escapeRegExp(meta.commentLine || "//")}#region`),
            end: new RegExp(`${escapeRegExp(meta.commentLine || "//")}#endregion`),
          },
          offSide: langId === "python",
        },
        wordPattern: new RegExp(WORD_PATTERN.source, "gu"),
      });
    } catch (e) {
      /* already configured */
    }

    registerStdlibProviders(monacoInstance, langId, key);
  }
}

function registerStdlibProviders(monaco, langId, key) {
  const snippets = LANGUAGE_SNIPPETS[key] || [];
  const keywords = LANGUAGE_KEYWORDS[key] || [];
  const hoverMap = LANGUAGE_HOVER[key] || {};

  // Completion provider (snippets + keywords + stdlib items with hover)
  monaco.languages.registerCompletionItemProvider(langId, {
    provideCompletionItems(model, position) {
      const textUntil = model.getValueUntilEndOfLine(position.lineNumber);
      const before = textUntil.substr(0, position.column - 1);
      const block = /(^|\s)([\w.$#]*)$/.exec(before) || [];
      const word = block ? block[2] || "" : "";

      const suggestions = [];

      snippets
        .filter((s) => s.label.toLowerCase().includes(word.toLowerCase()))
        .forEach((s) => {
          suggestions.push({
            label: s.label,
            kind: 9 /* Snippet */,
            insertText: s.insertText,
            insertTextRules: 1 /* Snippet */,
            documentation: { value: s.documentation },
            sortText: "a0_" + s.label,
          });
        });

      keywords
        .filter((k) => k.toLowerCase().includes(word.toLowerCase()))
        .forEach((k) => {
          suggestions.push({
            label: k,
            kind: 14 /* Keyword */,
            insertText: k,
            sortText: "b_" + k,
          });
        });

      Object.keys(hoverMap)
        .filter((k) => k.toLowerCase().includes(word.toLowerCase()))
        .forEach((k) => {
          suggestions.push({
            label: k,
            kind: 2 /* Method/Function */,
            insertText: k,
            documentation: { value: hoverMap[k] },
            sortText: "c_" + k,
          });
        });

      return { suggestions };
    },
    triggerCharacters: [".", "#"],
  });

  // Signature help for common calls (e.g. print(, System.out.println(, printf()
  const signatures = {};
  const sigs = {
    python: { label: "print", params: ["*objects", "sep=' '", "end='\\n'"] },
    java: { label: "System.out.println", params: ["value"] },
    c: { label: "printf", params: ["format", "..."] },
    cpp: { label: "cout <<", params: [] },
    javascript: { label: "console.log", params: ["...data"] },
    csharp: { label: "Console.WriteLine", params: ["value"] },
    go: { label: "fmt.Println", params: ["...a"] },
    rust: { label: "println!", params: ["fmt, ...args"] },
    kotlin: { label: "println", params: ["message"] },
    php: { label: "echo", params: ["expr"] },
  };
  const sig = sigs[key];
  if (sig) {
    signatures[sig.label] = sig.params;
    monaco.languages.registerSignatureHelpProvider(langId, {
      provideSignatureHelp(model, position) {
        const line = model.getLineContent(position.lineNumber);
        const before = line.substring(0, position.column);
        const idx = before.lastIndexOf(sig.label + "(");
        if (idx === -1) return null;
        const args = before.slice(idx + sig.label.length + 1);
        let active = 0;
        let depth = 0;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "(") depth++;
          else if (args[i] === ")") depth--;
          else if (args[i] === "," && depth === 0) active++;
        }
        return {
          activeParameter: active,
          activeSignature: 0,
          signatures: [
            {
              label: sig.label,
              parameters: sig.params.map((p) => ({ label: p })),
            },
          ],
        };
      },
      signatureHelpTriggerCharacters: ["("],
      // keep the signature up to date while typing
      keepTriggerCharacters: false,
    });
  }

  // Hover provider
  monaco.languages.registerHoverProvider(langId, {
    provideHover(model, position) {
      const line = model.getLineContent(position.lineNumber);
      const before = line.substring(0, position.column);
      let found = null;
      for (const k of Object.keys(hoverMap)) {
        const re = new RegExp("\\b" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b$");
        if (re.test(before)) {
          found = hoverMap[k];
          break;
        }
      }
      if (!found) return null;
      return {
        range: new monaco.Range(
          position.lineNumber,
          Math.max(1, position.column - found.length),
          position.lineNumber,
          position.column
        ),
        contents: [{ value: "```" + langId + "\n" + found + "\n```" }],
      };
    },
  });
}

/**
 * Enables on-the-fly JavaScript/TypeScript diagnostics so the editor surfaces
 * "undefined variable", "wrong syntax", etc. exactly like VS Code's `checkJs`.
 * TypeScript / JavaScript language service workers (configured in monaco-init)
 * power IntelliSense and the diagnostics.
 */
export function configureJsLanguageService(monacoInstance) {
  if (!monacoInstance || !monacoInstance.languages || !monacoInstance.languages.typescript) return;

  // JavaScript configuration
  const jsDefaults = monacoInstance.languages.typescript.javascriptDefaults;
  jsDefaults.setCompilerOptions({
    target: 5 /* ES2015 */ + 6 /* ES2017 */,
    allowJs: true,
    checkJs: true,
    noEmit: true,
    module: 5 /* ES2015 */,
    moduleResolution: 2 /* Node */,
    esModuleInterop: true,
    strict: false,
    allowSyntheticDefaultImports: true,
  });
  jsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    checkJs: true,
    diagnosticVirtualClient: false,
    diagnosticSeverity: {
      1: 1, // Error
      2: 2, // Warning
    },
  });

  // TypeScript configuration
  const tsDefaults = monacoInstance.languages.typescript.typescriptDefaults;
  tsDefaults.setCompilerOptions({
    target: 99 /* ESNext */,
    allowJs: false,
    noEmit: true,
    module: 5 /* ES2015 */,
    moduleResolution: 2 /* Node */,
    esModuleInterop: true,
    strict: true,
    allowSyntheticDefaultImports: true,
    exactOptionalPropertyTypes: false,
    noImplicitAny: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
  });
  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticVirtualClient: false,
    diagnosticSeverity: {
      1: 1, // Error
      2: 2, // Warning
    },
  });
}

export const SUPPORT = SUPPORTED;
export default { registerMonacoThemes, configureMonacoLanguages, configureJsLanguageService };
