/**
 * deterministicEvaluator.js
 * ==========================
 * Production-Quality, Generic Deterministic NLP Fallback Evaluation Engine
 * for Real Interview rounds (TECHNICAL, PROJECT, HR).
 *
 * ZERO hardcoded question IDs.
 * ZERO external AI/LLM API calls.
 * ZERO word-count penalty gates.
 */

// -----------------------------------------------------------------------
// 1. TEXT & SYNTAX NORMALIZATION HELPERS
// -----------------------------------------------------------------------

import { checkAnswerGate } from "./judgeAnswerGate.js";
import { alignTechnicalSynonyms } from "./judgeRequirementExtractor.js";

const SYNONYM_MAP = {
  distinct: "differ",
  different: "differ",
  differing: "differ",
  varied: "differ",
  multiple: "differ",
  behavior: "behavior",
  behaviors: "behavior",
  function: "func",
  functions: "func",
  method: "func",
  methods: "func",
  db: "databas",
  database: "databas",
  databases: "databas",
  datastore: "databas",
  datastores: "databas",
  request: "request",
  requests: "request",
  req: "request",
  response: "respons",
  responses: "respons",
  res: "respons",
  resp: "respons",
  param: "param",
  params: "param",
  parameter: "param",
  parameters: "param",
  argument: "param",
  arguments: "param",
  arg: "param",
  args: "param",
  implementation: "implement",
  implementations: "implement",
  implementing: "implement",
  implemented: "implement",
  interface: "interfac",
  interfaces: "interfac",
  // Cloud & Infra Synonyms
  alb: "loadbalanc",
  loadbalancer: "loadbalanc",
  ec2: "comput",
  instance: "comput",
  instances: "comput",
  // OOP & Hierarchy Synonyms
  inherit: "extend",
  inherits: "extend",
  inherited: "extend",
  inheritance: "extend",
  subclass: "extend",
  subclasses: "extend",
  subclassing: "extend",
  derive: "extend",
  derived: "extend",
  override: "override",
  overridden: "override",
  overriding: "override",
  redefine: "override",
  redefined: "override",
  reassign: "reassign",
  reassigned: "reassign",
  mutate: "reassign",
  mutated: "reassign",
  immutable: "reassign",
  constant: "reassign",
  prohibit: "cannot",
  prohibited: "cannot",
  forbidden: "cannot",
  disallow: "cannot",
  disallowed: "cannot",
  prevent: "cannot",
  prevents: "cannot",
  // Performance & Caching Synonyms
  speeding: "perform",
  speed: "perform",
  faster: "perform",
  reducing: "optim",
  reduces: "optim",
  reduced: "optim",
  reduction: "optim",
  expiration: "expir",
  expiry: "expir",
  expired: "expir",
};

/**
 * Standard lemmatization-like suffix stripping and synonym normalization for English technical terms.
 */
function normalizeToken(word) {
  if (!word || typeof word !== "string") return "";
  let w = word.toLowerCase().replace(/[^\w]/g, "").trim();
  if (SYNONYM_MAP[w]) return SYNONYM_MAP[w];
  if (w.length > 5) {
    if (w.endsWith("ation")) w = w.slice(0, -5);      // authentication → authent
    else if (w.endsWith("ations")) w = w.slice(0, -6);
    else if (w.endsWith("izing")) w = w.slice(0, -4); // optimizing → optim
    else if (w.endsWith("ized")) w = w.slice(0, -4);  // optimized → optim
    else if (w.endsWith("izes")) w = w.slice(0, -4);
    else if (w.endsWith("ing")) w = w.slice(0, -3);   // caching → cach
    else if (w.endsWith("tion")) w = w.slice(0, -3);  // encryption → encrypt
    else if (w.endsWith("ed")) w = w.slice(0, -2);    // implemented → implement
    else if (w.endsWith("er") && w !== "computer" && w !== "computers") w = w.slice(0, -2);    // controller → controll
    else if (w.endsWith("es")) w = w.slice(0, -2);    // caches → cach
    else if (w.endsWith("s") && w.length > 4) w = w.slice(0, -1); // tokens → token
  }
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1); // handle → handl, store → stor
  if (w.endsWith("y") && w.length > 3) w = w.slice(0, -1) + "i"; // query/queries → queri, policy/policies → polici
  return SYNONYM_MAP[w] || w;
}

const STOP_WORDS = new Set([
  "to", "is", "of", "on", "an", "as", "in", "by", "or", "it", "at", "if", "be", "do", "we", "he", "no", "so", "my", "me", "up", "the", "and", "for", "with", "this", "that", "from", "they", "thei", "are", "not", "can", "what", "which", "how", "who", "when", "where", "why", "used", "using", "uses", "such", "while", "whil", "also", "make", "made", "like", "well", "into", "their", "them", "some", "more", "most", "than", "then", "have", "has", "had", "any", "other", "another", "each", "every", "between", "across", "through", "within", "without", "unlike", "unlik", "over", "under", "about", "because", "becaus"
]);
const SHORT_TECH_TERMS = new Set(["db", "az", "ui", "ip", "os", "ai", "io", "id", "go", "c"]);

/**
 * Extract normalized unigrams and compound bigrams from text.
 */
function extractConceptTokens(text) {
  if (!text || typeof text !== "string") return { unigrams: new Set(), bigrams: new Set() };
  let s = text.replace(/\bi\/o\b/gi, "io").replace(/\bnon[\s\-_]blocking\b/gi, "non_blocking");
  const alignedText = alignTechnicalSynonyms(s);
  const words = alignedText
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const unigrams = new Set();
  const bigrams = new Set();

  for (let i = 0; i < words.length; i++) {
    const t = normalizeToken(words[i]);
    if ((t.length >= 3 && !STOP_WORDS.has(t)) || SHORT_TECH_TERMS.has(t)) {
      unigrams.add(t);
    }
    if (i + 1 < words.length) {
      const b1 = normalizeToken(words[i]);
      const b2 = normalizeToken(words[i + 1]);
      if (
        ((b1.length >= 3 && !STOP_WORDS.has(b1)) || SHORT_TECH_TERMS.has(b1)) &&
        ((b2.length >= 3 && !STOP_WORDS.has(b2)) || SHORT_TECH_TERMS.has(b2))
      ) {
        bigrams.add(`${b1}_${b2}`);
      }
    }
  }
  return { unigrams, bigrams };
}

/**
 * Normalizes general text: strips markdown fences, conversational prefixes, collapses spaces.
 */
function normalizeTechnicalExpression(str) {
  if (!str || typeof str !== "string") return "";
  let s = str.trim();
  s = s.replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```$/i, "");
  s = s.replace(/^`+|`+$/g, "");
  s = s.replace(
    /^(?:the\s+keyword\s+is|keyword\s+is|the\s+command\s+is|command\s+is|the\s+query\s+is|query\s+is|we\s+use|you\s+can\s+use|answer\s*:\s*|code\s*:\s*|output\s*:\s*|result\s*:\s*)/i,
    ""
  ).trim();
  s = s.replace(/\s+/g, " ");
  return s;
}

/**
 * Canonical SQL normalization.
 */
function normalizeSQLQuery(str) {
  if (!str || typeof str !== "string") return "";
  let s = normalizeTechnicalExpression(str).toLowerCase();
  s = s.replace(/;+\s*$/, "");
  s = s.replace(/\s*([,()=*<>+])\s*/g, "$1");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Canonical CLI command normalization.
 */
function normalizeCLICommand(str) {
  if (!str || typeof str !== "string") return "";
  let s = normalizeTechnicalExpression(str).toLowerCase();
  s = s.replace(/['"`]/g, '"');
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Canonical code snippet normalization.
 */
