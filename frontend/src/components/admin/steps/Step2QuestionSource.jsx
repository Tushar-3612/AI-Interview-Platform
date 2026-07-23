import { useState } from "react";
import { BookOpen, Code, Table, FileText, Upload, Shuffle, Check, AlertCircle, X, Plus } from "lucide-react";
import QuestionEditor from "../QuestionEditor";
import CodingProblemEditor from "../CodingProblemEditor";
import FileUploader from "../FileUploader";

const QUESTION_SOURCES = [
  { id: "manual", label: "Manual", icon: BookOpen },
  { id: "csv", label: "CSV Upload", icon: Table },
  { id: "excel", label: "Excel Upload", icon: FileText },
  { id: "pdf", label: "PDF Upload", icon: Upload },
];
const SUBJECTS = ["Java", "Python", "DBMS", "Operating System", "Computer Networks", "SQL", "React", "Node", "MongoDB", "OOP"];
const DIFFICULTIES = ["easy", "medium", "hard"];

const selCls = "w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select";
const inputCls = "w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";

function ImportPreview({ parsed, onAdd, onCancel }) {
  const [count, setCount] = useState(parsed.length);
  const [random, setRandom] = useState(false);
  const [selected, setSelected] = useState(parsed.map((_, i) => i));

  const handleToggle = (idx) => {
    setSelected(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleSelectAll = () => {
    if (selected.length === parsed.length) {
      setSelected([]);
    } else {
      setSelected(parsed.map((_, i) => i));
    }
  };

  const handleUpdatePreview = (idx, field, value) => {
    parsed[idx] = { ...parsed[idx], [field]: value };
  };

  const handleAdd = () => {
    let toAdd = selected.map(i => parsed[i]);
    if (toAdd.length > count) {
      if (random) {
        toAdd = toAdd.sort(() => Math.random() - 0.5).slice(0, count);
      } else {
        toAdd = toAdd.slice(0, count);
      }
    }
    onAdd(toAdd);
  };

  return (
    <div className="border admin-border admin-card rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FileText className="w-4 h-4" /> Import Preview
        </h4>
        <button onClick={onCancel} className="p-1 rounded-lg admin-hover cursor-pointer">
          <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <label style={{ color: "var(--text-secondary)" }}>Import</label>
          <input type="number" min="1" max={parsed.length} value={count}
            onChange={e => setCount(Math.min(parseInt(e.target.value) || 1, parsed.length))}
            className="w-16 px-2 py-1.5 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-center"
            style={{ color: "var(--text-primary)" }} />
          <span style={{ color: "var(--text-muted)" }}>of {parsed.length} questions</span>
        </div>
        <button onClick={() => setRandom(!random)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border cursor-pointer ${
            random ? "border-[var(--primary)]" : "admin-border"
          }`}
          style={{
            background: random ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
            color: random ? "var(--primary)" : "var(--text-secondary)",
          }}>
          <Shuffle className="w-3 h-3" /> Random
        </button>
        <button onClick={handleSelectAll}
          className="px-2.5 py-1.5 rounded-lg border admin-border admin-hover cursor-pointer"
          style={{ color: "var(--text-secondary)" }}>
          {selected.length === parsed.length ? "Deselect All" : `Select All (${selected.length})`}
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
        {parsed.map((q, idx) => (
          <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg border ${
            selected.includes(idx) ? "border-[var(--primary)]" : "admin-border"
          }`}
            style={{
              background: selected.includes(idx) ? "color-mix(in srgb, var(--primary) 4%, transparent)" : "transparent",
            }}>
            <input type="checkbox" checked={selected.includes(idx)} onChange={() => handleToggle(idx)}
              className="mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {q.question || q.problemTitle || "Question " + (idx + 1)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>Marks</label>
                  <input type="number" min="0" value={q.marks || 1}
                    onChange={e => handleUpdatePreview(idx, "marks", parseInt(e.target.value) || 1)}
                    className="w-12 px-1 py-0.5 text-[11px] border admin-border rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-center"
                    style={{ color: "var(--text-primary)" }} onClick={e => e.stopPropagation()} />
                </div>
                <select value={q.difficulty || "medium"}
                  onChange={e => handleUpdatePreview(idx, "difficulty", e.target.value)}
                  className="text-[10px] px-1.5 py-0.5 border admin-border rounded bg-transparent focus:outline-none appearance-none cursor-pointer"
                  style={{ color: "var(--text-primary)" }} onClick={e => e.stopPropagation()}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
                {q.type && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--badge-info-bg)", color: "var(--badge-info-text)" }}>
                    {q.type}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleAdd}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg cursor-pointer"
        style={{ background: "var(--primary)" }}>
        <Check className="w-3.5 h-3.5" /> Add {Math.min(selected.length, count)} Question{Math.min(selected.length, count) !== 1 ? "s" : ""}
      </button>
    </div>
  );
}

function LiveSummary({ questions }) {
  const total = questions.length;
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);
  const easy = questions.filter(q => (q.difficulty || "").toLowerCase() === "easy").length;
  const medium = questions.filter(q => (q.difficulty || "").toLowerCase() === "medium").length;
  const hard = questions.filter(q => (q.difficulty || "").toLowerCase() === "hard").length;

  if (total === 0) return null;

  return (
    <div className="border admin-border admin-card rounded-xl p-4">
      <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Live Summary</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 rounded-lg admin-bg-surface text-center">
          <p className="text-base font-bold" style={{ color: "var(--primary)" }}>{total}</p>
          <p style={{ color: "var(--text-muted)" }}>Total Questions</p>
        </div>
        <div className="p-2.5 rounded-lg admin-bg-surface text-center">
          <p className="text-base font-bold" style={{ color: "var(--primary)" }}>{totalMarks}</p>
          <p style={{ color: "var(--text-muted)" }}>Total Marks</p>
        </div>
        <div className="p-2.5 rounded-lg admin-bg-surface text-center">
          <p className="text-base font-bold" style={{ color: "var(--badge-success-text)" }}>{easy}</p>
          <p style={{ color: "var(--text-muted)" }}>Easy</p>
        </div>
        <div className="p-2.5 rounded-lg admin-bg-surface text-center">
          <p className="text-base font-bold" style={{ color: "var(--badge-warning-text)" }}>{hard}</p>
          <p style={{ color: "var(--text-muted)" }}>Hard</p>
        </div>
      </div>
    </div>
  );
}

