/**
 * judgeRequirementExtractor.js
 * =============================
 * Dynamically extracts atomic scoring requirements and semantic criteria
 * from the combination of Question + ExpectedKnowledge/Reference.
 *
 * Expands technical domain synonyms and semantic equivalence groups
 * so candidate answers with varied vocabulary ("subclassing is prohibited" vs
 * "cannot be extended") are recognized and rewarded appropriately.
 */

// Comprehensive Technical Domain Synonym Map
export const TECHNICAL_SYNONYM_GROUPS = [
  // OOP & Class hierarchies
  ["extend", "extended", "extends", "extending", "inherit", "inherited", "inherits", "inheritance", "subclass", "subclasses", "subclassing", "subclassed", "derive", "derived", "derives", "subclassable"],
  ["override", "overridden", "overrides", "overriding", "redefine", "redefined", "redefines", "polymorphic override"],
  ["reassign", "reassigned", "reassigns", "reassigning", "modify", "modified", "mutate", "mutated", "immutable", "constant", "fixed value", "read only", "read-only"],
  ["instantiate", "instantiated", "instance", "create object", "new object"],
  ["encapsulation", "data hiding", "private fields", "getter and setter", "access modifiers"],

  // Networking & Protocols
  ["stateless", "does not store session", "token based", "no server state"],
  ["idempotent", "same outcome", "identical result on replay", "no side effects on repeated calls"],
  ["connection oriented", "reliable", "guaranteed delivery", "three way handshake", "tcp handshake", "error checking"],
  ["connectionless", "best effort", "unreliable", "no handshake", "fast packet delivery"],
  ["not found", "resource missing", "resource not found", "does not exist", "unresolved route", "cannot find resource"],

  // Databases & Storage
  ["relational", "sql", "rdbms", "table based", "structured tables", "schema based", "acid"],
  ["nosql", "non relational", "document store", "key value", "unstructured", "dynamic schema"],
  ["in memory", "ram based", "cache", "caching", "fast memory access", "key value store"],
  ["normalization", "organizes data", "reduces redundancy", "eliminates duplicates", "improves data integrity", "normal forms"],
  ["index", "indexing", "b tree", "query optimization", "fast lookup", "binary search index"],

  // Web & Backend Architecture
  ["client_server", "client server", "frontend and backend", "request response", "rest api", "endpoint"],
  ["microservices", "service oriented", "distributed services", "decoupled components"],
  ["load_balancing", "load balancer", "application load balancer", "alb", "elb", "distribute traffic", "round robin", "traffic routing"],
  ["compute", "ec2", "ec2 instances", "virtual machines", "instances", "servers"],
  ["high_availability", "high availability", "multi az", "multiple azs", "redundancy", "failover", "fault tolerant", "99.99 uptime"],
  ["authentication", "verifying identity", "login", "jwt", "auth token", "credentials check"],
  ["authorization", "permissions", "access control", "role based access", "rbac"],
  ["side_effects", "side effects", "side effect", "lifecycle events", "asynchronous tasks"],
  ["subscribe", "subscribing", "subscriptions", "subscribers", "event listener", "subscribing to events"],
  ["ttl", "time to live", "ttl expiration", "expiration policy", "ttl expiration policy"],

  // Concurrency & Async
  ["asynchronous", "non blocking", "non-blocking", "async"],
  ["callbacks", "promises", "async await", "callback", "promise"],
  ["event_loop", "event loop", "event driven", "single threaded event loop"],
  ["threads", "worker threads", "thread pool", "multithreading", "libuv"],
  ["synchronous", "blocking", "sequential execution", "thread blocking"],

  // Prohibitions & Negations
  ["cannot", "can not", "prohibited", "not allowed", "forbidden", "prevents", "disallowed", "restricted", "impossible"],
];

/**
 * Builds a fast lookup synonym normalization map from groups.
 */
const EXPANDED_SYNONYM_MAP = new Map();
for (const group of TECHNICAL_SYNONYM_GROUPS) {
  const canonical = group[0].toLowerCase().replace(/\s+/g, "_");
  for (const term of group) {
    EXPANDED_SYNONYM_MAP.set(term.toLowerCase(), canonical);
  }
}

/**
 * Normalizes words and phrases against the technical synonym taxonomy.
 *
 * @param {string} text
 * @returns {string} Normalized text with canonical synonym tokens
 */
export function alignTechnicalSynonyms(text) {
  if (!text || typeof text !== "string") return "";
  let s = text.toLowerCase().replace(/[\-_]/g, " ");

  // Replace multi-word terms first
  for (const group of TECHNICAL_SYNONYM_GROUPS) {
    const canonical = group[0].replace(/\s+/g, "_");
    for (const phrase of group) {
      if (phrase.includes(" ")) {
        const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        s = s.replace(regex, canonical);
      }
    }
  }

  // Replace single-word terms
  return s
    .split(/\s+/)
    .map((word) => {
      const clean = word.replace(/[^\w]/g, "");
      return EXPANDED_SYNONYM_MAP.get(clean) || word;
    })
    .join(" ");
}

