import { normalizeQuestionText } from "./questionHistoryService.js";

/**
 * answerResolver.js
 * =================
 * Authoritative single answer resolver for Real Interview result calculation.
 * Resolves candidate answers across dedicated round sessions and main Interview documents.
 * 
 * RESOLUTION PRIORITY (Must contain a REAL candidate answer):
 * 1. Exact questionId match in roundSessionAnswers WITH real answer
 * 2. Exact questionId match in mainInterviewAnswers WITH real answer
 * 3. Variant questionId match in roundSessionAnswers WITH real answer
 * 4. Variant questionId match in mainInterviewAnswers WITH real answer
 * 5. Normalized question text match in roundSessionAnswers WITH real answer
 * 6. Normalized question text match in mainInterviewAnswers WITH real answer
 * 7. Otherwise NOT_ATTEMPTED (answerPresent: false, source: "none")
 * 
 * Empty/placeholder records NEVER shadow valid candidate answers.
 */

function isPlaceholderText(str) {
  if (!str || typeof str !== "string") return true;
  const s = str.trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  return (
    s === "(No answer submitted)" ||
    s === "(No answer provided)" ||
    lower === "not answered" ||
    lower === "not submitted" ||
    lower === "none" ||
    lower === "null" ||
    lower === "undefined"
  );
}

export function hasRealAnswer(a) {
  if (!a || typeof a !== "object") return false;
  const candidateAns = String(a.candidateAnswer || a.answer || a.sourceCode || "").trim();
  const transcript = String(a.transcript || "").trim();
  const selectedOpt = String(a.selectedOption || "").trim();

  // Selected option A, B, C, D in aptitude is a valid real answer
  if (["A", "B", "C", "D"].includes(selectedOpt.toUpperCase())) {
    return true;
  }

  // Non-placeholder candidate answer or transcript is a valid real answer
  if (!isPlaceholderText(candidateAns)) return true;
  if (!isPlaceholderText(transcript)) return true;

  return false;
}

function matchExactId(a, targetId) {
  if (!a || !targetId) return false;
  const aId = String(a.questionId || a._id || a.id || "").trim();
  return aId && aId === targetId;
}

function matchVariantId(a, targetId) {
  if (!a || !targetId) return false;
  const aId = String(a.questionId || a._id || a.id || "").trim();
  if (!aId) return false;

  const strippedA = aId.replace(/^(q|hr_q|tech_q|proj_q|apt_q|coding_q)_?/i, "").toLowerCase();
  const strippedTarget = targetId.replace(/^(q|hr_q|tech_q|proj_q|apt_q|coding_q)_?/i, "").toLowerCase();

  return Boolean(strippedA && strippedTarget && strippedA === strippedTarget);
}

function matchNormalizedText(a, targetText) {
  if (!a || !targetText) return false;
  const aText = String(a.question || a.questionText || a.title || a.description || "").trim();
  if (!aText) return false;

  const normA = normalizeQuestionText(aText);
  const normTarget = normalizeQuestionText(targetText);

  return Boolean(normA && normTarget && normA === normTarget);
}

/**
 * Resolves candidate answer for any question across round sessions & main Interview document.
 * 
 * @param {Object} params
 * @param {string} params.roundType - "APTITUDE" | "TECHNICAL" | "RESUME_PROJECT" | "HR" | "CODING"
 * @param {string} params.questionId - Question MongoDB _id or string ID
 * @param {number} [params.questionIndex] - 1-based question index for logging
 * @param {string} [params.questionText] - Question text for normalized fallback matching
 * @param {Array} [params.options] - Aptitude options array (if applicable)
 * @param {Array} [params.roundSessionAnswers] - Answers array from RealInterview<Round>Session / Submission
 * @param {Array} [params.mainInterviewAnswers] - Answers array from main Interview document
 * 
 * @returns {{ answerPresent: boolean, answer: string, transcript: string, selectedOption: string, inputMethod: string, source: string }}
 */
