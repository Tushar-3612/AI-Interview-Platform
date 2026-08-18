import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, History, Award, BrainCircuit, Code2 } from "lucide-react";

function ResultSection({ result, company, onBackToDashboard, onViewHistory }) {
  if (!result) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center py-12">
          <p style={{ color: "var(--text-muted)" }}>No result data available.</p>
        </div>
      </div>
    );
  }

  const { scores, feedback, security } = result;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Mock Interview Completed!
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {company?.name || "Company"} — Mock Interview Result
          </p>
        </div>

        {/* Overall Score */}
        <div className="student-card p-6 text-center mb-6">
          <div className="relative w-32 h-32 mx-auto mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                strokeWidth="8"
                stroke="var(--border)"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                strokeWidth="8"
                stroke={scores?.overall >= 70 ? "var(--success)" : scores?.overall >= 50 ? "var(--warning)" : "var(--error)"}
                fill="transparent"
                strokeDasharray="352"
                strokeDashoffset={352 - (352 * (scores?.overall || 0)) / 100}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                {scores?.overall || 0}%
              </span>
              <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Overall Score
              </span>
            </div>
          </div>
        </div>

        {/* Section Scores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Aptitude */}
          <div className="student-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Aptitude</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {scores?.aptitude?.correct || 0}/{scores?.aptitude?.total || 0} correct
                </p>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Correct</span>
                <span className="font-semibold text-green-500">{scores?.aptitude?.correct || 0}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Wrong</span>
                <span className="font-semibold text-red-500">{scores?.aptitude?.wrong || 0}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Skipped</span>
                <span className="font-semibold" style={{ color: "var(--text-muted)" }}>{scores?.aptitude?.skipped || 0}</span>
              </div>
              <div className="flex justify-between border-t pt-1" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Score</span>
                <span className="font-bold">{scores?.aptitude?.percentage || 0}%</span>
              </div>
            </div>
          </div>

          {/* Technical */}
          <div className="student-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Technical</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {scores?.technical?.correct || 0}/{scores?.technical?.total || 0} correct
                </p>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Correct</span>
                <span className="font-semibold text-green-500">{scores?.technical?.correct || 0}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Wrong</span>
                <span className="font-semibold text-red-500">{scores?.technical?.wrong || 0}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Skipped</span>
                <span className="font-semibold" style={{ color: "var(--text-muted)" }}>{scores?.technical?.skipped || 0}</span>
              </div>
              <div className="flex justify-between border-t pt-1" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Score</span>
                <span className="font-bold">{scores?.technical?.percentage || 0}%</span>
              </div>
            </div>
          </div>

          {/* Coding */}
          <div className="student-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Coding</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {scores?.coding?.accepted || 0}/{scores?.coding?.total || 0} accepted
                </p>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Attempted</span>
                <span className="font-semibold">{scores?.coding?.attempted || 0}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Accepted</span>
                <span className="font-semibold text-green-500">{scores?.coding?.accepted || 0}</span>
              </div>
              <div className="flex justify-between border-t pt-1" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Marks</span>
                <span className="font-bold">{scores?.coding?.marksObtained || 0}/{scores?.coding?.totalMarks || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="student-card p-6 mb-6">
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
              Performance Summary
            </h3>
            <div className="space-y-3">
              {feedback.strongAreas?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-500 mb-1">Strong Areas:</p>
                  <ul className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                    {feedback.strongAreas.map((area, idx) => (
                      <li key={idx}>• {area}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.weakAreas?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-500 mb-1">Areas to Improve:</p>
                  <ul className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                    {feedback.weakAreas.map((area, idx) => (
                      <li key={idx}>• {area}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.recommendation && (
                <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {feedback.recommendation}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security Summary */}
        {security && (
          <div className="student-card p-6 mb-6">
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
              Security Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Tab Switches</span>
                <span className="font-semibold">{security.tabSwitchCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Fullscreen Exits</span>
                <span className="font-semibold">{security.fullscreenExitCount || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onViewHistory}
            className="flex-1 py-3 rounded-xl border font-semibold cursor-pointer flex items-center justify-center gap-2"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <History className="w-4 h-4" /> View History
          </button>
          <button
            onClick={onBackToDashboard}
            className="flex-1 py-3 rounded-xl font-bold text-white cursor-pointer flex items-center justify-center gap-2"
            style={{ background: "var(--primary)" }}
          >
            Back to Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default ResultSection;
