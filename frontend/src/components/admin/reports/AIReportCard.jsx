import { motion } from "framer-motion";

function ReadinessBar({ label, score }) {
  const pct = score ?? 0;
  const color = pct >= 75 ? "var(--success, #16a34a)" : pct >= 50 ? "#f59e0b" : "var(--error, #dc2626)";
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function AIReportCard({ aiEvaluation }) {
  if (!aiEvaluation) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Placement Readiness */}
      {aiEvaluation.interviewReadiness && (
        <div
          className="p-5 rounded-2xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <h4 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Placement Readiness
          </h4>
          <ReadinessBar label="Technical Readiness" score={aiEvaluation.interviewReadiness.technicalReadiness} />
          <ReadinessBar label="Coding Readiness" score={aiEvaluation.interviewReadiness.codingReadiness} />
          <ReadinessBar label="Communication Readiness" score={aiEvaluation.interviewReadiness.communicationReadiness} />
          <ReadinessBar label="Overall Placement Readiness" score={aiEvaluation.interviewReadiness.overallPlacementReadiness} />
        </div>
      )}

      {/* Company Recommendations */}
      {aiEvaluation.companyMatch?.recommendations?.length > 0 && (
        <div
          className="p-5 rounded-2xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Company Recommendations
          </h4>
          <div className="space-y-2">
            {aiEvaluation.companyMatch.recommendations.map((rec, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: "var(--admin-bg-surface, #f8fafc)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{rec.company}</span>
                <span
                  className="text-sm font-bold px-2 py-0.5 rounded-lg"
                  style={{
                    color: (rec.matchPercentage || 0) >= 70 ? "var(--success, #16a34a)" : (rec.matchPercentage || 0) >= 40 ? "#f59e0b" : "var(--error, #dc2626)",
                    background: (rec.matchPercentage || 0) >= 70
                      ? "color-mix(in srgb, var(--success, #16a34a) 15%, transparent)"
                      : (rec.matchPercentage || 0) >= 40
                        ? "color-mix(in srgb, #f59e0b 15%, transparent)"
                        : "color-mix(in srgb, var(--error, #dc2626) 15%, transparent)",
                  }}
                >
                  {rec.matchPercentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resume Match */}
      {aiEvaluation.resumeMatch && (
        <div
          className="p-5 rounded-2xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Resume Match
          </h4>
          {aiEvaluation.resumeMatch.resumeAccuracy != null && (
            <div className="mb-3">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Resume Accuracy: </span>
              <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                {aiEvaluation.resumeMatch.resumeAccuracy}%
              </span>
            </div>
          )}
          {aiEvaluation.resumeMatch.skillGap?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--error, #dc2626)" }}>Skill Gaps:</p>
              <div className="flex flex-wrap gap-1.5">
                {aiEvaluation.resumeMatch.skillGap.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-lg text-xs" style={{ background: "color-mix(in srgb, var(--error, #dc2626) 10%, transparent)", color: "var(--error, #dc2626)" }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {aiEvaluation.resumeMatch.suggestions?.length > 0 && (
            <ul className="space-y-1 mt-2">
              {aiEvaluation.resumeMatch.suggestions.map((s, i) => (
                <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>- {s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {aiEvaluation.aptitude && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiEvaluation.aptitude.strengths?.length > 0 && (
            <div className="p-4 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--success, #16a34a)" }}>Strengths</h4>
              <ul className="space-y-1">
                {aiEvaluation.aptitude.strengths.map((s, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>+ {s}</li>
                ))}
              </ul>
            </div>
          )}
          {aiEvaluation.aptitude.weaknesses?.length > 0 && (
            <div className="p-4 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--error, #dc2626)" }}>Weak Areas</h4>
              <ul className="space-y-1">
                {aiEvaluation.aptitude.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>- {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* AI Feedback */}
      {aiEvaluation.feedback && (
        <div
          className="p-5 rounded-2xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            AI Feedback & Recommendations
          </h4>
          {aiEvaluation.feedback.positivePoints?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--success, #16a34a)" }}>Positive Points:</p>
              <ul className="space-y-1">
                {aiEvaluation.feedback.positivePoints.map((p, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>+ {p}</li>
                ))}
              </ul>
            </div>
          )}
          {aiEvaluation.feedback.weakAreas?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--error, #dc2626)" }}>Areas to Improve:</p>
              <ul className="space-y-1">
                {aiEvaluation.feedback.weakAreas.map((w, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>- {w}</li>
                ))}
              </ul>
            </div>
          )}
          {aiEvaluation.feedback.recommendedSubjects?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-primary)" }}>Recommended Subjects:</p>
              <div className="flex flex-wrap gap-1.5">
                {aiEvaluation.feedback.recommendedSubjects.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-lg text-xs font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {aiEvaluation.feedback.practiceStrategy && (
            <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
              <span className="font-medium">Strategy:</span> {aiEvaluation.feedback.practiceStrategy}
            </p>
          )}
          {aiEvaluation.feedback.nextLearningPath && (
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              <span className="font-medium">Next Steps:</span> {aiEvaluation.feedback.nextLearningPath}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
