import { NPTEL_WEEKS } from "./nptelWeeksRaw.js";

export const NPTEL_THEME = {
  primary: "#FF6B35",
  secondary: "#FF8A3D",
  dark: "#E85924",
  gradient: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
  bgSubtle: "rgba(255, 107, 53, 0.08)",
  bgMuted: "rgba(255, 107, 53, 0.14)",
  border: "rgba(255, 107, 53, 0.35)",
  borderStrong: "rgba(255, 107, 53, 0.6)",
  glow: "0 10px 25px -5px rgba(255, 107, 53, 0.35)",
};

export const NPTEL_TEST_META = {
  id: "nptel-unified-test",
  title: "NPTEL Assignment",
  moduleName: "NPTEL Assignment Practice Test",
  courseTitle: "Introduction to Research",
  institution: "NPTEL / IIT Madras",
  totalQuestions: 120,
  totalMarks: 120,
  durationMinutes: 120,
  passingPercentage: 40,
  themeColor: NPTEL_THEME.primary,
};

// Flatten all questions into a single sequential list of 120 questions
export const ALL_NPTEL_QUESTIONS = NPTEL_WEEKS.flatMap((w) =>
  w.questions.map((q, idx) => ({
    ...q,
    globalIndex: (w.weekNumber - 1) * 10 + (idx + 1),
    questionNumber: (w.weekNumber - 1) * 10 + (idx + 1),
    sectionTitle: w.title,
    sectionBadge: w.badge,
    weekNumber: w.weekNumber,
  }))
);

/**
 * Evaluates an answer for a question
 */
export function evaluateAnswer(question, userSelection) {
  const selected = Array.isArray(userSelection)
    ? userSelection.map((s) => String(s).trim()).filter(Boolean)
    : userSelection
    ? [String(userSelection).trim()]
    : [];

  const correct = (question.correctAnswers || []).map((s) => String(s).trim());

  if (selected.length === 0) {
    return {
      pointsEarned: 0,
      isCorrect: false,
      isPartiallyCorrect: false,
      status: "unanswered",
      maxPoints: question.points || 1,
    };
  }

  const correctSet = new Set(correct);
  const hasWrongOption = selected.some((opt) => !correctSet.has(opt));

  if (hasWrongOption) {
    return {
      pointsEarned: 0,
      isCorrect: false,
      isPartiallyCorrect: false,
      status: "incorrect",
      maxPoints: question.points || 1,
    };
  }

  if (selected.length === correct.length) {
    return {
      pointsEarned: question.points || 1,
      isCorrect: true,
      isPartiallyCorrect: false,
      status: "correct",
      maxPoints: question.points || 1,
    };
  }

  const partialPoints = Number(
    ((selected.length / correct.length) * (question.points || 1)).toFixed(2)
  );
  return {
    pointsEarned: partialPoints,
    isCorrect: false,
    isPartiallyCorrect: true,
    status: "partially_correct",
    maxPoints: question.points || 1,
  };
}

const STORAGE_KEY_UNIFIED_PROGRESS = "prephire_nptel_unified_test_progress";
const STORAGE_KEY_UNIFIED_DRAFT = "prephire_nptel_unified_draft_answers";
const STORAGE_KEY_BOOKMARKS = "prephire_nptel_bookmarks";

export function getLocalTestProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UNIFIED_PROGRESS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalTestAttempt(attemptData) {
  try {
    const existing = getLocalTestProgress();
    const bestScore = existing
      ? Math.max(existing.bestScore || 0, attemptData.score)
      : attemptData.score;

    const payload = {
      bestScore,
      lastScore: attemptData.score,
      maxScore: attemptData.maxScore,
      percentage: Number(((bestScore / attemptData.maxScore) * 100).toFixed(1)),
      lastAttemptDate: new Date().toISOString(),
      attemptsCount: (existing?.attemptsCount || 0) + 1,
      lastAnswers: attemptData.answers,
    };
    localStorage.setItem(STORAGE_KEY_UNIFIED_PROGRESS, JSON.stringify(payload));
    return payload;
  } catch (err) {
    console.warn("Failed to save local test attempt:", err);
    return null;
  }
}

export function getLocalDraftAnswers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UNIFIED_DRAFT);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalDraftAnswers(answers) {
  try {
    localStorage.setItem(STORAGE_KEY_UNIFIED_DRAFT, JSON.stringify(answers));
  } catch {
    // noop
  }
}

export function clearLocalDraftAnswers() {
  try {
    localStorage.removeItem(STORAGE_KEY_UNIFIED_DRAFT);
  } catch {
    // noop
  }
}

export function getLocalBookmarks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function toggleLocalBookmark(questionId) {
  try {
    const bookmarks = getLocalBookmarks();
    if (bookmarks.has(questionId)) {
      bookmarks.delete(questionId);
    } else {
      bookmarks.add(questionId);
    }
    localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(Array.from(bookmarks)));
    return bookmarks;
  } catch {
    return new Set();
  }
}
