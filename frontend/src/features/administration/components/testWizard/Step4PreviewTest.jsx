import { FileText, BookOpen, Code, ClipboardCheck, Users, Brain } from "lucide-react";

export default function Step4PreviewTest({ form, questions }) {
  const nonCoding = questions.filter(q => q.type !== "Coding");
  const coding = questions.filter(q => q.type === "Coding");

  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);
  const requiredMarks = Math.ceil(totalMarks * (form.passingMarks || 0) / 100);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="border admin-border admin-card rounded-xl p-5">
        <h3 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>Test Preview</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-4">
          <div className="p-3 rounded-lg admin-bg-surface text-center">
            <p className="text-lg font-bold" style={{ color: "var(--primary)" }}>{questions.length}</p>
            <p style={{ color: "var(--text-muted)" }}>Total Questions</p>
          </div>
          <div className="p-3 rounded-lg admin-bg-surface text-center">
            <p className="text-lg font-bold" style={{ color: "var(--primary)" }}>{totalMarks}</p>
            <p style={{ color: "var(--text-muted)" }}>Total Marks</p>
          </div>
          <div className="p-3 rounded-lg admin-bg-surface text-center">
            <p className="text-lg font-bold" style={{ color: "var(--primary)" }}>{form.duration}</p>
            <p style={{ color: "var(--text-muted)" }}>Duration (min)</p>
          </div>
          <div className="p-3 rounded-lg admin-bg-surface text-center">
            <p className="text-lg font-bold" style={{ color: "var(--primary)" }}>{requiredMarks} / {totalMarks}</p>
            <p style={{ color: "var(--text-muted)" }}>Passing ({form.passingMarks}%)</p>
          </div>
        </div>

        <div className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            <span className="font-semibold">Title:</span> {form.title}
          </div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span className="font-semibold">Type:</span> {form.testType}
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            <span className="font-semibold">Difficulty:</span> {form.difficulty}
          </div>
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5" />
            <span className="font-semibold">Evaluation:</span> AI (Gemini)
          </div>
          {form.description && (
            <div className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 mt-0.5" />
              <span><span className="font-semibold">Description:</span> {form.description}</span>
            </div>
          )}
        </div>
      </div>

      {nonCoding.length > 0 && (
        <div className="border admin-border admin-card rounded-xl p-5">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <BookOpen className="w-4 h-4" style={{ color: "var(--primary)" }} />
            Questions ({nonCoding.length})
          </h4>
          <div className="space-y-2">
            {nonCoding.map((q, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg admin-bg-surface">
                <span className="text-xs font-semibold px-2 py-0.5 rounded admin-border shrink-0">Q{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{q.question}</p>
                  {q.options?.length > 0 && q.options.some(o => o) && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {q.options.map((opt, oi) => opt && (
                        <span key={oi} className="text-[11px] px-2 py-0.5 rounded admin-border" style={{ color: "var(--text-muted)" }}>
                          {String.fromCharCode(65 + oi)}. {opt}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span>Type: {q.type}</span>
                    <span>Marks: {q.marks}</span>
                    {q.subject && <span>Subject: {q.subject}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {coding.length > 0 && (
        <div className="border admin-border admin-card rounded-xl p-5">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Code className="w-4 h-4" style={{ color: "var(--badge-success-text)" }} />
            Coding Problems ({coding.length})
          </h4>
          <div className="space-y-2">
            {coding.map((q, idx) => (
              <div key={idx} className="p-3 rounded-lg admin-bg-surface">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded admin-border shrink-0">P{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{q.problemTitle || q.question}</p>
                    <div className="flex gap-3 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      <span>Marks: {q.marks}</span>
                      <span>Languages: {(q.languages || []).join(", ") || "None selected"}</span>
                      <span>Test Cases: {(q.testCases || []).length}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
