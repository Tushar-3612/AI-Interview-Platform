import CompanyMockAttempt from "../../../models/CompanyMockAttempt.js";
import QuestionExposure from "../../../models/QuestionExposure.js";
import { shuffleArray } from "../../questionBank.js";

/**
 * Standard difficulty levels and default marks.
 * Easy   = 2 marks
 * Medium = 3 marks
 * Hard   = 5 marks
 */
export const DIFFICULTY_LEVELS = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const DIFFICULTY_MARKS = {
  Easy: 2,
  Medium: 3,
  Hard: 5,
};

/**
 * Target difficulty distributions by performance tier.
 */
export const TARGET_DISTRIBUTIONS = {
  NO_HISTORY: { Easy: 0.50, Medium: 0.40, Hard: 0.10 },
  VERY_WEAK:  { Easy: 0.80, Medium: 0.20, Hard: 0.00 },
  WEAK:       { Easy: 0.70, Medium: 0.30, Hard: 0.00 },
  AVERAGE:    { Easy: 0.40, Medium: 0.50, Hard: 0.10 },
  GOOD:       { Easy: 0.20, Medium: 0.50, Hard: 0.30 },
  EXCELLENT:  { Easy: 0.10, Medium: 0.40, Hard: 0.50 },
};

/**
 * Normalize question difficulty string or infer from marks if metadata is absent.
 * Does NOT infer difficulty from marks if the question already has a valid difficulty field.
 *
 * @param {object} q - Question object
 * @returns {"Easy" | "Medium" | "Hard"}
 */
export function getQuestionDifficulty(q) {
  if (!q) return DIFFICULTY_LEVELS.MEDIUM;

  const rawDiff = String(q.difficulty || "").trim().toLowerCase();
  if (rawDiff === "easy") return DIFFICULTY_LEVELS.EASY;
  if (rawDiff === "medium" || rawDiff === "intermediate") return DIFFICULTY_LEVELS.MEDIUM;
  if (rawDiff === "hard" || rawDiff === "advanced") return DIFFICULTY_LEVELS.HARD;

  // Fallback to marks only if difficulty is not explicitly set
  const marks = Number(q.marks);
  if (marks <= 2) return DIFFICULTY_LEVELS.EASY;
  if (marks >= 5) return DIFFICULTY_LEVELS.HARD;
  return DIFFICULTY_LEVELS.MEDIUM;
}

/**
 * Classify accuracy into a performance tier.
 *
 * @param {number|null} accuracy - Recent accuracy [0.0 - 1.0] or null if no history
 * @returns {"NO_HISTORY" | "VERY_WEAK" | "WEAK" | "AVERAGE" | "GOOD" | "EXCELLENT"}
 */
export function getPerformanceTier(accuracy) {
  if (accuracy === null || accuracy === undefined || isNaN(accuracy)) {
    return "NO_HISTORY";
  }
  if (accuracy < 0.40) return "VERY_WEAK";
  if (accuracy < 0.60) return "WEAK";
  if (accuracy < 0.75) return "AVERAGE";
  if (accuracy < 0.90) return "GOOD";
  return "EXCELLENT";
}

/**
 * Get target distribution for a given tier or accuracy.
 *
 * @param {string|number|null} tierOrAccuracy
 * @returns {{ Easy: number, Medium: number, Hard: number }}
 */
export function getTargetDistribution(tierOrAccuracy) {
  const tier = typeof tierOrAccuracy === "string"
    ? tierOrAccuracy
    : getPerformanceTier(tierOrAccuracy);
  return TARGET_DISTRIBUTIONS[tier] || TARGET_DISTRIBUTIONS.NO_HISTORY;
}

/**
 * Calculate exact integer question counts for each difficulty bucket summing to totalCount.
 *
 * @param {number} totalCount - Total questions required (e.g. 15)
 * @param {{ Easy: number, Medium: number, Hard: number }} distribution
 * @returns {{ Easy: number, Medium: number, Hard: number }}
 */
