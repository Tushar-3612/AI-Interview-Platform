import RealInterviewQuestionHistory from "../../models/RealInterviewQuestionHistory.js";
import IndividualTechnicalSession from "../../models/IndividualTechnicalSession.js";
import IndividualProjectSession from "../../models/IndividualProjectSession.js";
import RealInterviewTechnicalSession from "../../models/RealInterviewTechnicalSession.js";
import RealInterviewTechnicalQuestion from "../../models/RealInterviewTechnicalQuestion.js";

const COMMON_FILLER_WORDS = new Set([
  "what", "is", "are", "was", "were", "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with",
  "by", "how", "why", "did", "do", "does", "done", "you", "choose", "select", "use", "uses", "used", "using",
  "implement", "implementation", "your", "project", "explain", "describe", "difference", "different", "differ",
  "between", "tell", "me", "about", "time", "when", "can", "could", "would", "should", "make", "made", "which",
  "give", "example", "scenario", "case", "system", "purpose", "role", "work", "works", "working", "benefit",
  "benefits", "advantage", "advantages", "disadvantage", "disadvantages", "main", "key", "concept", "concepts"
]);

/**
 * Normalizes question text for duplicate detection.
 * Handles lowercasing, space collapse, and punctuation removal.
 */
export function normalizeQuestionText(text = "") {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/express\.js/g, "express")
    .replace(/expressjs/g, "express")
    .replace(/react\.js/g, "react")
    .replace(/reactjs/g, "react")
    .replace(/node\.js/g, "node")
    .replace(/nodejs/g, "node")
    .replace(/vue\.js/g, "vue")
    .replace(/vuejs/g, "vue")
    .replace(/next\.js/g, "next")
    .replace(/nextjs/g, "next")
    .replace(/javascript/g, "js")
    .replace(/typescript/g, "ts")
    .replace(/mongodb/g, "mongo")
    .replace(/postgresql/g, "postgres")
    .replace(/asynchronous/g, "async")
    .replace(/synchronous/g, "sync")
    .replace(/authentication/g, "auth")
    .replace(/authorization/g, "authz")
    .replace(/databases/g, "db")
    .replace(/database/g, "db")
    .replace(/operations/g, "ops")
    .replace(/operation/g, "ops")
    .replace(/functions/g, "fn")
    .replace(/function/g, "fn")
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes individual word tokens (stemming plurals and aliases).
 */
function stemToken(word = "") {
  let w = word.toLowerCase();
  if (w === "indexes" || w === "indices") return "index";
  if (w === "keys") return "key";
  if (w === "props" || w === "properties") return "prop";
  if (w === "queries") return "query";
  if (w === "databases" || w === "database") return "db";
  if (w === "middlewares" || w === "middleware") return "middleware";
  if (w === "asynchronous") return "async";
  if (w === "synchronous") return "sync";
  if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) {
    return w.slice(0, -1);
  }
  return w;
}

/**
 * Extracts core semantic tokens from question text (stripping common filler/question words).
 */
export function extractContentTokens(text = "") {
  const norm = normalizeQuestionText(text);
  if (!norm) return new Set();
  const words = norm
    .split(" ")
    .map(stemToken)
    .filter((w) => w.length > 1 && !COMMON_FILLER_WORDS.has(w));
  return new Set(words);
}

/**
 * Deterministic semantic similarity check using Jaccard token overlap & key term matching.
 * Returns true if two questions are semantically equivalent.
 */
export function isSemanticallyDuplicate(textA, textB, threshold = 0.40) {
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

  // Relative overlap against smaller set: if >= 50% of tokens in smaller set overlap
  const minSize = Math.min(setA.size, setB.size);
  if (minSize >= 2 && (intersectionCount / minSize) >= 0.50) {
    return true;
  }

  return false;
}

/**
 * Retrieves a Set of normalized questions previously shown to the user across Real Interview sessions:
 * Isolated by resumeHash if provided (satisfying the Resume Isolation Rule).
 */
export async function getUserQuestionHistorySet(userId, resumeHash = null, round = null) {
  if (!userId) return new Set();

  try {
    const historySet = new Set();
    const query = { userId };
    if (resumeHash) {
      query.resumeHash = resumeHash;
    }
    if (round) {
      query.round = round;
    }

    // 1. Query RealInterviewQuestionHistory (centralized history table)
    const records = await RealInterviewQuestionHistory.find(query)
      .select("normalizedQuestion questionText")
      .lean();

    for (const r of records) {
      if (r.normalizedQuestion) historySet.add(r.normalizedQuestion);
      if (r.questionText) historySet.add(normalizeQuestionText(r.questionText));
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
 * Persists new questions to the user's question history.
 */
export async function recordUserQuestionHistory({ userId, sessionId, resumeHash = "", round = "technical", questions = [] }) {
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
            resumeHash: String(resumeHash || ""),
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
