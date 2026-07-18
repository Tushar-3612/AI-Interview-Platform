import { useState, useEffect } from "react";
import { Play, RotateCcw, Copy, Check, Terminal, Code2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * CodeEditorPlaceholder Component
 * A dark-themed interactive mock code editor with language selection, line numbers, and a simulated runner console.
 */
function CodeEditorPlaceholder({ questionData, onCodeChange }) {
  const defaultTemplates = questionData?.codeQuestion?.templates || {};
  const languages = Object.keys(defaultTemplates);

  const [selectedLang, setSelectedLang] = useState(languages[0] || "javascript");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState("");

  // Sync templates on question or language change
  useEffect(() => {
    if (defaultTemplates[selectedLang]) {
      setCode(defaultTemplates[selectedLang]);
    } else {
      setCode("// No code starter template available for this language");
    }
    setConsoleOutput("");
  }, [selectedLang, questionData]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  const handleReset = () => {
    if (defaultTemplates[selectedLang]) {
      setCode(defaultTemplates[selectedLang]);
      toast.success("Template reset completed");
    }
    setConsoleOutput("");
  };

  const handleRunCode = () => {
    setIsRunning(true);
    setConsoleOutput("Compiling and executing test cases...\n");

    setTimeout(() => {
      setIsRunning(false);
      setConsoleOutput(
        (prev) =>
          prev +
          `[INFO] Target: ${selectedLang.toUpperCase()}\n` +
          `[SUCCESS] Test Case 1: Input s = "babad" | Expected: "bab" or "aba" | Received: "${selectedLang === "python" ? "bab" : "bab"}"\n` +
          `[SUCCESS] Test Case 2: Input s = "cbbd" | Expected: "bb" | Received: "bb"\n\n` +
          `>> Compilation successful. All test cases passed (2/2).\n` +
          `>> Execution time: 42ms | Memory peak: 14.8 MB`
      );
      toast.success("All test cases passed successfully!");
    }, 1500);
  };

  // Generate line numbers side column
  const lineCount = code.split("\n").length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 12) }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full rounded-[16px] overflow-hidden border shadow-lg bg-zinc-950 border-zinc-800 text-zinc-300">
      {/* Editor top control header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 gap-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
          </div>
          <span className="text-xs font-semibold uppercase text-zinc-400 tracking-widest flex items-center gap-1.5 ml-3">
            <Code2 className="w-3.5 h-3.5 text-zinc-400" />
            Interactive Editor
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Language selection dropdown */}
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-xs outline-none bg-zinc-800 border-zinc-700 text-zinc-200 cursor-pointer"
            style={{ backgroundImage: "none", paddingRight: "12px" }} // Remove standard arrow overrides
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </option>
            ))}
          </select>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 transition-all text-zinc-400 hover:text-white cursor-pointer"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 transition-all text-zinc-400 hover:text-white cursor-pointer"
            title="Reset to Template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Run Code Button */}
          <button
            type="button"
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all cursor-pointer shadow-sm shadow-emerald-900/20"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      {/* Editor Body Split Panel */}
      <div className="flex-1 flex overflow-hidden min-h-[220px]">
        {/* Line Numbers Column */}
        <div className="w-12 bg-zinc-950 border-r border-zinc-900 select-none py-3 text-right pr-3 text-zinc-600 font-mono text-xs leading-6">
          {lineNumbers.map((num) => (
            <div key={num}>{num}</div>
          ))}
        </div>

        {/* Text Area Code Input */}
        <textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            onCodeChange?.(e.target.value);
          }}
          spellCheck={false}
          className="flex-1 bg-zinc-950/50 p-3 font-mono text-xs sm:text-sm leading-6 text-zinc-100 outline-none resize-none overflow-y-auto whitespace-pre tab-size"
          style={{ tabSize: 2 }}
        />
      </div>

      {/* Console output display panel */}
      <div className="bg-zinc-900 border-t border-zinc-800 p-4 font-mono text-xs">
        <div className="flex items-center gap-1.5 text-zinc-400 font-semibold mb-2 uppercase tracking-wider text-[10px]">
          <Terminal className="w-3.5 h-3.5" />
          Console Output
        </div>
        
        <div className="h-20 overflow-y-auto rounded-lg bg-zinc-950 p-2.5 text-zinc-400 border border-zinc-850 whitespace-pre-wrap select-all">
          {consoleOutput || "Click 'Run' to compile and execute the code against hidden test cases."}
        </div>
      </div>
    </div>
  );
}

export default CodeEditorPlaceholder;
