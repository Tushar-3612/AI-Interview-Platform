export default function SectionWiseReport({ sections }) {
  if (!sections?.length) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
        No section data available
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--border)" }}>
            <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Section</th>
            <th className="text-center py-2.5 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Questions</th>
            <th className="text-center py-2.5 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Correct</th>
            <th className="text-center py-2.5 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Wrong</th>
            <th className="text-center py-2.5 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Skipped</th>
            <th className="text-center py-2.5 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Marks</th>
            <th className="text-center py-2.5 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((sec, i) => (
            <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
              <td className="py-2.5 px-3 font-medium capitalize" style={{ color: "var(--text-primary)" }}>
                {sec.section}
              </td>
              <td className="text-center py-2.5 px-3" style={{ color: "var(--text-secondary)" }}>
                {sec.totalQuestions ?? 0}
              </td>
              <td className="text-center py-2.5 px-3" style={{ color: "var(--success, #16a34a)" }}>
                {sec.correct ?? 0}
              </td>
              <td className="text-center py-2.5 px-3" style={{ color: "var(--error, #dc2626)" }}>
                {sec.wrong ?? 0}
              </td>
              <td className="text-center py-2.5 px-3" style={{ color: "var(--text-muted)" }}>
                {sec.skipped ?? 0}
              </td>
              <td className="text-center py-2.5 px-3 font-medium" style={{ color: "var(--text-primary)" }}>
                {sec.obtainedMarks ?? 0}/{sec.totalMarks ?? 0}
              </td>
              <td className="text-center py-2.5 px-3">
                <span
                  className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: (sec.percentage || 0) >= 60
                      ? "color-mix(in srgb, var(--success, #16a34a) 15%, transparent)"
                      : "color-mix(in srgb, var(--error, #dc2626) 15%, transparent)",
                    color: (sec.percentage || 0) >= 60 ? "var(--success, #16a34a)" : "var(--error, #dc2626)",
                  }}
                >
                  {sec.percentage ?? 0}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
