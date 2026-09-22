import React from "react";
import Results from "../../pages/student/Results";

export default function CompletionScreen({ interviewId, initialResultData, onReturnDashboard }) {
  return <Results sessionId={interviewId} initialResultData={initialResultData} />;
}

