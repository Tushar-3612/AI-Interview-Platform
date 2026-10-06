export function scoreMCQ(question, studentAnswer) {
  if (!studentAnswer || studentAnswer.trim() === "") return 0;
  const isCorrect =
    studentAnswer.trim().toLowerCase() === (question.correctAnswer || "").trim().toLowerCase();
  return isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
}

export function determineAnswerStatus(question, answerEntry) {
  const { status, answer, code } = answerEntry;

  if (status === "not_visited") return "not_visited";
  if (status === "skipped") return "skipped";

  if (question.type === "Coding") {
    const hasCode = (code && code.trim()) || (answer && answer.trim());
    if (!hasCode) return "skipped";
    if (answerEntry.totalCount !== undefined && answerEntry.totalCount > 0) {
      return answerEntry.passedCount === answerEntry.totalCount ? "correct" : "wrong";
    }
    return "pending_evaluation";
  }

  if (question.type === "Descriptive") {
    return answer && answer.trim() ? "pending_evaluation" : "skipped";
  }

  if (status === "answered" || status === "marked") {
    if (!answer || answer.trim() === "") return "skipped";
    const isCorrect =
      answer.trim().toLowerCase() === (question.correctAnswer || "").trim().toLowerCase();
    return isCorrect ? "correct" : "wrong";
  }

  return "skipped";
}

export function computeObtainedMarks(question, answerStatus, answerEntry) {
  if (question.type === "Coding") {
    if (answerEntry.scoredMarks !== undefined) {
      return Number(answerEntry.scoredMarks) || 0;
    }
    return 0;
  }
  if (answerStatus === "correct") return question.marks || 1;
  if (answerStatus === "wrong") return -(question.negativeMarks || 0);
  if (answerEntry.scoredMarks !== undefined && answerEntry.scoredMarks !== 0) {
    return answerEntry.scoredMarks;
  }
  if (answerStatus === "pending_evaluation") {
    return answerEntry.scoredMarks || 0;
  }
  return 0;
}

export function normalizeDifficulty(d) {
  if (!d) return "medium";
  const lower = String(d).trim().toLowerCase();
  if (["easy", "medium", "hard"].includes(lower)) return lower;
  return "medium";
}

export function normalizeQuestionType(t, hasCodingMarkers = false) {
  if (hasCodingMarkers) return "Coding";
  if (!t) return "MCQ";
  const raw = String(t).trim().toLowerCase();
  if (raw === "coding") return "Coding";
  if (raw === "technical") return "Technical";
  if (raw === "aptitude") return "Aptitude";
  if (raw === "descriptive") return "Descriptive";
  if (raw === "true/false" || raw === "true_false") return "True/False";
  return "MCQ";
}

export function buildQuestionResult(question, answerEntry, attemptStart, attemptEnd, options = {}) {
  const { questionIndex, answer, code, language, status } = answerEntry;
  const isCoding = question.type === "Coding" || question.problemTitle || (question.testCases && question.testCases.length > 0);
  const answerStatus = determineAnswerStatus(question, answerEntry);
  const obtainedMarks = computeObtainedMarks(question, answerStatus, answerEntry);
  const timeTaken = 0;

  const result = {
    questionIndex,
    questionId: question._id ? question._id.toString() : "",
    question: question.problemTitle || question.title || question.question || question.description || "",
    options: Array.isArray(question.options) ? question.options : [],
    explanation: question.explanation || "",
    type: normalizeQuestionType(question.type, isCoding),
    subject: question.subject || (isCoding ? "Coding" : "General"),
    difficulty: normalizeDifficulty(question.difficulty),
    studentAnswer: answer || "",
    correctAnswer: question.correctAnswer || "",
    marks: question.marks || 1,
    negativeMarks: question.negativeMarks || 0,
    obtainedMarks,
    status: answerStatus,
    timeTaken,
    language: language || "",
  };

  if (isCoding) {
    result.codingResult = {
      language: language || "",
      code: code || answer || "",
      compilationStatus: "pending",
      executionStatus: "pending",
      visibleTestCasesPassed: answerEntry.passedCount || 0,
      visibleTestCasesTotal: (question.testCases || []).filter(tc => !tc.isHidden).length || answerEntry.totalCount || 0,
      hiddenTestCasesPassed: 0,
      hiddenTestCasesTotal: (question.testCases || []).filter(tc => tc.isHidden).length,
      executionTime: 0,
      memoryUsage: 0,
      marksObtained: obtainedMarks,
    };
  }

  return result;
}

export function computeSectionSummary(sectionName, questionResults) {
  const totalQuestions = questionResults.length;
  const correct = questionResults.filter(q => q.status === "correct").length;
  const wrong = questionResults.filter(q => q.status === "wrong").length;
  const skipped = questionResults.filter(q => q.status === "skipped" || q.status === "not_visited").length;
  const pending = questionResults.filter(q => q.status === "pending_evaluation").length;
  const attempted = questionResults.filter(q => {
    if (q.status === "correct" || q.status === "wrong") return true;
    if (q.type === "Coding" && (q.codingResult?.code || q.studentAnswer || (q.obtainedMarks && q.obtainedMarks > 0))) return true;
    return false;
  }).length;
  const totalMarks = questionResults.reduce((s, q) => s + (q.marks || 0), 0);
  const obtainedMarks = questionResults.reduce((s, q) => s + (q.obtainedMarks || 0), 0);
  const percentage = totalMarks > 0 ? Math.round((Math.max(0, obtainedMarks) / totalMarks) * 100) : 0;

  return {
    section: sectionName,
    totalQuestions,
    attempted,
    correct,
    wrong,
    skipped,
    pendingEvaluation: pending,
    totalMarks,
    obtainedMarks: Math.max(0, obtainedMarks),
    percentage,
  };
}

export function computeOverallSummary(questionResults) {
  const totalQuestions = questionResults.length;
  const correct = questionResults.filter(q => q.status === "correct").length;
  const wrong = questionResults.filter(q => q.status === "wrong").length;
  const skipped = questionResults.filter(q => q.status === "skipped").length;
  const notVisited = questionResults.filter(q => q.status === "not_visited").length;
  const pending = questionResults.filter(q => q.status === "pending_evaluation").length;
  const attempted = questionResults.filter(q => {
    if (q.status === "correct" || q.status === "wrong") return true;
    if (q.type === "Coding" && (q.codingResult?.code || q.studentAnswer || (q.obtainedMarks && q.obtainedMarks > 0))) return true;
    return false;
  }).length;
  const totalMarks = questionResults.reduce((s, q) => s + (q.marks || 0), 0);
  const obtainedMarks = questionResults.reduce((s, q) => s + (q.obtainedMarks || 0), 0);
  const percentage = totalMarks > 0 ? Math.round((Math.max(0, obtainedMarks) / totalMarks) * 100) : 0;

  return {
    totalQuestions,
    attempted,
    correct,
    wrong,
    skipped,
    notVisited,
    pendingEvaluation: pending,
    totalMarks,
    obtainedMarks: Math.max(0, obtainedMarks),
    percentage,
  };
}
