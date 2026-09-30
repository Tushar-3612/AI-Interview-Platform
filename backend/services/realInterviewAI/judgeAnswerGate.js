/**
 * judgeAnswerGate.js
 * ==================
 * Mandatory pre-evaluation gate for candidate answers in the Real Interview system.
 *
 * Runs BEFORE AI evaluation or complex NLP scoring.
 * Detects:
 * - Empty / whitespace-only answers
 * - Explicit refusal ("I cannot answer this", "I decline to answer")
 * - Ignorance / lack of knowledge ("I don't know", "no idea", "not sure", "sorry don't know")
 * - Conversational filler / politeness ("Thank you", "Thanks", "Hi", "Hello sir")
 * - Placeholder text ("(No answer submitted)", "null", "undefined", "not answered")
 * - Obvious non-answers / evasion ("skip", "next question", "pass")
 *
 * Returns:
 * {
 *   isGateTriggered: boolean,
 *   score: 0,
 *   status: "NOT_ATTEMPTED" | "INCORRECT",
 *   reason: string,
 *   rating: "Not Attempted" | "Weak",
 *   feedback: string
 * }
 */

// Explicit refusal & ignorance patterns
const REFUSAL_PATTERNS = [
  // Cannot answer variations
  /^(?:i\s+)?(?:cannot|can't|am\s+unable\s+to|could\s+not|couldn't)\s+(?:answer|respond\s+to|solve|explain)\s+(?:this|these|the)?\s*(?:question|questions|problem)?(?:\s*[\.,!])?(?:\s*(?:sorry|apologies|thank\s+you|thanks)[\w\s\.,!]*)?$/i,
  /^(?:sorry|apologies)(?:[\s,]+(?:for\s+that|i\s+cannot\s+answer|i\s+can't\s+answer|i\s+don't\s+know|i\s+do\s+not\s+know))?(?:\s*[\.,!])?$/i,
  /^(?:i\s+)?(?:do\s+not|don't)\s+(?:know|remember|recall|have\s+an\s+answer|have\s+any\s+idea|understand)(?:\s+(?:the\s+answer|this|about\s+this|anything\s+about\s+this|the\s+concept))?(?:\s*[\.,!])?(?:\s*(?:sorry|apologies)[\w\s\.,!]*)?$/i,
  /^(?:no\s+idea|no\s+clue|no\s+answer|not\s+sure|not\s+aware|haven't\s+studied\s+this|never\s+heard\s+of\s+this)(?:\s+(?:about\s+this|of\s+this))?(?:\s*[\.,!])?(?:\s*(?:sorry|apologies)[\w\s\.,!]*)?$/i,
  /^(?:pass|skip|next|next\s+question|please\s+skip|move\s+to\s+next)(?:\s*[\.,!])?$/i,
  /^(?:i\s+would\s+like\s+to\s+skip|i\s+want\s+to\s+skip|skip\s+this\s+question)(?:\s*[\.,!])?$/i,
  /^(?:i\s+decline\s+to\s+answer|prefer\s+not\s+to\s+answer|no\s+comments?)(?:\s*[\.,!])?$/i,
];

// Conversational filler / politeness patterns without substance
const FILLER_PATTERNS = [
  /^(?:thank\s+you|thanks|thank\s+you\s+so\s+much|thanks\s+a\s+lot|thx)(?:\s+(?:sir|ma'am|interviewer))?(?:\s*[\.,!])*$/i,
  /^(?:hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening)(?:\s+(?:sir|ma'am|interviewer))?(?:\s*[\.,!])*$/i,
  /^(?:ok|okay|yeah|sure|alright|fine|understood|got\s+it)(?:\s*[\.,!])*$/i,
  /^(?:na|n\/a|none|nil|nothing|null|undefined|nan)(?:\s*[\.,!])*$/i,
];

// Placeholder strings from DB / frontends
const PLACEHOLDER_STRINGS = new Set([
  "",
  "(no answer submitted)",
  "(no answer provided)",
  "not answered",
  "not submitted",
  "no answer",
  "none",
  "null",
  "undefined",
  "n/a",
  "-",
  "--",
  "...",
  "?",
  "??",
  "???",
]);

/**
 * Checks whether an answer is an empty/placeholder or explicit refusal/filler.
 *
 * @param {string} candidateAnswer
 * @param {object} [context]
 * @param {string} [context.question]
 * @param {string} [context.expectedKnowledge]
 * @returns {{
 *   isGateTriggered: boolean,
 *   score: number,
 *   status: "NOT_ATTEMPTED" | "INCORRECT" | "VALID",
 *   gateType?: "EMPTY" | "PLACEHOLDER" | "REFUSAL" | "FILLER" | "GIBBERISH",
 *   reason: string,
 *   feedback: string,
 *   rating: "Not Attempted" | "Weak" | "Valid"
 * }}
 */
export function checkAnswerGate(candidateAnswer, context = {}) {
  const raw = String(candidateAnswer || "").trim();

  // 1. Empty / Whitespace
  if (!raw) {
    return {
      isGateTriggered: true,
      score: 0,
      status: "NOT_ATTEMPTED",
      gateType: "EMPTY",
      reason: "Answer is empty or contains only whitespace.",
      feedback: "Question was not attempted.",
      rating: "Not Attempted",
    };
  }

  const lower = raw.toLowerCase().replace(/[^\w\s\(\)\/\-\?\.]/g, "").trim();

  // 2. Known placeholder strings
  if (PLACEHOLDER_STRINGS.has(lower) || PLACEHOLDER_STRINGS.has(raw.toLowerCase())) {
    return {
      isGateTriggered: true,
      score: 0,
      status: "NOT_ATTEMPTED",
      gateType: "PLACEHOLDER",
      reason: `Answer is a system placeholder ("${raw}").`,
      feedback: "Question was not attempted.",
      rating: "Not Attempted",
    };
  }

  // 3. Conversational filler / politeness without substance
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(raw)) {
      return {
        isGateTriggered: true,
        score: 0,
        status: "INCORRECT",
        gateType: "FILLER",
        reason: `Answer contains conversational filler ("${raw}") rather than technical/interview content.`,
        feedback: "Response does not provide an answer to the interview question.",
        rating: "Weak",
      };
    }
  }

  // 4. Explicit refusal / ignorance statements
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(raw)) {
      return {
        isGateTriggered: true,
        score: 0,
        status: "INCORRECT",
        gateType: "REFUSAL",
        reason: `Candidate explicitly stated inability/refusal to answer: "${raw}".`,
        feedback: "Candidate indicated they cannot answer this question.",
        rating: "Weak",
      };
    }
  }

  // 5. Short non-answer single punctuation/symbol checks (exclude valid numbers and letters like "10", "42", "db")
  if (raw.length <= 2 && !/^[a-zA-Z0-9]{1,2}$/.test(raw)) {
    return {
      isGateTriggered: true,
      score: 0,
      status: "NOT_ATTEMPTED",
      gateType: "GIBBERISH",
      reason: "Answer consists of non-alphanumeric punctuation symbols.",
      feedback: "Question was not attempted with valid content.",
      rating: "Not Attempted",
    };
  }

  // 6. Compound refusal prefix with no actual technical explanation
  // E.g. "I don't know the answer. Sorry for that."
  const compoundRefusalRegex = /^(?:i\s+(?:cannot|can't|don't|do\s+not)\s+(?:answer|know|remember|understand)[^.]*[\.\!]?\s*)+(?:sorry|apologies|thanks|thank\s+you)?[^a-zA-Z0-9]*$/i;
  if (compoundRefusalRegex.test(raw)) {
    return {
      isGateTriggered: true,
      score: 0,
      status: "INCORRECT",
      gateType: "REFUSAL",
      reason: `Compound refusal detected: "${raw}".`,
      feedback: "Candidate indicated they cannot answer this question.",
      rating: "Weak",
    };
  }

  return {
    isGateTriggered: false,
    score: 0,
    status: "VALID",
    reason: "Answer passed pre-evaluation gate.",
    feedback: "",
    rating: "Valid",
  };
}
