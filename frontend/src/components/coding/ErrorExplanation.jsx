import React from "react";
import { AlertCircle, Lightbulb, Info } from "lucide-react";

/**
 * ErrorExplanation — renders the {what / why / solution} breakdown for a
 * compiler or runtime error (see errorExplanations.explainError).
 *
 * Props:
 *  explanation: { severity, what, why, solution }
 *  compact:    boolean — smaller layout when embedded in a list
 */
function ErrorExplanation({ explanation, compact = false }) {
  if (!explanation) return null;
  const { what, why, solution, severity = "error" } = explanation;
  const Icon = severity === "warning" ? Info : AlertCircle;
  const iconColor = severity === "warning" ? "#eab308" : "#ef4444";

  if (compact) {
    return (
      <div className="mt-2 text-xs">
        <div className="flex items-start gap-1.5">
          <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: iconColor }} />
          <div className="space-y-0.5">
            <div className="font-semibold flex items-center gap-1" style={{ color: iconColor }}>{what}</div>
            <div style={{ color: "var(--text-secondary)" }}>{why}</div>
            <div className="flex items-start gap-1" style={{ color: "var(--text-muted)" }}>
              <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{solution}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-3 text-xs"
      style={{
        background: severity === "warning" ? "rgba(234,179,8,0.08)" : "rgba(239,68,68,0.08)",
        borderColor: severity === "warning" ? "rgba(234,179,8,0.25)" : "rgba(239,68,68,0.25)",
      }}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: iconColor }} />
        <div className="space-y-1 flex-1">
          <div className="font-semibold flex items-center gap-1.5" style={{ color: iconColor }}>
            {what}
          </div>
          <div style={{ color: "var(--text-secondary)" }}>{why}</div>
          <div className="flex items-start gap-1.5" style={{ color: "var(--text-muted)" }}>
            <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#eab308" }} />
            <span>{solution}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ErrorExplanation;
