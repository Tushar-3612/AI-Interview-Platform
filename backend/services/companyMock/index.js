/**
 * Company Mock services — barrel export.
 *
 * Import from here for clean access:
 *   import { evaluateSingleAnswer, ... } from "../services/companyMock/index.js";
 */

export { evaluateSingleAnswer, evaluateTechnicalAnswers } from "./technical/technicalEvaluation.js";
export { evaluateTcsSingleAnswer } from "./technical/tcsTechnicalEvaluator.js";
export { evaluateAccentureSingleAnswer } from "./technical/accentureTechnicalEvaluator.js";
export { evaluateBenchmarkSingleAnswer } from "./technical/benchmarkTechnicalEvaluator.js";
export { evaluateShared2SingleAnswer } from "./technical/shared2TechnicalEvaluator.js";
export { isMockAIConfigured } from "../ai/mockAiClient.js";
export { isTcsAIConfigured } from "./ai/tcsAiClient.js";
export { isAccentureAIConfigured } from "./ai/accentureAiClient.js";
export { isBenchmarkAIConfigured } from "./ai/benchmarkAiClient.js";
export { isShared2AIConfigured } from "./ai/shared2AiClient.js";
export { loadTechnicalReferences, getQuestionReference } from "./technical/technicalReference.js";
export { computeFallbackScore } from "./technical/technicalFallback.js";
export {
  DIFFICULTY_LEVELS,
  DIFFICULTY_MARKS,
  TARGET_DISTRIBUTIONS,
  getQuestionDifficulty,
  getPerformanceTier,
  getTargetDistribution,
  calculateTargetCounts,
  getRecentPerformance,
  selectAdaptiveQuestions,
  smoothDifficultyOrder,
  pickAdaptiveTechnicalWithCycleReset,
} from "./adaptive/adaptiveDifficulty.js";

