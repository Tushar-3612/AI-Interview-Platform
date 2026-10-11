/**
 * Unified NPTEL Assignment Question Bank - Introduction to Research
 * Contains the complete 120 questions in a single assessment test (Q1 to Q120).
 * Complete with options, accepted answers, point weights, and explanatory notes.
 */

import { NPTEL_WEEKS } from "./nptelWeeksSource.js";

// Flatten all weeks into a single 120-question test
export const ALL_NPTEL_QUESTIONS = NPTEL_WEEKS.flatMap((w) =>
  w.questions.map((q, idx) => ({
    ...q,
    globalIndex: (w.weekNumber - 1) * 10 + (idx + 1),
    questionNumber: (w.weekNumber - 1) * 10 + (idx + 1),
    weekNumber: w.weekNumber,
    sectionTitle: w.title,
    sectionBadge: w.badge,
  }))
);

export const NPTEL_TEST_META = {
  id: "nptel-unified-test",
  title: "NPTEL Assignment - Complete Assessment",
  courseTitle: "Introduction to Research",
  totalQuestions: ALL_NPTEL_QUESTIONS.length, // 120
  totalMarks: ALL_NPTEL_QUESTIONS.length, // 120
  passingPercentage: 40,
  durationMinutes: 120, // 2 hours for full exam
  themeColor: "#FF6B35",
};

export { NPTEL_WEEKS };
