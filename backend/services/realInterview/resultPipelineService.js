import { calculateRealInterviewResult, getRealInterviewResult } from "./realInterviewResultService.js";

/**
 * Pipeline entrypoint wrapper delegating directly to realInterviewResultService.js.
 */
export async function executeRealInterviewResultPipeline({ sessionId, userId, candidateProfile = null }) {
  return await calculateRealInterviewResult({ sessionId, userId, candidateProfile });
}

export { calculateRealInterviewResult, getRealInterviewResult };