export function calculateTargetCounts(totalCount = 15, distribution = TARGET_DISTRIBUTIONS.NO_HISTORY) {
  const dist = distribution || TARGET_DISTRIBUTIONS.NO_HISTORY;
  const rawEasy = totalCount * (dist.Easy || 0);
  const rawMedium = totalCount * (dist.Medium || 0);
  const rawHard = totalCount * (dist.Hard || 0);

  let easy = Math.floor(rawEasy);
  let medium = Math.floor(rawMedium);
  let hard = Math.floor(rawHard);

  let remainder = totalCount - (easy + medium + hard);

  if (remainder > 0) {
    // If student has strong/excellent distribution, prioritize Hard > Medium > Easy on ties
    const isHardLeaning = (dist.Hard || 0) >= 0.30;
    const fracs = [
      { key: "Hard", frac: rawHard - hard, weight: dist.Hard || 0, priority: isHardLeaning ? 3 : 1 },
      { key: "Medium", frac: rawMedium - medium, weight: dist.Medium || 0, priority: 2 },
      { key: "Easy", frac: rawEasy - easy, weight: dist.Easy || 0, priority: isHardLeaning ? 1 : 3 },
    ].sort((a, b) => b.frac - a.frac || b.priority - a.priority || b.weight - a.weight);

    for (let i = 0; i < remainder; i++) {
      const pick = fracs[i % fracs.length].key;
      if (pick === "Easy") easy++;
      else if (pick === "Medium") medium++;
      else if (pick === "Hard") hard++;
    }
  }

  return { Easy: Math.max(0, easy), Medium: Math.max(0, medium), Hard: Math.max(0, hard) };
}

/**
 * Calculate recent performance from student's historical Company Mock attempts.
 * Uses a rolling window of up to windowSize (default 5) most recent answered technical questions.
 *
 * For MCQ: correct = 1.0, incorrect = 0.0
 * For Free-text: aiScore / aiMaxMarks
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} companyId
 * @param {object} [opts]
 * @param {number} [opts.windowSize=5]
 * @param {any} [opts.attemptModel=CompanyMockAttempt]
 * @returns {Promise<{ accuracy: number|null, tier: string, sampleSize: number, distribution: object }>}
 */
