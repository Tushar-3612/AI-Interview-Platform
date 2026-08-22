import { useState } from "react";
import { BookOpen, Code, Table, FileText, Upload, X } from "lucide-react";
import QuestionEditor from "../QuestionEditor";
import CodingProblemEditor from "../CodingProblemEditor";
import QuestionUploader from "../QuestionUploader";
import CodingUploader from "../CodingUploader";

const QUESTION_SOURCES = [
  { id: "manual", label: "Manual", icon: BookOpen },
  { id: "csv", label: "CSV Upload", icon: Table },
  { id: "word", label: "Word Upload", icon: FileText },
  { id: "pdf", label: "PDF Upload", icon: Upload },
];
const SUBJECTS = ["Java", "Python", "DBMS", "Operating System", "Computer Networks", "SQL", "React", "Node", "MongoDB", "OOP"];

function LiveSummary({ questions }) {
  const total = questions.length;
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);
  const easy = questions.filter(q => (q.difficulty || "").toLowerCase() === "easy").length;
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

  const [codingImportOpen, setCodingImportOpen] = useState(false);
  const [codingImportSource, setCodingImportSource] = useState(null);

  const CODING_IMPORT_SOURCES = [
    { id: "csv", label: "CSV Upload", icon: Table },
    { id: "word", label: "Word Upload", icon: FileText },
    { id: "pdf", label: "PDF Upload", icon: Upload },
  ];

  const mapCodingImport = (qs) =>
    qs.map((q) => ({
      type: "Coding",
      question: q.title || q.questionId || "",
      problemTitle: q.title || "",
      description: q.problemStatement || q.description || "",
      constraints: q.constraints || "",
      inputFormat: q.inputFormat || "",
      outputFormat: q.outputFormat || "",
      sampleInput: q.sampleInput || "",
      sampleOutput: q.sampleOutput || "",
      marks: Number(q.marks) || 10,
      difficulty: (q.difficulty || "medium").toString().toLowerCase(),
      languages: Array.isArray(q.supportedLanguages) && q.supportedLanguages.length ? q.supportedLanguages : ["Python"],
      testCases: (q.testCases || []).map((tc) => ({
        input: tc.input || "",
        output: tc.expected || "",
        isHidden: !!tc.isHidden,
      })),
      correctAnswer: "",
      explanation: "",
    }));

  const handleAddCodingImport = (validQuestions) => {
    const mapped = mapCodingImport(validQuestions);
    onChange({ ...form, questions: [...questions, ...mapped] });
    setCodingImportOpen(false);
    setCodingImportSource(null);
  };

  const closeCodingImport = () => {
    setCodingImportOpen(false);
    setCodingImportSource(null);
  };

  const nonCoding = questions.filter(q => q.type !== "Coding");
  const coding = questions.filter(q => q.type === "Coding");

  const updateNonCoding = (updated) => {
    onChange({ ...form, questions: [...updated, ...coding] });
  };

  const updateAllQuestions = (updated) => {
    onChange({ ...form, questions: updated });
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
              <button key={src.id} onClick={() => { setSource(src.id); update("questionSource", src.id); }}
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

      {/* File Upload (template-based) */}
      {source !== "manual" && (
        <div className="border admin-border admin-card rounded-xl p-5">
          <QuestionUploader
            source={source}
            onAdd={handleImportAdd}
            onCancel={() => setSource("manual")}
          />
        </div>
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
                <CodingProblemEditor questions={questions} onChange={updateAllQuestions} onImport={() => setCodingImportOpen(true)} />
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
                <CodingProblemEditor questions={questions} onChange={updateAllQuestions} onImport={() => setCodingImportOpen(true)} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Coding Import Modal */}
      {codingImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border admin-border admin-card rounded-2xl p-6"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {codingImportSource ? `Import Coding Problems · ${codingImportSource.toUpperCase()}` : "Import Coding Problems"}
              </h2>
              <button onClick={closeCodingImport} className="p-2 rounded-lg border admin-border cursor-pointer"
                style={{ color: "var(--text-secondary)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {!codingImportSource ? (
              <div>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Choose file format</p>
                <div className="grid grid-cols-3 gap-3">
                  {CODING_IMPORT_SOURCES.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button key={s.id} onClick={() => setCodingImportSource(s.id)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border admin-border cursor-pointer admin-hover transition"
                        style={{ color: "var(--text-primary)" }}>
                        <Icon className="w-6 h-6" style={{ color: "var(--primary)" }} />
                        <span className="text-xs font-semibold">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <CodingUploader source={codingImportSource} onAdd={handleAddCodingImport} onCancel={() => setCodingImportSource(null)} />
            )}
          </div>
        </div>
      )}

      {/* Live Summary */}
      <LiveSummary questions={questions} />
    </div>
  );
}
