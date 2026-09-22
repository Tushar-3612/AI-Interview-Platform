/**
 * transcriptFormatter.js
 *
 * Conservative, high-fidelity transcript formatting utility for the Real AI Interview.
 * - Deduplicates consecutive stuttered words and overlapping recognition fragments.
 * - Formats technical vocabulary (React, Node.js, TypeScript, etc.) accurately.
 * - Normalizes whitespace and sentence capitalization.
 * - STRICT CONSTRAINT: Never alters meaning, never hallucinates words, never uses LLM rewriting.
 */

// Common tech keywords mapping (strictly conservative word-boundary matching)
const TECH_TERMS_MAP = [
  { pattern: /\b(node\s*js|nodejs)\b/gi, replacement: "Node.js" },
  { pattern: /\b(react\s*js|reactjs|react)\b/gi, replacement: "React" },
  { pattern: /\b(next\s*js|nextjs)\b/gi, replacement: "Next.js" },
  { pattern: /\b(express\s*js|expressjs)\b/gi, replacement: "Express.js" },
  { pattern: /\b(javascript|java script)\b/gi, replacement: "JavaScript" },
  { pattern: /\b(typescript|type script)\b/gi, replacement: "TypeScript" },
  { pattern: /\b(mongodb|mongo db)\b/gi, replacement: "MongoDB" },
  { pattern: /\b(postgres|postgresql|postgre sql)\b/gi, replacement: "PostgreSQL" },
  { pattern: /\b(mysql|my sql)\b/gi, replacement: "MySQL" },
  { pattern: /\b(sqlite|sqllite)\b/gi, replacement: "SQLite" },
  { pattern: /\b(sql)\b/gi, replacement: "SQL" },
  { pattern: /\b(nosql|no sql)\b/gi, replacement: "NoSQL" },
  { pattern: /\b(jwt|json web token|json web tokens)\b/gi, replacement: "JWT" },
  { pattern: /\b(rest\s*apis?|restful\s*apis?)\b/gi, replacement: "REST API" },
  { pattern: /\b(graphql|graph ql)\b/gi, replacement: "GraphQL" },
  { pattern: /\b(docker)\b/gi, replacement: "Docker" },
  { pattern: /\b(kubernetes|k8s)\b/gi, replacement: "Kubernetes" },
  { pattern: /\b(github|git hub)\b/gi, replacement: "GitHub" },
  { pattern: /\b(git)\b/gi, replacement: "Git" },
  { pattern: /\b(python)\b/gi, replacement: "Python" },
  { pattern: /\b(java)\b/gi, replacement: "Java" },
  { pattern: /\b(c\+\+|cpp)\b/gi, replacement: "C++" },
  { pattern: /\b(c#|c sharp)\b/gi, replacement: "C#" },
  { pattern: /\b(aws|amazon web services)\b/gi, replacement: "AWS" },
  { pattern: /\b(azure)\b/gi, replacement: "Azure" },
  { pattern: /\b(gcp|google cloud platform)\b/gi, replacement: "GCP" },
  { pattern: /\b(gemini)\b/gi, replacement: "Gemini" },
  { pattern: /\b(groq)\b/gi, replacement: "Groq" },
  { pattern: /\b(openai|open ai)\b/gi, replacement: "OpenAI" },
  { pattern: /\b(html5|html)\b/gi, replacement: "HTML" },
  { pattern: /\b(css3|css)\b/gi, replacement: "CSS" },
  { pattern: /\b(redux)\b/gi, replacement: "Redux" },
  { pattern: /\b(tailwind\s*css|tailwind)\b/gi, replacement: "Tailwind CSS" },
  { pattern: /\b(redis)\b/gi, replacement: "Redis" },
  { pattern: /\b(kafka)\b/gi, replacement: "Kafka" },
  { pattern: /\b(ci\/cd|ci cd)\b/gi, replacement: "CI/CD" },
  { pattern: /\b(api|apis)\b/gi, replacement: "API" },
  { pattern: /\b(json)\b/gi, replacement: "JSON" },
  { pattern: /\b(dom)\b/gi, replacement: "DOM" },
];

/**
 * Deduplicates immediately repeated consecutive words
 * Example: "I used React React for for the" -> "I used React for the"
 */
export function deduplicateConsecutiveWords(text) {
  if (!text || typeof text !== "string") return "";
  // Split into tokens preserving punctuation attached to words
  return text.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");
}

/**
 * Normalizes technical terms using word boundaries
 */
export function normalizeTechnicalTerms(text) {
  if (!text || typeof text !== "string") return "";
  let formatted = text;
  for (const { pattern, replacement } of TECH_TERMS_MAP) {
    formatted = formatted.replace(pattern, replacement);
  }
  return formatted;
}

/**
 * Standard sentence capitalization & whitespace normalization
 */
export function formatSentenceCasing(text) {
  if (!text || typeof text !== "string") return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  // Capitalize first character and any character following sentence terminators (. ? !)
  return cleaned.replace(/(^\s*|\.\s+|\?\s+|\!\s+)([a-z])/g, (_, prefix, char) => {
    return prefix + char.toUpperCase();
  });
}

/**
 * Complete, faithful transcript formatter
 */
export function formatSpeechTranscript(rawText) {
  if (!rawText || typeof rawText !== "string") return "";
  const trimmed = rawText.trim();
  if (!trimmed) return "";

  // 1. Deduplicate consecutive word stutter
  const deduped = deduplicateConsecutiveWords(trimmed);

  // 2. Normalize technical terms casing
  const techNormalized = normalizeTechnicalTerms(deduped);

  // 3. Sentence capitalization & clean spacing
  return formatSentenceCasing(techNormalized);
}

export default formatSpeechTranscript;