export async function getRecentPerformance(userId, companyId, opts = {}) {
  const windowSize = opts.windowSize || 5;
  const Model = opts.attemptModel || CompanyMockAttempt;

  if (!userId || !companyId) {
    return {
      accuracy: null,
      tier: "NO_HISTORY",
      sampleSize: 0,
      distribution: TARGET_DISTRIBUTIONS.NO_HISTORY,
    };
  }

  try {
    // Query recent attempts for this student and company (newest first)
    const attempts = await Model.find({
      userId,
      companyId: String(companyId).trim().toLowerCase(),
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (!attempts || attempts.length === 0) {
      return {
        accuracy: null,
        tier: "NO_HISTORY",
        sampleSize: 0,
        distribution: TARGET_DISTRIBUTIONS.NO_HISTORY,
      };
    }

    const scores = [];

    // Extract answered technical questions from newest attempt to older attempts
    for (const attempt of attempts) {
      if (scores.length >= windowSize) break;
      const techAnswers = Array.isArray(attempt.technicalAnswers) ? attempt.technicalAnswers : [];

      // Iterate answers in reverse (newest question answered first)
      for (let i = techAnswers.length - 1; i >= 0; i--) {
        if (scores.length >= windowSize) break;
        const ans = techAnswers[i];
        if (!ans) continue;

        // Free-text with AI score
        if (typeof ans.aiScore === "number" && ans.aiMaxMarks && ans.aiMaxMarks > 0) {
          const ratio = Math.max(0, Math.min(1, ans.aiScore / ans.aiMaxMarks));
          scores.push(ratio);
        } else if (typeof ans.isCorrect === "boolean") {
          // MCQ or graded boolean
          scores.push(ans.isCorrect ? 1.0 : 0.0);
        } else if (ans.answer || ans.selectedOption) {
          // Has answer but isCorrect is not boolean (e.g. pending or fallback)
          scores.push(ans.isCorrect ? 1.0 : 0.0);
        }
      }
    }

    if (scores.length === 0) {
      return {
        accuracy: null,
        tier: "NO_HISTORY",
        sampleSize: 0,
        distribution: TARGET_DISTRIBUTIONS.NO_HISTORY,
      };
    }

    const accuracy = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const tier = getPerformanceTier(accuracy);
    const distribution = getTargetDistribution(tier);

    return {
      accuracy,
      tier,
      sampleSize: scores.length,
      distribution,
    };
  } catch (error) {
    console.warn(`[Adaptive] Failed to compute recent performance for user ${userId}:`, error.message);
    return {
      accuracy: null,
      tier: "NO_HISTORY",
      sampleSize: 0,
      distribution: TARGET_DISTRIBUTIONS.NO_HISTORY,
    };
  }
}

/**
 * Select questions adaptively from an unused question pool based on target difficulty counts.
 * Falls back to the closest available difficulty when a bucket is exhausted, strictly
 * respecting the no-repeat rule.
 *
 * @param {Array<object>} unusedPool - Questions not yet exposed in the current cycle
 * @param {{ Easy: number, Medium: number, Hard: number }} targetCounts
 * @returns {Array<object>} Selected questions
 */
export function selectAdaptiveQuestions(unusedPool = [], targetCounts = { Easy: 8, Medium: 6, Hard: 1 }) {
  if (!unusedPool || unusedPool.length === 0) return [];

  // Partition unused questions into difficulty buckets
  const buckets = {
    Easy: [],
    Medium: [],
    Hard: [],
  };

  for (const q of unusedPool) {
    const diff = getQuestionDifficulty(q);
    buckets[diff].push(q);
  }

  // Shuffle each bucket to maintain randomness
  buckets.Easy = shuffleArray(buckets.Easy);
  buckets.Medium = shuffleArray(buckets.Medium);
  buckets.Hard = shuffleArray(buckets.Hard);

  const selected = [];
  const pickedIds = new Set();

  const takeFromBucket = (bucketName, count) => {
    const list = buckets[bucketName];
    let taken = 0;
    while (list.length > 0 && taken < count) {
      const q = list.pop();
      const id = String(q._id || q.questionId || q.id);
      if (!pickedIds.has(id)) {
        pickedIds.add(id);
        selected.push(q);
        taken++;
      }
    }
    return taken;
  };

  // 1. Primary pass: take up to target count from each respective bucket
  const easyTaken = takeFromBucket("Easy", targetCounts.Easy || 0);
  const mediumTaken = takeFromBucket("Medium", targetCounts.Medium || 0);
  const hardTaken = takeFromBucket("Hard", targetCounts.Hard || 0);

  let neededEasy = (targetCounts.Easy || 0) - easyTaken;
  let neededMedium = (targetCounts.Medium || 0) - mediumTaken;
  let neededHard = (targetCounts.Hard || 0) - hardTaken;

  // 2. Fallback pass for Easy: closest is Medium, then Hard
  if (neededEasy > 0) {
    const fromMed = takeFromBucket("Medium", neededEasy);
    neededEasy -= fromMed;
  }
  if (neededEasy > 0) {
    const fromHard = takeFromBucket("Hard", neededEasy);
    neededEasy -= fromHard;
  }

  // 3. Fallback pass for Hard: closest is Medium, then Easy
  if (neededHard > 0) {
    const fromMed = takeFromBucket("Medium", neededHard);
    neededHard -= fromMed;
  }
  if (neededHard > 0) {
    const fromEasy = takeFromBucket("Easy", neededHard);
    neededHard -= fromEasy;
  }

  // 4. Fallback pass for Medium: closest is Easy, then Hard
  if (neededMedium > 0) {
    const fromEasy = takeFromBucket("Easy", neededMedium);
    neededMedium -= fromEasy;
  }
  if (neededMedium > 0) {
    const fromHard = takeFromBucket("Hard", neededMedium);
    neededMedium -= fromHard;
  }

  // 5. Final safety pass: if total still short and any unused questions remain
  const totalTarget = (targetCounts.Easy || 0) + (targetCounts.Medium || 0) + (targetCounts.Hard || 0);
  if (selected.length < totalTarget && selected.length < unusedPool.length) {
    const remaining = [...buckets.Easy, ...buckets.Medium, ...buckets.Hard];
    for (const q of shuffleArray(remaining)) {
      if (selected.length >= totalTarget) break;
      const id = String(q._id || q.questionId || q.id);
      if (!pickedIds.has(id)) {
        pickedIds.add(id);
        selected.push(q);
      }
    }
  }

  return selected;
}

/**
 * Arrange selected questions into a smooth difficulty sequence to avoid jarring jumps (e.g. Easy -> Hard -> Easy).
 * Questions within each difficulty bucket remain randomly ordered.
 *
 * @param {Array<object>} selectedQuestions
 * @param {string} [tier="AVERAGE"]
 * @returns {Array<object>} Smoothly ordered questions
 */
export function smoothDifficultyOrder(selectedQuestions = [], tier = "AVERAGE") {
  if (!selectedQuestions || selectedQuestions.length <= 1) return selectedQuestions;

  const easyList = [];
  const medList = [];
  const hardList = [];

  for (const q of selectedQuestions) {
    const diff = getQuestionDifficulty(q);
    if (diff === DIFFICULTY_LEVELS.EASY) easyList.push(q);
    else if (diff === DIFFICULTY_LEVELS.HARD) hardList.push(q);
    else medList.push(q);
  }

  // If student is high performing (EXCELLENT), they can progress from Medium -> Hard or Easy -> Medium -> Hard
  // For standard/beginner progression: Easy -> Medium -> Hard
  // All transitions are neighbor-adjacent (Easy <-> Medium <-> Hard).
  return [...easyList, ...medList, ...hardList];
}

/**
 * High-level question selection function with exposure tracking, adaptive distribution,
 * and automatic cycle reset on full pool exhaustion.
 *
 * @param {Array<object>} pool - Complete company technical question bank
 * @param {Set<string>} seenIds - Set of exposed question IDs
 * @param {number} count - Number of questions required (default 15)
 * @param {string} companyId - Company ID
 * @param {string|mongoose.Types.ObjectId} studentId - Student ID
 * @param {object} distribution - Target distribution
 * @param {string} tier - Performance tier
 * @returns {Promise<{ questions: Array<object>, resetType: string|null }>}
 */
export async function pickAdaptiveTechnicalWithCycleReset(
  pool,
  seenIds,
  count = 15,
  companyId,
  studentId,
  distribution = TARGET_DISTRIBUTIONS.NO_HISTORY,
  tier = "NO_HISTORY"
) {
  const used = new Set(seenIds || []);
  let unusedPool = pool.filter((q) => {
    const id = String(q._id || q.questionId || q.id);
    return id && !used.has(id);
  });

  const targetCounts = calculateTargetCounts(count, distribution);

  // If pool is exhausted and we don't have enough unused questions,
  // reset exposure for this student+company+technical and re-pick from full pool.
  if (unusedPool.length < count && pool.length >= count) {
    if (studentId && companyId) {
      try {
        await QuestionExposure.deleteMany({
          studentId,
          companyId: String(companyId).trim().toLowerCase(),
          questionType: "technical",
        });
      } catch (err) {
        // Ignore cast errors for mock non-ObjectId IDs during unit tests
      }
    }

    const freshPool = [...pool];
    const picked = selectAdaptiveQuestions(freshPool, targetCounts);
    const ordered = smoothDifficultyOrder(picked, tier);
    return { questions: ordered, resetType: "technical" };
  }

  const picked = selectAdaptiveQuestions(unusedPool, targetCounts);
  const ordered = smoothDifficultyOrder(picked, tier);
  return { questions: ordered, resetType: null };
}
