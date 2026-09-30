import { safeLogger } from "./utils/safeLogger.js";

/**
 * Validates parsed JSON responses against expected round schemas.
 */
export class AIResponseValidator {
  /**
   * Validates parsed data for specified round type.
   * @param {any} data Parsed JSON object or array
   * @param {string} roundType Round type ('technical', 'project', 'hr', 'coding', 'evaluation', etc.)
   */
  static validate(data, roundType = "general") {
    if (!data || (typeof data !== "object")) {
      throw new Error(`Invalid AI response schema: expected object or array, received ${typeof data}`);
    }

    const type = String(roundType).toLowerCase();

    if (type.includes("eval") || type === "evaluation") {
      this.validateEvaluationSchema(data);
    } else if (type === "technical" || type === "project" || type === "hr") {
      this.validateQuestionSchema(data, type);
    } else if (type === "coding") {
      this.validateCodingSchema(data);
    }

    return true;

  }

  static validateQuestionSchema(data, roundType) {
    const isArray = Array.isArray(data);
    const questions = isArray ? data : (data.questions || [data]);

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error(`Invalid ${roundType} question response: empty array or missing question data`);
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || typeof q !== "object") {
        throw new Error(`Invalid ${roundType} question item at index ${i}`);
      }

      const qText = q.question || q.questionText || q.text;
      if (!qText || typeof qText !== "string" || qText.trim() === "") {
        throw new Error(`Missing question text in ${roundType} question item at index ${i}`);
      }
    }
  }

  static validateCodingSchema(data) {
    const q = Array.isArray(data) ? data[0] : (data.question || data);
    if (!q || typeof q !== "object") {
      throw new Error("Invalid coding question response: expected object");
    }

    const text = q.problemStatement || q.description || q.question || q.title;
    if (!text || typeof text !== "string" || text.trim() === "") {
      throw new Error("Coding question is missing problem statement/title");
    }
  }

  static validateEvaluationSchema(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid evaluation response: expected object");
    }

    // Handle batch evaluation response containing evaluations array
    if (Array.isArray(data.evaluations)) {
      if (data.evaluations.length === 0) {
        throw new Error("Evaluation response has empty evaluations array");
      }
      for (let i = 0; i < data.evaluations.length; i++) {
        const item = data.evaluations[i];
        if (!item || typeof item !== "object") {
          throw new Error(`Evaluation item at index ${i} is not an object`);
        }
        if (item.score === undefined && item.rating === undefined && !item.feedback) {
          throw new Error(`Evaluation item for question ${item.questionId || i} is missing score and feedback`);
        }
      }
      return true;
    }

    // Handle single evaluation response
    const score = data.score ?? data.rating ?? data.totalScore;
    const feedback = data.feedback || data.evaluation || data.summary || data.finalFeedback;

    if (score === undefined && !feedback) {
      throw new Error("Evaluation response missing score and feedback");
    }
    return true;
  }
}

export default AIResponseValidator;
