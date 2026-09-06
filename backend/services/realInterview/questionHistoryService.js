import RealInterviewQuestionHistory from "../../models/RealInterviewQuestionHistory.js";

const COMMON_FILLER_WORDS = new Set([
  "what", "is", "are", "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with",
  "by", "how", "why", "did", "you", "choose", "select", "use", "using", "implement", "your", "project",
  "explain", "describe", "difference", "between", "tell", "me", "about", "time", "when", "can", "could",
  "would", "should", "does", "do", "make", "made", "which", "give", "example", "scenario", "case", "system"
]);

/**
 * Normalizes question text for duplicate detection.
 * Handles lowercasing, space collapse, and punctuation removal.
 */
export function normalizeQuestionText(text = "") {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts core semantic tokens from question text (stripping common filler/question words).
 */
export function extractContentTokens(text = "") {
  const norm = normalizeQuestionText(text);
  if (!norm) return new Set();
  const words = norm.split(" ").filter((w) => w.length > 2 && !COMMON_FILLER_WORDS.has(w));
  return new Set(words);
}

/**
 * Deterministic semantic similarity check using Jaccard token overlap & key term matching.
 * Returns true if two questions are semantically equivalent (e.g. asking the same core question).
 */
export function isSemanticallyDuplicate(textA, textB, threshold = 0.65) {
  const normA = normalizeQuestionText(textA);
  const normB = normalizeQuestionText(textB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const setA = extractContentTokens(textA);
  const setB = extractContentTokens(textB);

  if (setA.size === 0 || setB.size === 0) return false;

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionSize = new Set([...setA, ...setB]).size;
  const jaccard = intersectionCount / unionSize;

  if (jaccard >= threshold) return true;

  // Substring containment check for short coding problem titles (e.g. "Two Sum" inside "Find Two Numbers With Target Sum")
  if (setA.size >= 2 && setA.size <= 4 && setB.size >= 2) {
    let subsetMatchCount = 0;
    for (const token of setA) {
      if (setB.has(token)) subsetMatchCount++;
    }
    if (subsetMatchCount >= setA.size) return true;
  }

  return false;
}

/**
 * Retrieves a Set of normalized questions previously shown to the user in past Real Interviews.
 */
export async function getUserQuestionHistorySet(userId) {
  if (!userId) return new Set();

  try {
    const records = await RealInterviewQuestionHistory.find({ userId })
      .select("normalizedQuestion questionText")
      .lean();

    const historySet = new Set();
    for (const r of records) {
      if (r.normalizedQuestion) {
        historySet.add(r.normalizedQuestion);
      }
      if (r.questionText) {
        historySet.add(r.questionText);
      }
    }
    return historySet;
  } catch (error) {
    console.error("[QuestionHistoryService] Error fetching user history:", error.message);
    return new Set();
  }
}

/**
 * Checks if a question text is duplicate against historySet or currentPoolSet (exact or semantic).
 */
export function isDuplicateQuestion(text = "", userHistorySet = new Set(), currentPoolSet = new Set()) {
  const norm = normalizeQuestionText(text);
  if (!norm) return true;

  if (userHistorySet.has(norm) || currentPoolSet.has(norm)) {
    return true;
  }

  for (const existingNorm of currentPoolSet) {
    if (isSemanticallyDuplicate(norm, existingNorm)) {
      return true;
    }
  }

  for (const historyItem of userHistorySet) {
    if (isSemanticallyDuplicate(norm, historyItem)) {
      return true;
    }
  }

  return false;
}

/**
 * Persists new questions to the user's Real Interview question history.
 */
export async function recordUserQuestionHistory({ userId, sessionId, round, questions = [] }) {
  if (!userId || !sessionId || !Array.isArray(questions) || questions.length === 0) {
    return;
  }

  try {
    const docsToInsert = [];
    for (const q of questions) {
      const textsToRecord = [
        q.question,
        q.title,
        q.description,
        q.title && q.description ? `${q.title} ${q.description}` : null,
      ].filter(Boolean);

      for (const text of textsToRecord) {
        const norm = normalizeQuestionText(text);
        if (norm) {
          docsToInsert.push({
            userId,
            sessionId,
            round,
            questionId: q.id || q._id || q.questionId || "",
            questionText: String(text),
            normalizedQuestion: norm,
          });
        }
      }
    }

    if (docsToInsert.length > 0) {
      await RealInterviewQuestionHistory.insertMany(docsToInsert, { ordered: false }).catch((err) => {
        if (err.code !== 11000) {
          console.warn("[QuestionHistoryService] Bulk insert warning:", err.message);
        }
      });
    }
  } catch (error) {
    console.error("[QuestionHistoryService] Error recording history:", error.message);
  }
}

/**
 * Filters out questions that have already been presented to the candidate in past sessions
 * OR are duplicates within the current candidate pool.
 */
export function filterUniqueQuestions(questions = [], userHistorySet = new Set(), currentPoolSet = new Set()) {
  if (!Array.isArray(questions)) return [];

  const uniqueList = [];
  for (const q of questions) {
    const textsToCheck = [
      q.question,
      q.title,
      q.description,
      q.title && q.description ? `${q.title} ${q.description}` : null,
    ].filter(Boolean);

    if (textsToCheck.length === 0) continue;

    let isDup = false;
    for (const text of textsToCheck) {
      if (isDuplicateQuestion(String(text), userHistorySet, currentPoolSet)) {
        isDup = true;
        break;
      }
    }

    if (!isDup) {
      for (const text of textsToCheck) {
        const norm = normalizeQuestionText(String(text));
        if (norm) currentPoolSet.add(norm);
      }
      uniqueList.push(q);
    }
  }
  return uniqueList;
}