function normalizeCodeSnippet(str) {
  if (!str || typeof str !== "string") return "";
  let s = normalizeTechnicalExpression(str);
  s = s.replace(/\s*([=+\-*/:,\(\)\[\]{}])\s*/g, "$1");
  s = s.replace(/\s*;\s*$/, "");
  s = s.replace(/['`]/g, '"');
  return s.trim();
}

/**
 * Normalizes literal output prediction strings.
 */
function normalizeLiteralOutput(str) {
  if (!str || typeof str !== "string") return "";
  let s = normalizeTechnicalExpression(str);
  s = s.replace(/^output\s*:\s*/i, "").trim();
  s = s.replace(/^["'`]|["'`]$/g, "");
  return s.trim();
}

// -----------------------------------------------------------------------
// 2. CONTRADICTION & REASONING PATTERNS
// -----------------------------------------------------------------------

const REASONING_PATTERN = /\b(because|therefore|thus|hence|since|due to|as a result|consequently|ensures|enables|allows|requires|leads to|results in|prevents|handles)\b/i;
const EXAMPLE_PATTERN = /\b(for example|e\.g\.|such as|like|for instance|consider|suppose|assume|instance)\b/i;
const NEGATION_PATTERN = /\b(not|no|never|without|cannot|can't|prevent|avoid|instead|rather|unless|except)\b/i;

const CONTRADICTION_RULES = [
  {
    pattern: /\b(get\s+(?:deletes|modifies|updates|removes|destroys)|http\s+get\s+deletes)\b/i,
    context: /get|http method|rest/i,
    message: "HTTP GET is safe/read-only and does not delete or modify server resources.",
  },
  {
    pattern: /\b(post\s+is\s+idempotent|get\s+is\s+not\s+idempotent)\b/i,
    context: /idempotent|http/i,
    message: "HTTP POST is not idempotent, whereas GET, PUT, and DELETE are idempotent.",
  },
  {
    pattern: /\b(tcp\s+is\s+(?:connectionless|unreliable)|udp\s+is\s+(?:connection-oriented|reliable|guaranteed))\b/i,
    context: /tcp|udp|transport|network/i,
    message: "TCP is connection-oriented and reliable; UDP is connectionless and best-effort.",
  },
  {
    pattern: /\b(docker\s+is\s+a\s+(?:relational\s+)?database|react\s+is\s+a\s+database|node(?:\.js)?\s+is\s+a\s+database)\b/i,
    context: /docker|react|node/i,
    message: "Tool classification is incorrect (e.g. Docker is a container platform, not a database).",
  },
  {
    pattern: /\b(const\s+(?:variables?\s+can\s+be\s+reassigned|can\s+be\s+reassigned)|tuple\s+is\s+mutable)\b/i,
    context: /const|tuple|immutable/i,
    message: "Const variables and tuples are immutable / cannot be reassigned.",
  },
  {
    pattern: /\b(security\s+groups?\s+(?:are|is)\s+stateless|nacl(?:s)?\s+(?:are|is)\s+stateful)\b/i,
    context: /security group|nacl|aws/i,
    message: "Security Groups are stateful; Network Access Control Lists (NACLs) are stateless.",
  },
  {
    pattern: /\b(polymorphism\s+is\s+a\s+(?:relational\s+)?database|inheritance\s+is\s+a\s+database)\b/i,
    context: /polymorphism|oop|inheritance/i,
    message: "Object-Oriented Programming concept incorrectly defined as a database.",
  },
  {
    pattern: /\b(redis\s+is\s+(?:a\s+)?(?:relational|permanent|sql)|redis\s+is\s+used\s+to\s+permanently\s+store)\b/i,
    context: /redis|cache|key-value/i,
    message: "Redis is an in-memory key-value data store/cache, not a relational SQL database for permanent storage.",
  },
  {
    pattern: /\b(jwt\s+(?:is\s+used\s+to\s+store\s+passwords|stores\s+passwords\s+in\s+the\s+database))\b/i,
    context: /jwt|token|auth|password/i,
    message: "JWT is used for secure stateless claims/token-based authentication, not for storing passwords in databases.",
  },
  {
    pattern: /\b(rest(?:\s+api)?\s+is\s+a\s+(?:relational\s+)?database|graphql\s+is\s+a\s+database)\b/i,
    context: /rest|api|graphql/i,
    message: "REST/GraphQL is an API architecture/protocol, not a database.",
  },
  {
    pattern: /\b(?:xss|cross.?site\s+scripting)\b.*?\b(?:sql\s+queries|sql\s+injection|database\s+tables?|relational\s+database)\b/i,
    context: /xss|cross.?site scripting/i,
    message: "Cross-Site Scripting (XSS) is client-side script injection in the browser, not SQL query injection into database tables.",
  },
];

function detectContradictions(candidateText, questionText) {
  const found = [];
  const combinedContext = (candidateText + " " + questionText).toLowerCase();
  for (const rule of CONTRADICTION_RULES) {
    if (rule.context.test(combinedContext) && rule.pattern.test(candidateText)) {
      found.push(rule.message);
    }
  }
  return found;
}

// -----------------------------------------------------------------------
// 3. SPECIALIZED STRATEGY EVALUATORS
// -----------------------------------------------------------------------

/**
 * Strategy 1: SQL Queries
 */
function evaluateSQLStrategy(cleanAns, cleanExp, cleanQuestion, maxScore) {
  const isSQL =
    /sql|query|select\b|insert\b|update\b|delete\s+from|create\s+table/i.test(cleanQuestion) ||
    /^(?:select|insert|update|delete|create|alter|drop)\b/i.test(cleanAns) ||
    /^(?:select|insert|update|delete)\b/i.test(cleanExp);

  if (!isSQL) return null;

  const normAnsSQL = normalizeSQLQuery(cleanAns);
  const normExpSQL = normalizeSQLQuery(cleanExp);

  // Exact complete SQL match
  if (normAnsSQL && normAnsSQL === normExpSQL) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: ["SQL query syntax, clauses, and target tables correctly specified"],
      missingPoints: [],
      feedback: "Correct SQL query. All required clauses match the expected reference.",
    };
  }

  // Parse clauses
  const extractClauses = (sql) => ({
    select: (/select\s+(.*?)\s+from/i.exec(sql) || [])[1] || "",
    from: (/from\s+(.*?)(?:\s+where|\s+join|\s+group|\s+order|;|$)/i.exec(sql) || [])[1] || "",
    where: (/where\s+(.*?)(?:\s+group|\s+order|;|$)/i.exec(sql) || [])[1] || "",
  });

  const ansClauses = extractClauses(cleanAns);
  const expClauses = extractClauses(cleanExp);

  if (expClauses.from && ansClauses.from) {
    const cleanTableAns = ansClauses.from.toLowerCase().replace(/[^\w]/g, "");
    const cleanTableExp = expClauses.from.toLowerCase().replace(/[^\w]/g, "");
    const tableMatch = cleanTableAns === cleanTableExp;

    if (!tableMatch) {
      return {
        score: 0,
        rating: "Weak",
        correctPoints: [],
        missingPoints: [`Query targets wrong table '${ansClauses.from}'; expected table '${expClauses.from}'`],
        feedback: `Incorrect SQL query. Target table '${ansClauses.from}' does not match expected table '${expClauses.from}'.`,
      };
    }

    const selectMatch =
      ansClauses.select.toLowerCase().replace(/\s+/g, "") ===
      expClauses.select.toLowerCase().replace(/\s+/g, "");

    if (selectMatch) {
      if (!expClauses.where) {
        return {
          score: maxScore,
          rating: "Strong",
          correctPoints: ["SQL table and column projections match correctly"],
          missingPoints: [],
          feedback: "Correct SQL query matching target table and columns.",
        };
      } else if (ansClauses.where && ansClauses.where.toLowerCase().replace(/\s+/g, "") === expClauses.where.toLowerCase().replace(/\s+/g, "")) {
        return {
          score: maxScore,
          rating: "Strong",
          correctPoints: ["SQL table, projection, and WHERE filter conditions matched"],
          missingPoints: [],
          feedback: "Correct SQL query matching target table, projections, and WHERE conditions.",
        };
      } else if (!ansClauses.where && expClauses.where) {
        const partialScore = Math.max(1, Math.round(maxScore * 0.6));
        return {
          score: partialScore,
          rating: "Partial",
          correctPoints: ["Correct SELECT columns and FROM table specified"],
          missingPoints: ["Missing required WHERE filtering condition"],
          feedback: `Partially correct SQL query. Selected correct table and columns, but omitted the WHERE filter. Score: ${partialScore}/${maxScore}.`,
        };
      }
    }
  }

  return {
    score: 0,
    rating: "Weak",
    correctPoints: [],
    missingPoints: ["SQL query syntax or logic does not match expected reference"],
    feedback: "Incorrect SQL query.",
  };
}

/**
 * Strategy 2: CLI / Terminal Commands
 */
function evaluateCLIStrategy(cleanAns, cleanExp, cleanQuestion, maxScore) {
  const isCLI =
    /git|command|cli|terminal|bash|shell|linux|docker|kubectl|npm|pip|curl|chmod/i.test(cleanQuestion) ||
    /^(?:git|docker|kubectl|npm|npx|pip|curl|systemctl|chmod|chown|grep|find|ssh|tar)\b/i.test(cleanAns);

  if (!isCLI) return null;

  const normAns = normalizeCLICommand(cleanAns);
  const normExp = normalizeCLICommand(cleanExp);

  // Exact command match
  if (normAns === normExp) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: ["CLI command and required options correctly specified"],
      missingPoints: [],
      feedback: "Correct command syntax matching the expected operation.",
    };
  }

  // Branch creation synonyms (git branch <name> vs git checkout -b <name> vs git switch -c <name>)
  const isBranchCreation =
    /create.*(?:new\s+)?branch|branch.*create/i.test(cleanQuestion) ||
    /git\s+(?:branch|checkout\s+-b|switch\s+-c)/i.test(cleanExp);

  if (isBranchCreation && /^git\s+(?:branch|checkout\s+-b|switch\s+-c)\s+[\w\d_\-\/]+/i.test(cleanAns)) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: ["Valid Git branch creation command provided"],
      missingPoints: [],
      feedback: "Correct Git branch creation syntax.",
    };
  }

  // Commit command with message: git commit -m "..."
  const isCommitCommand = /commit.*message|save.*staging/i.test(cleanQuestion) || /git\s+commit/i.test(cleanExp);
  if (isCommitCommand) {
    if (/^git\s+commit\s+-m\s+["'].*?["']/i.test(cleanAns)) {
      return {
        score: maxScore,
        rating: "Strong",
        correctPoints: ["Git commit syntax with message flag correctly provided"],
        missingPoints: [],
        feedback: "Correct Git commit command syntax.",
      };
    }
    if (/^git\s+commit\b/i.test(cleanAns)) {
      const partial = Math.max(1, Math.round(maxScore * 0.6));
      return {
        score: partial,
        rating: "Partial",
        correctPoints: ["Base git commit command identified"],
        missingPoints: ["Missing -m commit message flag"],
        feedback: `Partially correct. git commit specified, but descriptive message flag (-m) was omitted. Score: ${partial}/${maxScore}.`,
      };
    }
  }

  // Docker detached run
  if (/docker\s+run/i.test(cleanExp) && /^docker\s+run/i.test(cleanAns)) {
    const hasD = /-d\b/.test(cleanAns) === /-d\b/.test(cleanExp);
    const hasP = /-p\s+[\d:]+/.test(cleanAns) === /-p\s+[\d:]+/.test(cleanExp);
    if (hasD && hasP) {
      return {
        score: maxScore,
        rating: "Strong",
        correctPoints: ["Docker run options and port mapping accurately specified"],
        missingPoints: [],
        feedback: "Correct Docker container run command.",
      };
    }
  }

  // Linux chmod permissions
  if (/chmod\s+\d{3}/i.test(cleanExp) && /^chmod\s+\d{3}/i.test(cleanAns)) {
    const expChmod = (/chmod\s+(\d{3})/i.exec(cleanExp) || [])[1];
    const ansChmod = (/chmod\s+(\d{3})/i.exec(cleanAns) || [])[1];
    if (expChmod && ansChmod && expChmod === ansChmod) {
      return {
        score: maxScore,
        rating: "Strong",
        correctPoints: ["Correct chmod permission octal notation specified"],
        missingPoints: [],
        feedback: "Correct chmod permission syntax.",
      };
    }
  }

  // Base command & subcommand extraction anywhere in expected/candidate
  const expCmdMatch = cleanExp.match(/\b(git|docker|kubectl|npm|npx|pip|curl|chmod|systemctl)\s+([a-zA-Z0-9_\-]+)/i);
  const ansCmdMatch = cleanAns.match(/\b(git|docker|kubectl|npm|npx|pip|curl|chmod|systemctl)\s+([a-zA-Z0-9_\-]+)/i);

  if (expCmdMatch && ansCmdMatch) {
    const expTool = expCmdMatch[1].toLowerCase();
    const ansTool = ansCmdMatch[1].toLowerCase();
    const expSub = expCmdMatch[2].toLowerCase();
    const ansSub = ansCmdMatch[2].toLowerCase();

    if (expTool !== ansTool) {
      return {
        score: 0,
        rating: "Weak",
        correctPoints: [],
        missingPoints: [`Used tool '${ansTool}'; expected '${expTool}'`],
        feedback: `Incorrect command tool. Used '${ansTool}' instead of '${expTool}'.`,
      };
    }

    // If both are git/docker/etc., check if subcommands match or are known aliases
    const isKnownBranchAlias =
      (expSub === "branch" || expSub === "checkout" || expSub === "switch") &&
      (ansSub === "branch" || ansSub === "checkout" || ansSub === "switch");

    if (expSub !== ansSub && !isKnownBranchAlias) {
      return {
        score: 0,
        rating: "Weak",
        correctPoints: [],
        missingPoints: [`Specified wrong subcommand '${ansSub}'; expected '${expSub}'`],
        feedback: `Incorrect command. Executed '${ansTool} ${ansSub}' instead of '${expTool} ${expSub}'.`,
      };
    }
  }

  // General CLI match
  if (normExp.includes(normAns) && !/-[a-zA-Z]/.test(cleanExp.replace(cleanAns, ""))) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: ["CLI command and required options correctly specified"],
      missingPoints: [],
      feedback: "Correct command syntax matching the expected operation.",
    };
  }

  return {
    score: 0,
    rating: "Weak",
    correctPoints: [],
    missingPoints: ["CLI command does not match expected operation"],
    feedback: "Incorrect CLI command syntax or parameters.",
  };
}

