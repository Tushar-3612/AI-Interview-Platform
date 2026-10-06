import React from "react";
import SecureCanvasQuestionRenderer from "./SecureCanvasQuestionRenderer.jsx";

/**
 * PrepHire MCQ / Objective Question View
 * Transparently delegates to SecureCanvasQuestionRenderer for zero-DOM-text protection.
 */
export default function MCQQuestionView(props) {
  return <SecureCanvasQuestionRenderer {...props} />;
}
