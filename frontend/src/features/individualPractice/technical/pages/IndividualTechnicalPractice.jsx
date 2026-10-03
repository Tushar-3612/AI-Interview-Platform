import React from "react";
import StartInterview from "../../../realInterview/pages/StartInterview.jsx";

/**
 * IndividualTechnicalPractice Component
 * Reuses the authoritative Real Interview Room UI/UX (StartInterview) in INDIVIDUAL_TECHNICAL mode.
 * Guarantees identical fullscreen room layout, controls, speech recognition, loading, and evaluation screens.
 */
export default function IndividualTechnicalPractice() {
  return <StartInterview isIndividualTechnical={true} />;
}