/**
 * Strategy 3: Output Prediction
 */
function evaluateOutputPredictionStrategy(cleanAns, cleanExp, cleanQuestion, maxScore) {
  const isOutputQuestion =
    /what\s+is\s+the\s+output|what\s+will\s+(?:this\s+code\s+)?print|what\s+is\s+printed/i.test(cleanQuestion);

  if (!isOutputQuestion) return null;

  const normAns = normalizeLiteralOutput(cleanAns).toLowerCase();
  const normExp = normalizeLiteralOutput(cleanExp).toLowerCase();

  if (normAns && (normAns === normExp || normExp.includes(normAns))) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: ["Exact predicted output provided"],
      missingPoints: [],
      feedback: "Correct output prediction.",
    };
  }

  return {
    score: 0,
    rating: "Weak",
    correctPoints: [],
    missingPoints: ["Output prediction does not match expected result"],
    feedback: `Incorrect output prediction. Expected output is "${cleanExp}".`,
  };
}

/**
 * Strategy 4: Exact Keyword / Direct Fact / Method / Protocol
 */
function evaluateKeywordStrategy(cleanAns, cleanExp, cleanQuestion, maxScore) {
  const ansWords = cleanAns.trim().split(/\s+/).filter(Boolean);
  const expWords = cleanExp.trim().split(/\s+/).filter(Boolean);

  // Keyword strategy strictly handles short 1-2 word factual/keyword answers
  if (ansWords.length > 2 && expWords.length > 2) return null;

  const isSingleWordAns = ansWords.length <= 2 && /^[a-zA-Z0-9_\$#\+\-\[\]\(\)\{\}\.\/\s]{1,30}$/.test(cleanAns.trim());
  const isSingleWordExp = expWords.length <= 2 && /^[a-zA-Z0-9_\$#\+\-\[\]\(\)\{\}\.\/\s]{1,30}$/.test(cleanExp.trim());

  const isKeywordTarget =
    /\b(?:what|which)\s+(?:is\s+the\s+)?keyword\b|\bkeyword\s+is\s+used\b|http\s+method|status\s+code|protocol|time\s+complexity/i.test(cleanQuestion) ||
    isSingleWordExp;

  if (!isKeywordTarget && !isSingleWordAns) return null;

  const rawAns = cleanAns.trim().toLowerCase();
  const rawExp = cleanExp.trim().toLowerCase();

  // Exact single-term equality
  if (rawAns === rawExp) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: [`Correct technical identifier/keyword provided: "${cleanAns}"`],
      missingPoints: [],
      feedback: `Correct. Exact technical term "${cleanAns}" matches expected reference.`,
    };
  }

  // Keyword embedded in expected explanation
  const keywordRegex = new RegExp(
    `(^|[^a-zA-Z0-9_])${rawAns.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zA-Z0-9_]|$)`,
    "i"
  );
  if (keywordRegex.test(rawExp) && rawAns.length >= 2) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: [`Correct keyword/term provided: "${cleanAns}"`],
      missingPoints: [],
      feedback: `Correct. "${cleanAns}" directly answers the question.`,
    };
  }

  return null;
}

/**
 * Strategy 5: Code Snippet & Language Construct
 */