export function resolveCandidateAnswer({
  roundType = "GENERAL",
  questionId,
  questionIndex = 1,
  questionText = "",
  options = [],
  roundSessionAnswers = [],
  mainInterviewAnswers = [],
}) {
  const normId = String(questionId || "").trim();
  const roundSessionList = Array.isArray(roundSessionAnswers) ? roundSessionAnswers : [];
  const interviewDocList = Array.isArray(mainInterviewAnswers) ? mainInterviewAnswers : [];

  let answerObj = null;
  let source = "none";

  // Priority 1: Exact questionId match in roundSessionAnswers WITH real answer
  if (normId) {
    answerObj = roundSessionList.find((a) => matchExactId(a, normId) && hasRealAnswer(a));
    if (answerObj) source = "roundSessionExactId";
  }

  // Priority 2: Exact questionId match in mainInterviewAnswers WITH real answer
  if (!answerObj && normId) {
    answerObj = interviewDocList.find((a) => matchExactId(a, normId) && hasRealAnswer(a));
    if (answerObj) source = "interviewDocExactId";
  }

  // Priority 3: Variant questionId match in roundSessionAnswers WITH real answer
  if (!answerObj && normId) {
    answerObj = roundSessionList.find((a) => matchVariantId(a, normId) && hasRealAnswer(a));
    if (answerObj) source = "roundSessionVariantId";
  }

  // Priority 4: Variant questionId match in mainInterviewAnswers WITH real answer
  if (!answerObj && normId) {
    answerObj = interviewDocList.find((a) => matchVariantId(a, normId) && hasRealAnswer(a));
    if (answerObj) source = "interviewDocVariantId";
  }

  // Priority 5: Normalized question text match in roundSessionAnswers WITH real answer
  if (!answerObj && questionText) {
    answerObj = roundSessionList.find((a) => matchNormalizedText(a, questionText) && hasRealAnswer(a));
    if (answerObj) source = "roundSessionTextMatch";
  }

  // Priority 6: Normalized question text match in mainInterviewAnswers WITH real answer
  if (!answerObj && questionText) {
    answerObj = interviewDocList.find((a) => matchNormalizedText(a, questionText) && hasRealAnswer(a));
    if (answerObj) source = "interviewDocTextMatch";
  }

  // Extract answer values
  let rawAnswerStr = "";
  let transcriptStr = "";
  let rawSelectedOpt = "";
  let inputMethod = "TEXT";

  if (answerObj) {
    rawAnswerStr = String(
      answerObj.candidateAnswer ||
      answerObj.answer ||
      answerObj.sourceCode ||
      ""
    ).trim();

    transcriptStr = String(answerObj.transcript || rawAnswerStr).trim();
    rawSelectedOpt = String(answerObj.selectedOption || "").trim();
    inputMethod = String(answerObj.inputMethod || "TEXT").trim();
  }

  // Determine answer presence using hasRealAnswer
  const answerPresent = Boolean(answerObj && hasRealAnswer(answerObj));
  if (!answerPresent) {
    source = "none";
  }

  // Extract Aptitude option letter (A, B, C, D)
  let selectedOption = "";
  const upperRound = String(roundType).toUpperCase();
  if (upperRound === "APTITUDE" && answerPresent) {
    const candidateStr = rawSelectedOpt || rawAnswerStr;
    const upperCandidate = candidateStr.toUpperCase().trim();

    if (["A", "B", "C", "D"].includes(upperCandidate)) {
      selectedOption = upperCandidate;
    } else {
      const match = candidateStr.match(/^(?:OPTION\s+)?([A-D])(?:\b|:|\s)/i);
      if (match) {
        selectedOption = match[1].toUpperCase();
      } else if (Array.isArray(options) && options.length > 0) {
        const lowerCandidate = candidateStr.toLowerCase();
        for (const opt of options) {
          const optLabel = String(opt.label || "").toUpperCase().trim();
          const optText = String(opt.text || opt.option || "").toLowerCase().trim();
          if (
            lowerCandidate === optText ||
            lowerCandidate === `option ${optLabel.toLowerCase()}: ${optText}` ||
            lowerCandidate === `option ${optLabel.toLowerCase()}`
          ) {
            selectedOption = optLabel;
            break;
          }
        }
      }
    }
  }

  // Diagnostic log
  const roundLog = String(roundType).toLowerCase();
  if (upperRound === "APTITUDE") {
    console.log(
      `[RESULT-ANSWER] round=${roundLog} questionId=${normId} questionIndex=${questionIndex} answerSource=${source} answerPresent=${answerPresent} answerLength=${answerPresent ? rawAnswerStr.length : 0} selectedOption=${selectedOption || "none"}`
    );
  } else {
    console.log(
      `[RESULT-ANSWER] round=${roundLog} questionId=${normId} questionIndex=${questionIndex} answerSource=${source} answerPresent=${answerPresent} answerLength=${answerPresent ? rawAnswerStr.length : 0}`
    );
  }

  return {
    answerPresent,
    answer: answerPresent ? rawAnswerStr : "",
    transcript: answerPresent ? transcriptStr : "",
    selectedOption,
    inputMethod,
    source,
  };
}