/**
 * Splits expected reference text into atomic requirements.
 *
 * @param {object} params
 * @param {string} params.question
 * @param {string} params.expectedKnowledge
 * @param {string} params.questionType
 * @param {number} [params.maxMarks=5]
 * @returns {Array<{ id: string, claim: string, weight: number, keywords: string[] }>}
 */
export function extractRequirements({
  question = "",
  expectedKnowledge = "",
  questionType = "EXPLANATION_CONCEPTUAL",
  maxMarks = 5,
}) {
  const exp = String(expectedKnowledge || "").trim();
  const q = String(question || "").trim();

  // 1. Single-deliverable direct factual types
  if (
    questionType === "SQL_QUERY" ||
    questionType === "CLI_COMMAND" ||
    questionType === "OUTPUT_PREDICTION" ||
    questionType === "KEYWORD_IDENTIFIER" ||
    questionType === "CODE_SNIPPET"
  ) {
    return [
      {
        id: "req_primary",
        claim: exp || q,
        weight: 1.0,
        keywords: [exp],
      },
    ];
  }

  // 2. HR Question Requirements
  if (questionType === "HR_INTRODUCTION") {
    return [
      { id: "req_edu", claim: "Educational background and academic credentials", weight: 0.30, keywords: ["degree", "university", "college", "engineering", "b.tech", "cs"] },
      { id: "req_skills", claim: "Core technical skills and proficiencies", weight: 0.35, keywords: ["javascript", "python", "java", "react", "node", "sql", "full stack"] },
      { id: "req_proj", claim: "Practical projects and experience", weight: 0.25, keywords: ["project", "built", "developed", "portfolio", "internship"] },
      { id: "req_interest", claim: "Career enthusiasm and professional interest", weight: 0.10, keywords: ["passionate", "enthusiastic", "learn", "grow", "aim"] },
    ];
  }

  if (questionType === "HR_STRENGTHS") {
    return [
      { id: "req_strength", claim: "Clear identification of professional strengths", weight: 0.50, keywords: ["problem solving", "quick learner", "debugging", "teamwork", "discipline"] },
      { id: "req_context", claim: "Practical application context and work scenarios", weight: 0.30, keywords: ["project", "deadline", "team", "challenge", "complex"] },
      { id: "req_impact", claim: "Positive impact and effective outcomes", weight: 0.20, keywords: ["impact", "quality", "efficiency", "deliver"] },
    ];
  }

  if (questionType === "HR_WEAKNESS") {
    return [
      { id: "req_weakness", claim: "Candid identification of a genuine improvement area", weight: 0.40, keywords: ["weakness", "struggle", "public speaking", "saying no", "overthinking"] },
      { id: "req_mitigation", claim: "Actionable proactive steps taken to mitigate and improve", weight: 0.45, keywords: ["working on", "improving", "practice", "courses", "feedback", "routine"] },
      { id: "req_growth", claim: "Growth mindset and self-reflection", weight: 0.15, keywords: ["learned", "progress", "growth", "better", "mindset"] },
    ];
  }

  if (questionType === "HR_BEHAVIORAL_STAR") {
    return [
      { id: "req_situation", claim: "Situation context and challenge encountered", weight: 0.25, keywords: ["situation", "context", "challenge", "conflict", "problem", "deadline"] },
      { id: "req_action", claim: "Proactive action taken with clear personal ownership", weight: 0.45, keywords: ["decided", "took", "handled", "implemented", "communicated", "resolved", "I decided"] },
      { id: "req_result", claim: "Measurable outcome and positive resolution", weight: 0.20, keywords: ["result", "outcome", "delivered", "improved", "resolved", "on time"] },
      { id: "req_learning", claim: "Key takeaways and self-reflection", weight: 0.10, keywords: ["learned", "realized", "insight", "takeaway"] },
    ];
  }

  // 3. Decompose General Technical / Project Expected Knowledge into Sub-Claims
  // Split by comma, period, semicolon, bullet, or 'and' clauses
  const rawClauses = exp
    .split(/(?:[;\.\n]|,\s*(?:and\s+)?|\band\s+)/)
    .map((c) => c.trim())
    .filter((c) => c.length > 5);

  if (rawClauses.length >= 2 && rawClauses.length <= 6) {
    const equalWeight = Number((1.0 / rawClauses.length).toFixed(3));
    return rawClauses.map((clause, idx) => ({
      id: `req_${idx + 1}`,
      claim: clause,
      weight: idx === rawClauses.length - 1 ? Number((1.0 - equalWeight * (rawClauses.length - 1)).toFixed(3)) : equalWeight,
      keywords: clause.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    }));
  }

  // Fallback to unified reference requirement
  return [
    {
      id: "req_core",
      claim: exp || q,
      weight: 1.0,
      keywords: (exp || q).toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    },
  ];
}