function evaluateCodeSnippetStrategy(cleanAns, cleanExp, cleanQuestion, maxScore) {
  const isCodeQuestion =
    /how\s+do\s+you\s+(?:declare|initialize|access|write|create|implement)|code\s+to|syntax\s+for|write\s+a\s+(?:function|method|class)/i.test(cleanQuestion) ||
    /[=\(\)\[\]\{\};]/.test(cleanAns);

  if (!isCodeQuestion) return null;

  const normAns = normalizeCodeSnippet(cleanAns);
  const normExp = normalizeCodeSnippet(cleanExp);

  // Exact normalized code match
  if (normAns && (normAns === normExp || normExp.includes(normAns))) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: ["Accurate code implementation matching language syntax"],
      missingPoints: [],
      feedback: "Correct code syntax and construct implementation.",
    };
  }

  // Data structure initialization (Python list / dict / JS array / object)
  const isListInit = /empty\s+list|declare.*list|create.*list/i.test(cleanQuestion) || /\[\s*\]|list\(\)/.test(cleanExp);
  if (isListInit && (/\w+\s*=\s*(?:\[\s*\]|list\(\))|^(?:\[\s*\]|list\(\))$/.test(cleanAns))) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: ["Empty list initialization syntax correctly implemented"],
      missingPoints: [],
      feedback: "Correct list initialization syntax (using [] or list()).",
    };
  }

  // Data structure access / indexing
  const isAccessKey = /access.*key|get.*value|dictionary|index/i.test(cleanQuestion) || /\[\s*['"\w\d_]*\s*\]|\.get\s*\(/i.test(cleanExp);
  if (isAccessKey && (/\w+\s*\[\s*["'\w\d_]+\s*\]|\w+\.get\s*\(/.test(cleanAns))) {
    return {
      score: maxScore,
      rating: "Strong",
      correctPoints: ["Correct indexing / bracket notation syntax used"],
      missingPoints: [],
      feedback: "Correct key access syntax provided.",
    };
  }

  // Array push / append
  if (/append|push/i.test(cleanQuestion) || /\.(?:push|append)\s*\(/i.test(cleanExp)) {
    if (/\.(?:push|append)\s*\([^)]*\)/i.test(cleanAns)) {
      return {
        score: maxScore,
        rating: "Strong",
        correctPoints: ["Array/list push/append method correctly utilized"],
        missingPoints: [],
        feedback: "Correct element insertion syntax.",
      };
    }
  }

  // Function header
  if (/function\s+header|def\s+\w+/i.test(cleanQuestion) || /def\s+\w+\s*\(|function\s+\w+\s*\(/i.test(cleanExp)) {
    if (/def\s+\w+\s*\([^)]*\)\s*:?|function\s+\w+\s*\([^)]*\)/i.test(cleanAns)) {
      return {
        score: maxScore,
        rating: "Strong",
        correctPoints: ["Function header syntax and parameters correctly defined"],
        missingPoints: [],
        feedback: "Correct function header syntax.",
      };
    }
  }

  return null;
}

// -----------------------------------------------------------------------
// 4. MAIN TECHNICAL QUESTION EVALUATOR
// -----------------------------------------------------------------------

export function evaluateTechnicalQuestion(q) {
  const ans = String(q.candidateAnswer || "").trim();
  const expected = String(q.expectedKnowledge || q.expectedAnswer || q.referenceAnswer || q.question || "").trim();
  const maxScore = Number(q.maxScore || q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5));
  const qId = String(q.questionId || q.id || "");

  // 1. Mandatory Answer Gate Pre-Check
  const gate = checkAnswerGate(ans, { question: q.question, expectedKnowledge: expected });
  if (gate.isGateTriggered) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      difficulty: q.difficulty,
      status: gate.status,
      rating: gate.rating,
      evaluationSource: "deterministic_nlp",
      correctPoints: [],
      missingPoints: ["Question was not attempted or was declined"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: gate.feedback,
      betterAnswer: expected || "Comprehensive technical explanation required.",
    };
  }

  const cleanAns = normalizeTechnicalExpression(ans);
  const cleanExp = normalizeTechnicalExpression(expected);
  const cleanQuestion = normalizeTechnicalExpression(q.question || "");

  // 2. Detect explicit technical contradictions
  const contradictions = detectContradictions(cleanAns, cleanQuestion);

  // 3. Dispatch specific strategy evaluators
  const sqlResult = evaluateSQLStrategy(cleanAns, cleanExp, cleanQuestion, maxScore);
  if (sqlResult) {
    const isContradicted = contradictions.length > 0;
    const finalScore = isContradicted ? 0 : sqlResult.score;
    const status = isContradicted
      ? "INCORRECT"
      : finalScore >= maxScore * 0.8
      ? "CORRECT"
      : finalScore > 0
      ? "PARTIALLY_CORRECT"
      : "INCORRECT";

    return {
      questionId: qId,
      score: finalScore,
      maxScore,
      difficulty: q.difficulty,
      status,
      rating: isContradicted ? "Weak" : sqlResult.rating,
      evaluationSource: "deterministic_nlp",
      correctPoints: sqlResult.correctPoints,
      missingPoints: sqlResult.missingPoints,
      incorrectPoints: contradictions,
      grammarIssues: [],
      feedback: isContradicted ? `Contradiction detected: ${contradictions.join("; ")}` : sqlResult.feedback,
      betterAnswer: expected,
    };
  }

  const cliResult = evaluateCLIStrategy(cleanAns, cleanExp, cleanQuestion, maxScore);
  if (cliResult) {
    const isContradicted = contradictions.length > 0;
    const finalScore = isContradicted ? 0 : cliResult.score;
    const status = isContradicted
      ? "INCORRECT"
      : finalScore >= maxScore * 0.8
      ? "CORRECT"
      : finalScore > 0
      ? "PARTIALLY_CORRECT"
      : "INCORRECT";

    return {
      questionId: qId,
      score: finalScore,
      maxScore,
      difficulty: q.difficulty,
      status,
      rating: isContradicted ? "Weak" : cliResult.rating,
      evaluationSource: "deterministic_nlp",
      correctPoints: cliResult.correctPoints,
      missingPoints: cliResult.missingPoints,
      incorrectPoints: contradictions,
      grammarIssues: [],
      feedback: isContradicted ? `Contradiction detected: ${contradictions.join("; ")}` : cliResult.feedback,
      betterAnswer: expected,
    };
  }

  const outputResult = evaluateOutputPredictionStrategy(cleanAns, cleanExp, cleanQuestion, maxScore);
  if (outputResult) {
    const isContradicted = contradictions.length > 0;
    const finalScore = isContradicted ? 0 : outputResult.score;
    const status = isContradicted
      ? "INCORRECT"
      : finalScore >= maxScore * 0.8
      ? "CORRECT"
      : "INCORRECT";

    return {
      questionId: qId,
      score: finalScore,
      maxScore,
      difficulty: q.difficulty,
      status,
      rating: isContradicted ? "Weak" : outputResult.rating,
      evaluationSource: "deterministic_nlp",
      correctPoints: outputResult.correctPoints,
      missingPoints: outputResult.missingPoints,
      incorrectPoints: contradictions,
      grammarIssues: [],
      feedback: outputResult.feedback,
      betterAnswer: expected,
    };
  }

  const keywordResult = evaluateKeywordStrategy(cleanAns, cleanExp, cleanQuestion, maxScore);
  if (keywordResult) {
    const isContradicted = contradictions.length > 0;
    const finalScore = isContradicted ? 0 : keywordResult.score;
    const status = isContradicted
      ? "INCORRECT"
      : finalScore >= maxScore * 0.8
      ? "CORRECT"
      : finalScore > 0
      ? "PARTIALLY_CORRECT"
      : "INCORRECT";

    return {
      questionId: qId,
      score: finalScore,
      maxScore,
      difficulty: q.difficulty,
      status,
      rating: isContradicted ? "Weak" : keywordResult.rating,
      evaluationSource: "deterministic_nlp",
      correctPoints: keywordResult.correctPoints,
      missingPoints: keywordResult.missingPoints,
      incorrectPoints: contradictions,
      grammarIssues: [],
      feedback: isContradicted ? `Contradiction detected: ${contradictions.join("; ")}` : keywordResult.feedback,
      betterAnswer: expected,
    };
  }

  const codeResult = evaluateCodeSnippetStrategy(cleanAns, cleanExp, cleanQuestion, maxScore);
  if (codeResult) {
    const isContradicted = contradictions.length > 0;
    const finalScore = isContradicted ? 0 : codeResult.score;
    const status = isContradicted
      ? "INCORRECT"
      : finalScore >= maxScore * 0.8
      ? "CORRECT"
      : finalScore > 0
      ? "PARTIALLY_CORRECT"
      : "INCORRECT";

    return {
      questionId: qId,
      score: finalScore,
      maxScore,
      difficulty: q.difficulty,
      status,
      rating: isContradicted ? "Weak" : codeResult.rating,
      evaluationSource: "deterministic_nlp",
      correctPoints: codeResult.correctPoints,
      missingPoints: codeResult.missingPoints,
      incorrectPoints: contradictions,
      grammarIssues: [],
      feedback: isContradicted ? `Contradiction detected: ${contradictions.join("; ")}` : codeResult.feedback,
      betterAnswer: expected,
    };
  }

  // 4. Strategy 6: Conceptual & Architectural Semantic Coverage
  const candTokens = extractConceptTokens(cleanAns);
  const expTokens = extractConceptTokens(cleanExp);
  const qTokens = extractConceptTokens(cleanQuestion);

  // Filter out question terms from reference knowledge so candidate cannot get marks merely echoing question words
  const pureExpUnigrams = new Set([...expTokens.unigrams].filter((u) => !qTokens.unigrams.has(u)));
  const targetUnigrams = pureExpUnigrams.size > 0 ? pureExpUnigrams : expTokens.unigrams;

  let matchedUnigrams = 0;
  for (const u of targetUnigrams) {
    if (candTokens.unigrams.has(u)) matchedUnigrams++;
  }
  const unigramCoverage = targetUnigrams.size > 0 ? matchedUnigrams / targetUnigrams.size : 0;

  // Bonus for compound bigrams
  let matchedBigrams = 0;
  for (const b of expTokens.bigrams) {
    if (!qTokens.bigrams.has(b) && candTokens.bigrams.has(b)) matchedBigrams++;
  }

  const hasReasoning = REASONING_PATTERN.test(cleanAns);
  const hasExample = EXAMPLE_PATTERN.test(cleanAns);
  const hasNegation = NEGATION_PATTERN.test(cleanAns);

  let evidenceRatio = unigramCoverage;
  if (matchedBigrams > 0) evidenceRatio += 0.15 * Math.min(2, matchedBigrams);
  if (hasReasoning && evidenceRatio > 0.10) evidenceRatio += 0.10;
  if (hasExample && evidenceRatio > 0.10) evidenceRatio += 0.05;
  let finalScore = 0;
  if (contradictions.length > 0) {
    finalScore = 0;
  } else if (targetUnigrams.size >= 5) {
    if (unigramCoverage >= 0.45 || (evidenceRatio >= 0.45 && matchedUnigrams >= 4)) {
      finalScore = maxScore;
    } else if (evidenceRatio >= 0.20 && matchedUnigrams >= 2) {
      finalScore = Math.max(1, Math.round(maxScore * 0.60));
    } else if (evidenceRatio >= 0.08 && matchedUnigrams >= 1) {
      finalScore = Math.max(1, Math.round(maxScore * 0.35));
    } else {
      finalScore = 0;
    }
  } else {
    if (unigramCoverage >= 0.50 || (evidenceRatio >= 0.45 && matchedUnigrams >= 1)) {
      finalScore = maxScore;
    } else if (evidenceRatio >= 0.15 && matchedUnigrams >= 1) {
      finalScore = Math.max(1, Math.round(maxScore * 0.50));
    } else {
      finalScore = 0;
    }
  }

  finalScore = Math.max(0, Math.min(maxScore, finalScore));

  let status = "INCORRECT";
  let rating = "Weak";

  if (contradictions.length > 0) {
    status = "INCORRECT";
    rating = "Weak";
  } else if (finalScore >= maxScore * 0.80) {
    status = "CORRECT";
    rating = "Strong";
  } else if (finalScore > 0) {
    status = "PARTIALLY_CORRECT";
    rating = "Acceptable";
  } else {
    status = "INCORRECT";
    rating = "Weak";
  }

  const coveragePct = Math.round(unigramCoverage * 100);
  const missingPoints = [];
  if (unigramCoverage < 0.35 && finalScore < maxScore) {
    missingPoints.push("Key architectural and technical concepts from expected reference were not fully addressed");
  }
  if (!hasReasoning && q.difficulty === "hard") {
    missingPoints.push("Reasoning explaining mechanism, design trade-offs, or causality was limited");
  }

  return {
    questionId: qId,
    score: finalScore,
    maxScore,
    difficulty: q.difficulty,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    correctPoints: finalScore > 0 ? [`Demonstrated ~${Math.max(coveragePct, Math.round((finalScore / maxScore) * 100))}% technical alignment with reference concept`] : [],
    missingPoints,
    incorrectPoints: contradictions,
    grammarIssues: [],
    feedback:
      contradictions.length > 0
        ? `Deterministic evaluation: Contradiction identified (${contradictions.join("; ")}). Score: ${finalScore}/${maxScore}.`
        : `Deterministic evaluation (AI unavailable). Concept alignment: ~${Math.max(coveragePct, Math.round((finalScore / maxScore) * 100))}%. ${
            hasReasoning ? "Reasoning detected. " : ""
          }${hasExample ? "Practical example detected. " : ""}Score: ${finalScore}/${maxScore}.`,
    betterAnswer: expected,
  };
}

// -----------------------------------------------------------------------
// 5. PROJECT ROUND DETERMINISTIC EVALUATION
// -----------------------------------------------------------------------

export function evaluateProjectQuestion(q) {
  const ans = String(q.candidateAnswer || "").trim();
  const expected = String(q.expectedKnowledge || q.expectedAnswer || q.referenceAnswer || q.question || "").trim();
  const maxScore = Number(q.maxScore || q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10));
  const qId = String(q.questionId || q.id || "");
  const cleanQuestion = normalizeTechnicalExpression(q.question || "");

  // 1. Mandatory Answer Gate Pre-Check
  const gate = checkAnswerGate(ans, { question: q.question, expectedKnowledge: expected });
  if (gate.isGateTriggered) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      difficulty: q.difficulty,
      status: gate.status,
      rating: gate.rating,
      evaluationSource: "deterministic_nlp",
      correctPoints: [],
      missingPoints: ["Question was not attempted or was declined"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: gate.feedback,
      betterAnswer: expected || "Demonstrate project architecture, data flow, and trade-off considerations.",
    };
  }

  const cleanAns = normalizeTechnicalExpression(ans);
  const cleanExp = normalizeTechnicalExpression(expected);

  // 1. Detect contradictions / false technical claims
  const contradictions = detectContradictions(cleanAns, cleanExp + " " + cleanQuestion);

  // 2. Extract concepts and filter question echo words
  const candTokens = extractConceptTokens(cleanAns);
  const expTokens = extractConceptTokens(cleanExp);
  const qTokens = extractConceptTokens(cleanQuestion);

  const pureExpUnigrams = new Set([...expTokens.unigrams].filter((u) => !qTokens.unigrams.has(u)));
  const targetUnigrams = pureExpUnigrams.size > 0 ? pureExpUnigrams : expTokens.unigrams;

  let matchedUnigrams = 0;
  for (const u of targetUnigrams) {
    if (candTokens.unigrams.has(u)) matchedUnigrams++;
  }
  const unigramCoverage = targetUnigrams.size > 0 ? matchedUnigrams / targetUnigrams.size : 0;

  // Bonus for compound bigrams (ignoring bigrams composed of question words)
  let matchedBigrams = 0;
  for (const b of expTokens.bigrams) {
    const parts = b.split("_");
    const isFromQuestion = qTokens.bigrams.has(b) || parts.some((p) => qTokens.unigrams.has(p));
    if (!isFromQuestion && candTokens.bigrams.has(b)) matchedBigrams++;
  }

  const hasArchitecture = /\b(architect|design|structur|pattern|layer|module|service|api|flow|pipeline|endpoint|database|schema|auth|middleware|deploy|scale|bottleneck|trade.?off|decision|chose|because|instead|rather|performance|security|scalab|availability|caching|redis|docker|microservice)\b/i.test(cleanAns);
  const hasDebugging = /\b(debug|error|fix|issue|problem|resolv|found|discover|root.?cause|stack.?trace|log|monitor)\b/i.test(cleanAns);
  const hasReasoning = REASONING_PATTERN.test(cleanAns);
  const hasExample = EXAMPLE_PATTERN.test(cleanAns);

  let evidenceRatio = unigramCoverage;
  if (matchedBigrams > 0) evidenceRatio += 0.15 * Math.min(2, matchedBigrams);
  if (hasArchitecture && matchedUnigrams >= 1) evidenceRatio += 0.08;
  if (hasReasoning && matchedUnigrams >= 1) evidenceRatio += 0.08;
  if (hasDebugging && matchedUnigrams >= 1) evidenceRatio += 0.05;
  if (hasExample && matchedUnigrams >= 1) evidenceRatio += 0.05;

  let score = 0;
  if (contradictions.length > 0 || matchedUnigrams === 0) {
    score = 0;
  } else if (unigramCoverage >= 0.40 || (evidenceRatio >= 0.35 && matchedUnigrams >= 5) || (evidenceRatio >= 0.40 && matchedBigrams >= 1 && matchedUnigrams >= 4)) {
    score = maxScore;
  } else if (evidenceRatio >= 0.25 && matchedUnigrams >= 3) {
    score = Math.max(1, Math.round(maxScore * 0.70));
  } else if (evidenceRatio >= 0.15 && matchedUnigrams >= 2) {
    score = Math.max(1, Math.round(maxScore * 0.50));
  } else if (evidenceRatio >= 0.08 && matchedUnigrams >= 1) {
    score = Math.max(1, Math.round(maxScore * 0.30));
  } else {
    score = 0;
  }

  score = Math.max(0, Math.min(maxScore, score));

  let status = "INCORRECT";
  let rating = "Weak";

  if (contradictions.length > 0 || score === 0) {
    status = "INCORRECT";
    rating = "Weak";
  } else if (score >= maxScore * 0.8) {
    status = "CORRECT";
    rating = "Strong";
  } else if (score > 0) {
    status = "PARTIALLY_CORRECT";
    rating = "Acceptable";
  } else {
    status = "INCORRECT";
    rating = "Weak";
  }

  const coveragePct = Math.round(unigramCoverage * 100);
  const missingPoints = [];
  if (unigramCoverage < 0.40 && score < maxScore) {
    missingPoints.push("Key architectural components, trade-offs, or implementation details were omitted");
  }

  return {
    questionId: qId,
    score,
    maxScore,
    difficulty: q.difficulty,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    correctPoints: score > 0 ? [`Demonstrated ~${Math.max(coveragePct, Math.round((score / maxScore) * 100))}% alignment with expected project architecture`] : [],
    missingPoints,
    incorrectPoints: contradictions,
    grammarIssues: [],
    feedback:
      contradictions.length > 0
        ? `Deterministic evaluation: Contradiction identified (${contradictions.join("; ")}). Score: 0/${maxScore}.`
        : `Deterministic evaluation (AI unavailable). Project concept alignment: ~${Math.max(coveragePct, Math.round((score / maxScore) * 100))}%. Score: ${score}/${maxScore}.`,
    betterAnswer: expected,
  };
}

