import React from "react";
import StartInterview from "./StartInterview";

/**
 * IndividualProjectPractice Component
 * Reuses the authoritative Real Interview Room UI/UX (StartInterview) in INDIVIDUAL_PROJECT mode.
 * Guarantees identical fullscreen room layout, controls, speech recognition, loading, and evaluation screens for 10 questions.
 */
export default function IndividualProjectPractice() {
  return <StartInterview isIndividualProject={true} />;
}
