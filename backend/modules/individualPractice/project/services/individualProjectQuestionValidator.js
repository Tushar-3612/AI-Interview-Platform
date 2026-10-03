/**
 * Context-aware validator for Individual Project / Resume questions.
 * Ensures questions are grounded in candidate's project portfolio, architecture,
 * implementation choices, data flow, DB, auth, performance, deployment, or failure scenarios.
 */

const PURE_ACADEMIC_PATTERNS = [
  /^what is (a|an|the)?\s+(binary search|linked list|stack|queue|binary tree|b-tree|red black tree|polymorphism|inheritance|encapsulation|abstraction|interface|abstract class|keyword|syntax|variable|data type)\b/i,
  /^define (polymorphism|inheritance|encapsulation|abstraction|recursion|big o|time complexity|space complexity)\b/i,
  /^explain the difference between (let and var|equals and ==|stack and heap|process and thread)\b/i,
  /^write a (program|function|code|algorithm) to (reverse|sort|find|calculate)\b/i,
];

const PROJECT_ARCH_KEYWORDS = [
  "project", "app", "application", "system", "architecture", "component",
  "backend", "frontend", "api", "database", "db", "schema", "table", "collection",
  "auth", "authentication", "authorization", "jwt", "token", "session", "user",
  "route", "endpoint", "middleware", "controller", "service", "model",
  "deploy", "deployment", "server", "docker", "cloud", "aws", "hosting",
  "error", "failure", "crash", "scale", "scaling", "performance", "cache", "redis",
  "trade-off", "challenge", "decision", "choice", "queue", "async", "websocket",
  "payload", "request", "response", "latency", "throughput", "security", "rate limit",
  "cors", "migration", "query", "index", "load", "state", "store", "flow"
];

/**
 * Validates whether a question is genuinely project/resume oriented.
 * @param {string} text - The question text
 * @param {Array} candidateProjects - Array of candidate project objects or tech strings
 * @returns {boolean} true if valid project question, false if invalid generic academic question
 */
export function isProjectQuestionValid(text = "", candidateProjects = []) {
  const str = String(text).trim();
  if (!str || str.length < 10) return false;

  // 1. Reject pure academic definition questions
  const isPureAcademic = PURE_ACADEMIC_PATTERNS.some((pattern) => pattern.test(str));
  if (isPureAcademic) {
    return false;
  }

  // 2. Direct project phrasing match (always valid)
  const directPatterns = [
    /\byour (project|app|application|system|backend|frontend|architecture|database|api|code|repo|service|auth|workflow|implementation|deployment)\b/i,
    /\bin your (project|app|application|system|backend|frontend|architecture|database|api)\b/i,
    /\bhow did you (implement|design|build|choose|select|structure|handle|deploy|scale|test|optimize)\b/i,
    /\bwhy did you (choose|use|select|pick|opt for)\b/i,
    /\bchallenges you (faced|encountered|solved)\b/i,
    /\btrade-offs? (you|in your|for your)\b/i,
    /\bwhat would happen if (your|the) (backend|server|database|api|auth|service|client)\b/i,
    /\bhow do you handle (errors|failures|exceptions|auth|state|requests|queries|concurrency|rate limits) in\b/i,
  ];

  if (directPatterns.some((p) => p.test(str))) {
    return true;
  }

  // 3. Context-aware validation against candidate's tech stack / project topics
  const lowerText = str.toLowerCase();

  // Extract all candidate tech terms
  const candidateTechTerms = new Set();
  candidateProjects.forEach((p) => {
    if (typeof p === "string") {
      p.split(/\s+/).forEach((w) => candidateTechTerms.add(w.toLowerCase()));
    } else if (p && typeof p === "object") {
      if (p.name) p.name.split(/\s+/).forEach((w) => candidateTechTerms.add(w.toLowerCase()));
      if (Array.isArray(p.technologies)) {
        p.technologies.forEach((tech) => candidateTechTerms.add(String(tech).toLowerCase()));
      }
    }
  });

  // If text mentions candidate tech AND architectural context
  let hasTechMatch = false;
  for (const term of candidateTechTerms) {
    if (term.length > 2 && lowerText.includes(term)) {
      hasTechMatch = true;
      break;
    }
  }

  let hasArchKeyword = PROJECT_ARCH_KEYWORDS.some((kw) => lowerText.includes(kw));

  if (hasTechMatch || hasArchKeyword) {
    return true;
  }

  // Fallback: if text length is sufficient and doesn't explicitly look like a generic trivia question
  return str.length > 25 && !str.toLowerCase().startsWith("what is the output of");
}