// -----------------------------------------------------------------------
// 6. HR ROUND DETERMINISTIC EVALUATION (QUESTION-AWARE)
// -----------------------------------------------------------------------

const PATTERN_INTRO = /\b(introduce\s+yourself|tell\s+me\s+about\s+yourself|walk\s+me\s+through\s+your\s+resume|who\s+are\s+you|brief\s+introduction)\b/i;
const PATTERN_STRENGTHS = /\b(strengths?|strongest\s+asset|greatest\s+strength|core\s+competenc|superpower)\b/i;
const PATTERN_WEAKNESS = /\b(weakness(?:es)?|greatest\s+weakness|area\s+of\s+improvement|areas?\s+to\s+improve|struggle\s+with)\b/i;
const PATTERN_MOTIVATION = /\b(why\s+(?:should\s+we\s+hire\s+you|do\s+you\s+want\s+to\s+join|this\s+company|work\s+here|choose\s+this\s+role|fit\s+for\s+this\s+role)|what\s+makes\s+you\s+(?:a\s+good\s+fit|stand\s+out))\b/i;
const PATTERN_CAREER_GOALS = /\b(career\s+goals?|where\s+do\s+you\s+see\s+yourself|5\s+years?|future\s+aspirations?|long.?term\s+goal|career\s+vision)\b/i;
const PATTERN_BEHAVIORAL = /\b(tell\s+me\s+about\s+(?:a\s+)?(?:time|conflict|situation|challenge|failure|project|disagreement|mistake)|conflict|disagreement|disagreed|faced|challenging|pressure|failure|failed|describe\s+a\s+situation|give\s+an\s+example|difficult\s+decision|tight\s+deadline|handled\s+a)\b/i;

