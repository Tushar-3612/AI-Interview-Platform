import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const CODING_LANGUAGES = ["Java", "Python", "C++", "JavaScript", "C", "Go", "Rust"];

const emptyProblem = () => ({
  type: "Coding",
  question: "",
  problemTitle: "",
  description: "",
  constraints: "",
  inputFormat: "",
  outputFormat: "",
  sampleInput: "",
  sampleOutput: "",
  marks: 10,
  difficulty: "medium",
  languages: ["Python"],
  testCases: [],
  correctAnswer: "",
  explanation: "",
});

const emptyTestCase = () => ({
  input: "",
  output: "",
  isHidden: false,
});

export default function CodingProblemEditor({ questions, onChange }) {
  const [expanded, setExpanded] = useState(null);
  const codingQuestions = questions.filter(q => q.type === "Coding");
  const nonCoding = questions.filter(q => q.type !== "Coding");

  const addNew = () => {
    const p = emptyProblem();
    onChange([...questions, p]);
    setExpanded(questions.length);
  };

  const update = (idx, field, value) => {
    const updated = questions.map((q, i) => i === idx ? { ...q, [field]: value } : q);
    onChange(updated);
  };

  const remove = (idx) => {
    if (expanded === idx) setExpanded(null);
    onChange(questions.filter((_, i) => i !== idx));
  };

  const addTestCase = (idx, hidden) => {
    const tc = { ...emptyTestCase(), isHidden: hidden };
    update(idx, "testCases", [...(questions[idx].testCases || []), tc]);
  };

  const updateTestCase = (qIdx, tcIdx, field, value) => {
    const tcs = [...(questions[qIdx].testCases || [])];
    tcs[tcIdx] = { ...tcs[tcIdx], [field]: value };
    update(qIdx, "testCases", tcs);
  };

  const removeTestCase = (qIdx, tcIdx) => {
    const tcs = questions[qIdx].testCases.filter((_, i) => i !== tcIdx);
    update(qIdx, "testCases", tcs);
  };

  const toggleLanguage = (idx, lang) => {
    const langs = questions[idx].languages || [];
    const updated = langs.includes(lang) ? langs.filter(l => l !== lang) : [...langs, lang];
    update(idx, "languages", updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {codingQuestions.length} coding problem{codingQuestions.length !== 1 ? "s" : ""}
        </span>
        <button onClick={addNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg cursor-pointer"
          style={{ background: "var(--primary)" }}>
          <Plus className="w-3.5 h-3.5" /> Add Problem
        </button>
      </div>

      {codingQuestions.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No coding problems yet.</p>
        </div>
      )}

      {questions.map((q, idx) => {
        if (q.type !== "Coding") return null;
        const isOpen = expanded === idx;
        return (
          <div key={idx} className="border admin-border admin-card rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : idx)}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded admin-bg-surface shrink-0">P{idx + 1}</span>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded border shrink-0"
                  style={{ borderColor: "var(--badge-success-text)", color: "var(--badge-success-text)" }}>Coding</span>
                <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                  {q.problemTitle || q.question || "New problem"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button onClick={e => { e.stopPropagation(); remove(idx); }}
                  className="p-1.5 admin-error-hover rounded-lg cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--badge-error-text)" }} />
                </button>
                {isOpen ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
              </div>
            </div>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t admin-table-divider pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Problem Title *</label>
                    <input value={q.problemTitle} onChange={e => update(idx, "problemTitle", e.target.value)}
                      className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      style={{ color: "var(--text-primary)" }} placeholder="e.g. Two Sum" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Marks</label>
                      <input type="number" min="0" value={q.marks} onChange={e => update(idx, "marks", parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        style={{ color: "var(--text-primary)" }} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Difficulty</label>
                      <select value={q.difficulty} onChange={e => update(idx, "difficulty", e.target.value)}
                        className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer"
                        style={{ color: "var(--text-primary)" }}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description *</label>
                  <textarea value={q.description} onChange={e => update(idx, "description", e.target.value)}
                    className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none min-h-[80px]"
                    style={{ color: "var(--text-primary)" }} placeholder="Detailed problem description" />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Constraints</label>
                  <input value={q.constraints} onChange={e => update(idx, "constraints", e.target.value)}
                    className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    style={{ color: "var(--text-primary)" }} placeholder="e.g. 1 <= n <= 10^5" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Input Format</label>
                    <textarea value={q.inputFormat} onChange={e => update(idx, "inputFormat", e.target.value)}
                      className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none min-h-[50px]"
                      style={{ color: "var(--text-primary)" }} placeholder="Describe the input format" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Output Format</label>
                    <textarea value={q.outputFormat} onChange={e => update(idx, "outputFormat", e.target.value)}
                      className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none min-h-[50px]"
                      style={{ color: "var(--text-primary)" }} placeholder="Describe the output format" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Sample Input</label>
                    <textarea value={q.sampleInput} onChange={e => update(idx, "sampleInput", e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none min-h-[60px]"
                      style={{ color: "var(--text-primary)" }} placeholder="Sample input" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Sample Output</label>
                    <textarea value={q.sampleOutput} onChange={e => update(idx, "sampleOutput", e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none min-h-[60px]"
                      style={{ color: "var(--text-primary)" }} placeholder="Expected output" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Supported Languages</label>
                  <div className="flex flex-wrap gap-2">
                    {CODING_LANGUAGES.map(lang => (
                      <button key={lang} onClick={() => toggleLanguage(idx, lang)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full border cursor-pointer transition-all ${
                          (q.languages || []).includes(lang)
                            ? "text-white border-[var(--primary)]"
                            : "border admin-border"
                        }`}
                        style={{ background: (q.languages || []).includes(lang) ? "var(--primary)" : "transparent" }}
                      >{lang}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Test Cases</label>
                    <div className="flex gap-2">
                      <button onClick={() => addTestCase(idx, false)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg border admin-border admin-hover cursor-pointer">
                        <Plus className="w-3 h-3" /> Visible
                      </button>
                      <button onClick={() => addTestCase(idx, true)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg border admin-border admin-hover cursor-pointer">
                        <Plus className="w-3 h-3" /> Hidden
                      </button>
                    </div>
                  </div>
                  {(q.testCases || []).length === 0 && (
                    <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No test cases. Add visible and hidden test cases.</p>
                  )}
                  <div className="space-y-2">
                    {(q.testCases || []).map((tc, tci) => (
                      <div key={tci} className="flex items-start gap-2 p-2 rounded-lg admin-bg-surface">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input value={tc.input} onChange={e => updateTestCase(idx, tci, "input", e.target.value)}
                            className="w-full px-2 py-1.5 text-xs font-mono border admin-border rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                            style={{ color: "var(--text-primary)" }} placeholder="Input" />
                          <input value={tc.output} onChange={e => updateTestCase(idx, tci, "output", e.target.value)}
                            className="w-full px-2 py-1.5 text-xs font-mono border admin-border rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                            style={{ color: "var(--text-primary)" }} placeholder="Expected output" />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {tc.isHidden && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--badge-warning-bg)", color: "var(--badge-warning-text)" }}>Hidden</span>
                          )}
                          <button onClick={() => removeTestCase(idx, tci)} className="p-1 cursor-pointer">
                            <Trash2 className="w-3 h-3" style={{ color: "var(--badge-error-text)" }} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