export default function Step2QuestionSource({ form, onChange }) {
  const update = (key, value) => onChange({ ...form, [key]: value });
  const questions = form.questions || [];
  const [source, setSource] = useState("manual");
  const [pendingImports, setPendingImports] = useState(null);

  const nonCoding = questions.filter(q => q.type !== "Coding");
  const coding = questions.filter(q => q.type === "Coding");

  const updateNonCoding = (updated) => {
    onChange({ ...form, questions: [...updated, ...coding] });
  };

  const updateAllQuestions = (updated) => {
    onChange({ ...form, questions: updated });
  };

  const handleFileParsed = (parsedQuestions) => {
    const enriched = parsedQuestions.map(q => ({
      ...q,
      marks: q.marks || 1,
      difficulty: q.difficulty || "medium",
    }));
    setPendingImports(enriched);
  };

  const handleImportAdd = (toAdd) => {
    const existing = questions;
    const all = [...existing, ...toAdd];
    const seen = new Set();
    const deduped = all.filter(q => {
      const key = q.question?.toLowerCase().trim() || q.problemTitle?.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    onChange({ ...form, questions: deduped, questionSource: source });
    setPendingImports(null);
  };

  const toggleSubject = (s) => {
    const subs = form.subjects || [];
    const updated = subs.includes(s) ? subs.filter(x => x !== s) : [...subs, s];
    update("subjects", updated);
  };

  return (
    <div className="space-y-5">
      {/* Source Selector */}
      <div className="border admin-border admin-card rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Question Source</h3>
        <div className="flex flex-wrap gap-2">
          {QUESTION_SOURCES.map(src => {
            const Icon = src.icon;
            return (
              <button key={src.id} onClick={() => { setSource(src.id); setPendingImports(null); update("questionSource", src.id); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-all ${
                  source === src.id ? "border-[var(--primary)]" : "admin-border"
                }`}
                style={{
                  background: source === src.id ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--card-bg)",
                  color: source === src.id ? "var(--primary)" : "var(--text-secondary)",
                }}>
                <Icon className="w-3.5 h-3.5" /> {src.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* File Upload */}
      {source !== "manual" && (
        <div className="border admin-border admin-card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Upload {source.toUpperCase()} File
          </h3>
          <FileUploader onQuestionsParsed={handleFileParsed} />
        </div>
      )}

      {/* Import Preview */}
      {pendingImports && pendingImports.length > 0 && (
        <ImportPreview
          parsed={pendingImports}
          onAdd={handleImportAdd}
          onCancel={() => setPendingImports(null)}
        />
      )}

      {/* Manual Builders */}
      {(source === "manual" || questions.length > 0) && (
        <>
          {form.testType === "aptitude" && (
            <div className="border admin-border admin-card rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <BookOpen className="w-4 h-4" style={{ color: "var(--primary)" }} /> MCQ Builder
              </h3>
              <QuestionEditor questions={nonCoding} onChange={updateNonCoding} />
            </div>
          )}

          {form.testType === "technical" && (
            <>
              <div className="border admin-border admin-card rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Select Subjects</h3>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map(s => (
                    <button key={s} onClick={() => toggleSubject(s)}
                      className="px-2.5 py-1 text-xs font-medium rounded-full border cursor-pointer transition-all"
                      style={{
                        background: (form.subjects || []).includes(s) ? "var(--primary)" : "transparent",
                        color: (form.subjects || []).includes(s) ? "#fff" : "var(--text-secondary)",
                        borderColor: (form.subjects || []).includes(s) ? "var(--primary)" : "var(--border)",
                      }}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="border admin-border admin-card rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <BookOpen className="w-4 h-4" style={{ color: "var(--primary)" }} /> Technical Questions
                </h3>
                <QuestionEditor questions={nonCoding} onChange={updateNonCoding} subjects={form.subjects || []} />
              </div>
            </>
          )}

          {form.testType === "coding" && (
            <div className="border admin-border admin-card rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Code className="w-4 h-4" style={{ color: "var(--badge-success-text)" }} /> Coding Problems
              </h3>
              <CodingProblemEditor questions={questions} onChange={updateAllQuestions} />
            </div>
          )}

          {form.testType === "mixed" && (
            <div className="space-y-5">
              <div className="border admin-border admin-card rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <BookOpen className="w-4 h-4" style={{ color: "var(--primary)" }} /> Aptitude / Technical Questions
                </h3>
                <QuestionEditor questions={nonCoding} onChange={updateNonCoding} />
              </div>

              <div className="border admin-border admin-card rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Code className="w-4 h-4" style={{ color: "var(--badge-success-text)" }} /> Coding Problems
                </h3>
                <CodingProblemEditor questions={questions} onChange={updateAllQuestions} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Live Summary */}
      <LiveSummary questions={questions} />
    </div>
  );
}