const STAR_SITUATION = /\b(situation|context|problem|challenge|scenario|issue|faced|encountered|happened|was|project|deadline|conflict|disagree|critical|bug)\b/i;
const STAR_ACTION = /\b(decided|took|approached|handled|communicated|escalated|prioritized|managed|implemented|chose|resolved|did|made|acted|led|discussed|organized|worked|restructured|fixed|debugged|refactored|initiated|coordinated|scheduled|presented|agreed|suggested|proposed|created|prepared|demonstrated)\b/i;
const STAR_RESULT = /\b(result|outcome|impact|achieved|delivered|improved|reduced|increased|succeeded|learned|realized|ensured|resolved|completion|on\s+time|successfully|received|top\s+marks|demo)\b/i;
const STAR_REFLECTION = /\b(learned|realized|improved|changed|next\s+time|would|better|growth|insight|reflection|takeaway|experience\s+taught|lesson)\b/i;

function classifyHRQuestionType(questionText) {
  const q = String(questionText || "").toLowerCase();
  if (PATTERN_INTRO.test(q)) return "INTRODUCTION";
  if (PATTERN_STRENGTHS.test(q)) return "STRENGTHS";
  if (PATTERN_WEAKNESS.test(q)) return "WEAKNESS";
  if (PATTERN_MOTIVATION.test(q)) return "MOTIVATION";
  if (PATTERN_CAREER_GOALS.test(q)) return "CAREER_GOALS";
  if (PATTERN_BEHAVIORAL.test(q)) return "BEHAVIORAL";
  return "GENERAL_HR";
}

function evaluateIntroductionQuestion(ans, maxScore, qId) {
  const hasEducation = /\b(degree|bachelor|master|b\.?tech|computer\s+science|engineering|college|university|student|graduate|graduated|pursuing|school|academics?|cgpa|gpa)\b/i.test(ans);
  const hasSkills = /\b(javascript|python|java|c\+\+|c#|react|node|express|mongo|sql|html|css|frontend|backend|full.?stack|software|developer|engineer|web|app|development|ai|machine\s+learning|data|devops|git|cloud|aws)\b/i.test(ans);
  const hasProjects = /\b(project|projects|built|building|developed|created|intern|internship|experience|worked\s+on|worked\s+extensively|designed|implemented|portfolio|hackathon|applications?|systems?)\b/i.test(ans);
  const hasInterests = /\b(passionate|enthusiastic|interested|eager|excited|aiming|looking\s+forward|solve\s+problems|grow|learn|focus|interest|aspiring)\b/i.test(ans);
  const hasIdentity = /\b(I am|my name|myself|I'm|background)\b/i.test(ans);

  const dimensionCount = (hasEducation ? 1 : 0) + (hasSkills ? 1 : 0) + (hasProjects ? 1 : 0) + (hasInterests ? 1 : 0) + (hasIdentity ? 1 : 0);

  if (dimensionCount === 0) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: "INCORRECT",
      rating: "Weak",
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 1.0, decisionMaking: 1.0, professionalMaturity: 1.0, confidence: 1.0, selfAwareness: 1.0 },
      reasoningStrengths: [],
      concerns: ["Answer did not contain relevant professional or educational background"],
      feedback: "Answer is irrelevant to an introduction. Please state your educational background, core skills, and technical interests.",
      betterAnswer: "Brief professional introduction: Name, degree/background, core technical skills (e.g. React/Node), key projects built, and career interest.",
    };
  }

  let score = 0;
  const strengths = [];
  const concerns = [];

  if (hasEducation) { score += 5; strengths.push("Presented educational background"); }
  else concerns.push("Educational background could be highlighted");

  if (hasSkills) { score += 7; strengths.push("Highlighted core technical skills & proficiencies"); }
  else concerns.push("Technical skill domain could be highlighted");

  if (hasProjects) { score += 5; strengths.push("Referenced practical projects and experience"); }
  if (hasInterests) { score += 3; strengths.push("Expressed professional enthusiasm and career direction"); }

  score = Math.max(score > 0 ? 6 : 0, Math.min(maxScore, score));
  const status = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
  const rating = score >= 16 ? "Exceptional" : score >= 12 ? "Strong" : score >= 8 ? "Average" : "Weak";

  return {
    questionId: qId,
    score,
    maxScore,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    behavioralDimensions: {
      ownership: 4.5,
      decisionMaking: 4.0,
      professionalMaturity: 4.5,
      confidence: hasIdentity || hasSkills ? 4.5 : 3.5,
      selfAwareness: 4.5,
    },
    reasoningStrengths: strengths,
    concerns,
    feedback: `Deterministic evaluation (AI unavailable). ${strengths.join(", ")}. Score: ${score}/${maxScore}.`,
    betterAnswer: "A concise professional introduction covering education, key technical stack, top projects, and career enthusiasm.",
  };
}

function evaluateStrengthsQuestion(ans, maxScore, qId) {
  const hasStrength = /\b(problem.?solving|quick\s+learner|fast\s+learner|adaptab|debugging|attention\s+to\s+detail|teamwork|collaborat|communicat|persever|discipline|ownership|leadership|work\s+ethic|curious|analytical|hard.?working|dedicated|persistence|resilience)\b/i.test(ans);
  const hasContext = /\b(when|project|coding|team|challenge|complex|learning|work|deadline|pressure|task|build|feature|example|helped|situation)\b/i.test(ans);
  const hasReasoning = REASONING_PATTERN.test(ans) || /\b(able\s+to|efficient|effective|quality|deliver|succeed|impact)\b/i.test(ans);

  if (!hasStrength && !hasContext) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: "INCORRECT",
      rating: "Weak",
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 1.0, decisionMaking: 1.0, professionalMaturity: 1.0, confidence: 1.0, selfAwareness: 1.0 },
      reasoningStrengths: [],
      concerns: ["Answer did not identify recognizable professional strengths"],
      feedback: "Answer does not identify relevant professional strengths or abilities.",
      betterAnswer: "Identify 1-2 core strengths (e.g. quick learner, problem solving) backed by practical workplace examples.",
    };
  }

  let score = 0;
  const strengths = [];
  const concerns = [];

  if (hasStrength) { score += 10; strengths.push("Identified clear professional strengths"); }
  else concerns.push("Could articulate primary strengths more clearly");

  if (hasContext) { score += 6; strengths.push("Provided practical application context"); }
  else concerns.push("Adding a concrete example would strengthen the response");

  if (hasReasoning) { score += 4; strengths.push("Explained the positive impact of these strengths"); }

  score = Math.max(score > 0 ? 6 : 0, Math.min(maxScore, score));
  const status = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
  const rating = score >= 16 ? "Exceptional" : score >= 12 ? "Strong" : score >= 8 ? "Average" : "Weak";

  return {
    questionId: qId,
    score,
    maxScore,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    behavioralDimensions: {
      ownership: 4.5,
      decisionMaking: 4.0,
      professionalMaturity: 4.5,
      confidence: 4.5,
      selfAwareness: hasStrength ? 4.5 : 3.0,
    },
    reasoningStrengths: strengths,
    concerns,
    feedback: `Deterministic evaluation (AI unavailable). ${strengths.join(", ")}. Score: ${score}/${maxScore}.`,
    betterAnswer: "State your top strengths (e.g. fast learner, problem solving) and give a brief real-world scenario demonstrating them.",
  };
}

function evaluateWeaknessQuestion(ans, maxScore, qId) {
  const hasWeakness = /\b(perfectionis|public\s+speaking|saying\s+no|delegat|overthink|hesitant|impatient|new\s+technolog|time\s+management|asking\s+for\s+help|nervous|speaking\s+up|taking\s+on\s+too\s+much|difficulty|struggle|weakness)\b/i.test(ans);
  const hasMitigation = /\b(working\s+on|improving|practice|practiced|practicing|volunteered|volunteer|learning|courses?|reminders?|calendar|feedback|conscious|actively|now\s+I|mitigate|overcome|handle|started|track|routine|address|presentation|demos?)\b/i.test(ans);
  const hasReflection = /\b(learned|improved|progress|better|growth|mindset|manage|developed|realized|aware)\b/i.test(ans);

  if (!hasWeakness && !hasMitigation) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: "INCORRECT",
      rating: "Weak",
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 1.0, decisionMaking: 1.0, professionalMaturity: 1.0, confidence: 1.0, selfAwareness: 1.0 },
      reasoningStrengths: [],
      concerns: ["Answer did not identify an area of improvement or demonstrate self-awareness"],
      feedback: "Answer does not address weakness or constructive areas of improvement.",
      betterAnswer: "Name a genuine weakness (e.g. public speaking, overthinking) and detail the concrete steps you are taking to improve.",
    };
  }

  let score = 0;
  const strengths = [];
  const concerns = [];

  if (hasWeakness) { score += 8; strengths.push("Demonstrated candid self-awareness of an area for improvement"); }
  else concerns.push("Identify a specific professional area for development");

  if (hasMitigation) { score += 8; strengths.push("Outlined proactive steps being taken to improve"); }
  else concerns.push("Mentioning actionable mitigation steps would make the answer stronger");

  if (hasReflection) { score += 4; strengths.push("Demonstrated a growth mindset and self-reflection"); }

  score = Math.max(score > 0 ? 6 : 0, Math.min(maxScore, score));
  const status = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
  const rating = score >= 16 ? "Exceptional" : score >= 12 ? "Strong" : score >= 8 ? "Average" : "Weak";

  return {
    questionId: qId,
    score,
    maxScore,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    behavioralDimensions: {
      ownership: 4.5,
      decisionMaking: 4.0,
      professionalMaturity: hasMitigation ? 4.8 : 3.5,
      confidence: 4.0,
      selfAwareness: hasWeakness ? 4.8 : 3.0,
    },
    reasoningStrengths: strengths,
    concerns,
    feedback: `Deterministic evaluation (AI unavailable). ${strengths.join(", ")}. Score: ${score}/${maxScore}.`,
    betterAnswer: "Demonstrate self-awareness by acknowledging a manageable weakness and explaining how you actively mitigate it.",
  };
}

function evaluateMotivationQuestion(ans, maxScore, qId) {
  const hasSkills = /\b(skills?|technical|experience|knowledge|proficien|strong\s+foundation|hands.?on|projects?|problem.?solving|capabilities|ability)\b/i.test(ans);
  const hasValue = /\b(contribute|value|impact|solve|deliver|help|grow|team|build|quality|fast\s+learner|dedicated|reliable|results|asset)\b/i.test(ans);
  const hasAlignment = /\b(culture|mission|vision|environment|opportunity|align|excited|passion|innovat|growth|learn|reputation|company|role|position)\b/i.test(ans);
  const hasReasoning = REASONING_PATTERN.test(ans) || /\b(because|fit|match|complement|bring|drive|commitment)\b/i.test(ans);

  if (!hasSkills && !hasValue) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: "INCORRECT",
      rating: "Weak",
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 1.0, decisionMaking: 1.0, professionalMaturity: 1.0, confidence: 1.0, selfAwareness: 1.0 },
      reasoningStrengths: [],
      concerns: ["Answer did not articulate a concrete value proposition or relevant technical skills"],
      feedback: "Answer does not provide clear reasons, skills, or value proposition for the role.",
      betterAnswer: "Connect your core technical skills, work ethic, and ability to contribute directly to the team's success.",
    };
  }

  let score = 0;
  const strengths = [];
  const concerns = [];

  if (hasSkills) { score += 7; strengths.push("Communicated relevant technical proficiencies and background"); }
  if (hasValue) { score += 7; strengths.push("Articulated clear value proposition and commitment to team success"); }
  if (hasAlignment) { score += 4; strengths.push("Expressed role alignment and enthusiasm"); }
  if (hasReasoning) { score += 2; strengths.push("Provided logical justification for candidature"); }

  score = Math.max(score > 0 ? 6 : 0, Math.min(maxScore, score));
  const status = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
  const rating = score >= 16 ? "Exceptional" : score >= 12 ? "Strong" : score >= 8 ? "Average" : "Weak";

  return {
    questionId: qId,
    score,
    maxScore,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    behavioralDimensions: {
      ownership: 4.5,
      decisionMaking: 4.0,
      professionalMaturity: 4.5,
      confidence: 4.5,
      selfAwareness: 4.0,
    },
    reasoningStrengths: strengths,
    concerns,
    feedback: `Deterministic evaluation (AI unavailable). ${strengths.join(", ")}. Score: ${score}/${maxScore}.`,
    betterAnswer: "Highlight your key skills, willingness to learn fast, and how you will deliver immediate value to the organization.",
  };
}

function evaluateCareerGoalsQuestion(ans, maxScore, qId) {
  const hasProgression = /\b(senior|lead|architect|tech\s+lead|specialist|expert|master|core\s+contributor|manager|leadership|role|position|level)\b/i.test(ans);
  const hasTechnicalDepth = /\b(system\s+design|architecture|cloud|scalab|deep\s+dive|mastering|technolog|full.?stack|best\s+practices|domain|engineering|tools)\b/i.test(ans);
  const hasLearning = /\b(learning|growing|developing|continuous|skills|knowledge|certificat|expand|improve)\b/i.test(ans);
  const hasImpact = /\b(mentoring|guiding|impact|ownership|responsibility|driving|delivering|business\s+value|contribut)\b/i.test(ans);

  if (!hasProgression && !hasTechnicalDepth && !hasLearning) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: "INCORRECT",
      rating: "Weak",
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 1.0, decisionMaking: 1.0, professionalMaturity: 1.0, confidence: 1.0, selfAwareness: 1.0 },
      reasoningStrengths: [],
      concerns: ["Answer did not state career aspirations or professional growth direction"],
      feedback: "Answer does not outline career goals or professional growth plans.",
      betterAnswer: "Outline a 3-5 year trajectory aiming to deepen technical expertise, take ownership of critical systems, and mentor junior teammates.",
    };
  }

  let score = 0;
  const strengths = [];
  const concerns = [];

  if (hasProgression) { score += 7; strengths.push("Articulated clear career progression aspirations"); }
  if (hasTechnicalDepth) { score += 6; strengths.push("Demonstrated ambition to master technical domain and architecture"); }
  if (hasLearning) { score += 4; strengths.push("Emphasized continuous skill development and learning"); }
  if (hasImpact) { score += 3; strengths.push("Highlighted broader organizational impact and mentorship"); }

  score = Math.max(score > 0 ? 6 : 0, Math.min(maxScore, score));
  const status = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
  const rating = score >= 16 ? "Exceptional" : score >= 12 ? "Strong" : score >= 8 ? "Average" : "Weak";

  return {
    questionId: qId,
    score,
    maxScore,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    behavioralDimensions: {
      ownership: 4.5,
      decisionMaking: 4.0,
      professionalMaturity: 4.5,
      confidence: 4.5,
      selfAwareness: 4.2,
    },
    reasoningStrengths: strengths,
    concerns,
    feedback: `Deterministic evaluation (AI unavailable). ${strengths.join(", ")}. Score: ${score}/${maxScore}.`,
    betterAnswer: "Present a balanced plan focused on technical mastery, increasing project ownership, and collaborative leadership.",
  };
}

function evaluateBehavioralQuestion(ans, maxScore, qId) {
  const hasSituation = STAR_SITUATION.test(ans);
  const hasAction = STAR_ACTION.test(ans);
  const hasResult = STAR_RESULT.test(ans);
  const hasReflection = STAR_REFLECTION.test(ans);
  const hasReasoning = REASONING_PATTERN.test(ans);
  const hasOwnership = /\b(I |my |myself|took responsibility|my role|I decided|I chose|I handled|I escalated|I managed|I initiated)\b/i.test(ans);

  if (!hasSituation && !hasAction && !hasResult) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: "INCORRECT",
      rating: "Weak",
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 1.0, decisionMaking: 1.0, professionalMaturity: 1.0, confidence: 1.0, selfAwareness: 1.0 },
      reasoningStrengths: [],
      concerns: ["Answer did not describe a behavioral situation or action taken"],
      feedback: "Answer does not describe a clear workplace scenario or actions taken.",
      betterAnswer: "Structure using STAR: describe the Situation, Task, specific Action you took with ownership, and the measurable Result.",
    };
  }

  let score = 0;
  const strengths = [];
  const concerns = [];

  if (hasSituation) { score += 4; strengths.push("Described context and scenario"); }
  else concerns.push("Situation context was brief");

  if (hasAction) {
    score += 8;
    strengths.push("Articulated specific proactive actions taken");
    if (hasOwnership) { score += 2; strengths.push("Demonstrated strong personal ownership"); }
  } else {
    concerns.push("Action steps not explicitly articulated");
  }

  if (hasResult) { score += 4; strengths.push("Communicated measurable outcomes and resolution"); }
  else concerns.push("Outcome or business impact omitted");

  if (hasReasoning) { score += 1; strengths.push("Explained decision-making rationale"); }
  if (hasReflection) { score += 1; strengths.push("Demonstrated self-reflection & key learnings"); }

  score = Math.max(score > 0 ? 6 : 0, Math.min(maxScore, score));
  const status = score >= maxScore * 0.8 ? "CORRECT" : score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
  const rating = score >= 16 ? "Exceptional" : score >= 12 ? "Strong" : score >= 8 ? "Average" : "Weak";

  return {
    questionId: qId,
    score,
    maxScore,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    behavioralDimensions: {
      ownership: hasOwnership ? 4.8 : 3.5,
      decisionMaking: hasAction ? 4.5 : 2.5,
      professionalMaturity: hasReflection ? 4.5 : 3.5,
      confidence: 4.2,
      selfAwareness: 4.0,
    },
    reasoningStrengths: strengths,
    concerns,
    feedback: `Deterministic evaluation (AI unavailable). ${strengths.join(", ")}. Score: ${score}/${maxScore}.`,
    betterAnswer: "A complete STAR response: Situation, Task, Action with personal accountability, and positive Result.",
  };
}

function evaluateGeneralHRQuestion(ans, maxScore, qId, qText) {
  const gate = checkAnswerGate(ans, { question: qText });
  if (gate.isGateTriggered) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: gate.status,
      rating: gate.rating,
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 0, decisionMaking: 0, professionalMaturity: 0, confidence: 0, selfAwareness: 0 },
      reasoningStrengths: [],
      concerns: ["Question was not attempted or was declined"],
      feedback: gate.feedback,
      betterAnswer: "Provide a thoughtful, professional response addressing the question asked.",
    };
  }

  const cleanAns = ans.trim();
  const words = cleanAns.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const hasReasoning = REASONING_PATTERN.test(cleanAns);
  const hasProfessionalTerms = /\b(communication|collaboration|responsibility|ethics|integrity|learning|problem.?solving|adaptability|accountability|mentorship|initiative|stakeholders?|honest|transparen|adhere|standards?|growth|teamwork|ownership)\b/i.test(cleanAns);

  // Require concrete professional terminology / ethics / accountability.
  // Vacuous tautologies like "I work with my team because of work in the project" must get 0.
  if (!hasProfessionalTerms || wordCount < 4) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: "INCORRECT",
      rating: "Weak",
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 1.0, decisionMaking: 1.0, professionalMaturity: 1.0, confidence: 1.0, selfAwareness: 1.0 },
      reasoningStrengths: [],
      concerns: ["Answer lacks substantive professional principles, workplace competencies, or specific ethics/accountability context"],
      feedback: "Answer does not provide substantive professional reasoning or evidence.",
      betterAnswer: "Provide a thoughtful, professional response demonstrating ethics, personal accountability, and clear communication standards.",
    };
  }

  let score = 0;
  const strengths = [];
  const concerns = [];

  score += 10;
  strengths.push("Demonstrated professional competency and workplace ethics");

  if (hasReasoning) {
    score += 6;
    strengths.push("Articulated clear reasoning and rationale");
  }

  if (wordCount >= 20 && score >= 8) {
    score += 4;
    strengths.push("Provided detailed context and elaboration");
  }

  score = Math.max(0, Math.min(maxScore, score));
  const status = score >= maxScore * 0.8 ? "CORRECT" : score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
  const rating = score >= 16 ? "Exceptional" : score >= 12 ? "Strong" : score >= 8 ? "Average" : "Weak";

  return {
    questionId: qId,
    score,
    maxScore,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    behavioralDimensions: { ownership: 4.0, decisionMaking: 4.0, professionalMaturity: 4.0, confidence: 4.0, selfAwareness: 4.0 },
    reasoningStrengths: strengths,
    concerns,
    feedback: score > 0
      ? `Deterministic evaluation (AI unavailable). ${strengths.join(", ")}. Score: ${score}/${maxScore}.`
      : "Answer does not demonstrate adequate professional substance or relevant reasoning.",
    betterAnswer: "Provide a detailed answer with specific examples and sound reasoning.",
  };
}

export function evaluateHRQuestion(q) {
  const ans = String(q.candidateAnswer || "").trim();
  const maxScore = Number(q.maxScore || q.maxMarks || 20);
  const qId = String(q.questionId || q.id || "");
  const qText = String(q.question || "");

  // 1. Mandatory Answer Gate Pre-Check
  const gate = checkAnswerGate(ans, { question: qText });
  if (gate.isGateTriggered) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: gate.status,
      rating: gate.rating,
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 0, decisionMaking: 0, professionalMaturity: 0, confidence: 0, selfAwareness: 0 },
      reasoningStrengths: [],
      concerns: ["Question was not attempted or was declined"],
      feedback: gate.feedback,
      betterAnswer: "Provide a complete and thoughtful response addressing the question asked.",
    };
  }

  const qType = classifyHRQuestionType(qText);

  if (qType === "INTRODUCTION") {
    return evaluateIntroductionQuestion(ans, maxScore, qId);
  } else if (qType === "STRENGTHS") {
    return evaluateStrengthsQuestion(ans, maxScore, qId);
  } else if (qType === "WEAKNESS") {
    return evaluateWeaknessQuestion(ans, maxScore, qId);
  } else if (qType === "MOTIVATION") {
    return evaluateMotivationQuestion(ans, maxScore, qId);
  } else if (qType === "CAREER_GOALS") {
    return evaluateCareerGoalsQuestion(ans, maxScore, qId);
  } else if (qType === "BEHAVIORAL") {
    return evaluateBehavioralQuestion(ans, maxScore, qId);
  } else {
    return evaluateGeneralHRQuestion(ans, maxScore, qId, qText);
  }
}

// -----------------------------------------------------------------------
// 7. BATCH EXPORTS
// -----------------------------------------------------------------------

export function generateDeterministicTechnicalEvaluation(questionsToEvaluate, reason = "AI provider unavailable") {
  console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=technical\nreason=${reason}\nevaluationSource=deterministic_nlp\ncount=${questionsToEvaluate.length}\n`);

  const evaluations = questionsToEvaluate.map(evaluateTechnicalQuestion);
  const totalScore = Math.min(100, evaluations.reduce((sum, e) => sum + e.score, 0));
  const maxScoreTotal = 100;
  const percentage = Math.round((totalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 80) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  const answeredCount = evaluations.filter((e) => e.status !== "NOT_ATTEMPTED").length;

  return {
    evaluations,
    totalScore,
    maxScore: maxScoreTotal,
    percentage,
    overallRating,
    strengths: answeredCount > 0 ? ["Technical answers evaluated against reference knowledge and syntax rules"] : [],
    weaknesses: ["AI evaluation was unavailable; deterministic NLP & syntax evaluation applied"],
    finalFeedback: `Technical evaluation completed using deterministic reference-aware fallback (${reason}). Scores reflect verified syntax, commands, and concept coverage.`,
    isFallback: true,
  };
}

export function generateDeterministicProjectEvaluation(questionsToEvaluate, reason = "AI provider unavailable") {
  console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=project\nreason=${reason}\nevaluationSource=deterministic_nlp\ncount=${questionsToEvaluate.length}\n`);

  const evaluations = questionsToEvaluate.map(evaluateProjectQuestion);
  const totalScore = Math.min(100, evaluations.reduce((sum, e) => sum + e.score, 0));
  const maxScoreTotal = 100;
  const percentage = Math.round((totalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 80) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  return {
    evaluations,
    totalScore,
    maxScore: maxScoreTotal,
    percentage,
    overallRating,
    strengths: ["Project and architectural reasoning evaluated using rubric criteria"],
    weaknesses: ["AI evaluation was unavailable; deterministic rubric scoring applied"],
    finalFeedback: `Project evaluation completed using deterministic fallback (${reason}).`,
    isFallback: true,
  };
}

export function generateDeterministicHREvaluation(qaPairs, reason = "AI provider unavailable") {
  console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=hr\nreason=${reason}\nevaluationSource=deterministic_nlp\ncount=${qaPairs.length}\n`);

  const evaluations = qaPairs.map((pair) =>
    evaluateHRQuestion({
      questionId: String(pair.questionId || pair.id || ""),
      candidateAnswer: pair.candidateAnswer,
      maxScore: 20,
      question: pair.question,
    })
  );

  const totalScore = Math.min(60, evaluations.reduce((sum, e) => sum + e.score, 0));
  const maxScoreTotal = 60;
  const percentage = Math.round((totalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 80) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  return {
    evaluations,
    totalScore,
    maxScore: maxScoreTotal,
    percentage,
    overallRating,
    behavioralProfile: {
      ownership: Number((evaluations.reduce((s, e) => s + (e.behavioralDimensions?.ownership || 0), 0) / (evaluations.length || 1)).toFixed(1)),
      decisionMaking: Number((evaluations.reduce((s, e) => s + (e.behavioralDimensions?.decisionMaking || 0), 0) / (evaluations.length || 1)).toFixed(1)),
      professionalMaturity: Number((evaluations.reduce((s, e) => s + (e.behavioralDimensions?.professionalMaturity || 0), 0) / (evaluations.length || 1)).toFixed(1)),
      confidence: Number((evaluations.reduce((s, e) => s + (e.behavioralDimensions?.confidence || 0), 0) / (evaluations.length || 1)).toFixed(1)),
      selfAwareness: Number((evaluations.reduce((s, e) => s + (e.behavioralDimensions?.selfAwareness || 0), 0) / (evaluations.length || 1)).toFixed(1)),
    },
    consistencyObservations: [],
    strengths: ["HR answers evaluated using question-aware rubrics (Introduction, Strengths, Weakness, Motivation, STAR)"],
    areasForImprovement: ["AI evaluation was unavailable; deterministic rubric scoring applied"],
    finalFeedback: `HR evaluation completed using deterministic question-aware fallback (${reason}).`,
    isFallback: true,
  };
}
