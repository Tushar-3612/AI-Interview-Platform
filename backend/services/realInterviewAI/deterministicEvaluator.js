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
    else if (w.endsWith("tion")) w = w.slice(0, -4);  // validation → valid
    else if (w.endsWith("ed")) w = w.slice(0, -2);    // implemented → implement
    else if (w.endsWith("er")) w = w.slice(0, -2);    // controller → controll
    else if (w.endsWith("es")) w = w.slice(0, -2);    // caches → cach
    else if (w.endsWith("s") && w.length > 4) w = w.slice(0, -1); // tokens → token
  }
  return SYNONYM_MAP[w] || w;
}

/**
 * Extract normalized unigrams and compound bigrams from text.
 */
function extractConceptTokens(text) {
  if (!text || typeof text !== "string") return { unigrams: new Set(), bigrams: new Set() };
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const unigrams = new Set();
  const bigrams = new Set();

  for (let i = 0; i < words.length; i++) {
    const t = normalizeToken(words[i]);
    if (t.length >= 3) unigrams.add(t);
    if (i + 1 < words.length) {
      const b1 = normalizeToken(words[i]);
      const b2 = normalizeToken(words[i + 1]);
      if (b1.length >= 3 && b2.length >= 3) {
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
  const isKeywordTarget =
    /what\s+keyword|which\s+keyword|keyword\s+is\s+used|http\s+method|status\s+code|protocol|time\s+complexity/i.test(cleanQuestion) ||
    /^[a-zA-Z0-9_\$#\+\-\[\]\(\)\{\}\.\/]{1,25}$/.test(cleanAns.trim()) ||
    /^[a-zA-Z0-9_\$#\+\-\[\]\(\)\{\}\.\/]{1,25}$/.test(cleanExp.trim());

  if (!isKeywordTarget) return null;

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

function evaluateTechnicalQuestion(q) {
  const ans = String(q.candidateAnswer || "").trim();
  const expected = String(q.expectedKnowledge || q.expectedAnswer || q.referenceAnswer || q.question || "").trim();
  const maxScore = Number(q.maxScore || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5));
  const qId = String(q.questionId || q.id || "");

  // 1. Unanswered check
  if (
    !ans ||
    ans === "(No answer submitted)" ||
    ans === "(No answer provided)" ||
    ans.toLowerCase() === "not answered" ||
    ans.toLowerCase() === "not submitted" ||
    ans.toLowerCase() === "none" ||
    ans.toLowerCase() === "null"
  ) {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      difficulty: q.difficulty,
      status: "NOT_ATTEMPTED",
      rating: "Not Attempted",
      evaluationSource: "deterministic_nlp",
      correctPoints: [],
      missingPoints: ["Question was not attempted"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: "Question was not attempted.",
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
  if (hasNegation && unigramCoverage > 0.15) evidenceRatio += 0.05;

  let finalScore = 0;
  if (contradictions.length > 0) {
    finalScore = 0;
  } else if (unigramCoverage >= 0.45 || (evidenceRatio >= 0.38 && matchedUnigrams >= 3)) {
    finalScore = maxScore;
  } else if (evidenceRatio >= 0.25 && matchedUnigrams >= 2) {
    finalScore = Math.max(1, Math.round(maxScore * 0.60));
  } else if (evidenceRatio >= 0.10 && matchedUnigrams >= 1) {
    finalScore = Math.max(1, Math.round(maxScore * 0.35));
  } else {
    finalScore = 0;
  }

  finalScore = Math.max(0, Math.min(maxScore, finalScore));

  let status = "INCORRECT";
  let rating = "Weak";

  if (contradictions.length > 0) {
    status = "INCORRECT";
    rating = "Weak";
  } else if (finalScore >= maxScore * 0.85) {
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

function evaluateProjectQuestion(q) {
  const ans = String(q.candidateAnswer || "").trim();
  const expected = String(q.expectedKnowledge || q.question || "").trim();
  const maxScore = Number(q.maxScore || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10));
  const qId = String(q.questionId || q.id || "");

  if (!ans || ans === "(No answer submitted)" || ans.toLowerCase() === "not answered") {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      difficulty: q.difficulty,
      status: "NOT_ATTEMPTED",
      rating: "Not Attempted",
      evaluationSource: "deterministic_nlp",
      correctPoints: [],
      missingPoints: ["Question was not attempted"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: "Question was not attempted.",
      betterAnswer: expected,
    };
  }

  const cleanAns = normalizeTechnicalExpression(ans);
  const cleanExp = normalizeTechnicalExpression(expected);
  const candTokens = extractConceptTokens(cleanAns);
  const expTokens = extractConceptTokens(cleanExp);

  let matchedUnigrams = 0;
  for (const u of expTokens.unigrams) {
    if (candTokens.unigrams.has(u)) matchedUnigrams++;
  }
  const unigramCoverage = expTokens.unigrams.size > 0 ? matchedUnigrams / expTokens.unigrams.size : 0;

  const hasArchitecture = /\b(architect|design|structur|pattern|layer|module|service|api|flow|pipeline|endpoint|database|schema|auth|middleware|deploy|scale|bottleneck|trade.?off|decision|chose|because|instead|rather|performance|security|scalab|availability)\b/i.test(cleanAns);
  const hasDebugging = /\b(debug|error|fix|issue|problem|resolv|found|discover|root.?cause|stack.?trace|log|monitor)\b/i.test(cleanAns);
  const hasReasoning = REASONING_PATTERN.test(cleanAns);

  let scoreRatio = unigramCoverage;
  if (hasArchitecture) scoreRatio += 0.15;
  if (hasReasoning) scoreRatio += 0.10;
  if (hasDebugging) scoreRatio += 0.05;

  let score = Math.max(0, Math.min(maxScore, Math.round(scoreRatio * maxScore)));
  const status = score >= maxScore * 0.8 ? "CORRECT" : score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
  const rating = score >= maxScore * 0.8 ? "Strong" : score >= maxScore * 0.4 ? "Acceptable" : "Weak";

  return {
    questionId: qId,
    score,
    maxScore,
    difficulty: q.difficulty,
    status,
    rating,
    evaluationSource: "deterministic_nlp",
    correctPoints: score > 0 ? [`Demonstrated project and architectural reasoning (~${Math.round(unigramCoverage * 100)}% alignment)`] : [],
    missingPoints: score < maxScore * 0.8 ? ["Specific implementation decisions and trade-offs could be elaborated further"] : [],
    incorrectPoints: [],
    grammarIssues: [],
    feedback: `Deterministic evaluation (AI unavailable). Project concept coverage: ~${Math.round(unigramCoverage * 100)}%. Score: ${score}/${maxScore}.`,
    betterAnswer: expected,
  };
}

// -----------------------------------------------------------------------
// 6. HR ROUND DETERMINISTIC EVALUATION
// -----------------------------------------------------------------------

const STAR_SITUATION = /\b(situation|context|problem|challenge|scenario|issue|faced|encountered|happened|was)\b/i;
const STAR_ACTION = /\b(decided|took|approached|handled|communicated|escalated|prioritized|managed|implemented|chose|resolved|did|made|acted|led)\b/i;
const STAR_RESULT = /\b(result|outcome|impact|achieved|delivered|improved|reduced|increased|succeeded|learned|realized|ensured|resolved|completion)\b/i;
const STAR_REFLECTION = /\b(learned|realized|improved|changed|next time|would|better|growth|insight|reflection|take away)\b/i;

function evaluateHRQuestion(q) {
  const ans = String(q.candidateAnswer || "").trim();
  const maxScore = Number(q.maxScore || 20);
  const qId = String(q.questionId || q.id || "");

  if (!ans || ans === "(No answer provided)" || ans.toLowerCase() === "not answered") {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      status: "NOT_ATTEMPTED",
      rating: "Not Attempted",
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 0, decisionMaking: 0, professionalMaturity: 0, confidence: 0 },
      reasoningStrengths: [],
      concerns: ["Question was not attempted"],
      feedback: "Question was not attempted.",
      betterAnswer: "A structured behavioral response addressing the situation, action taken, and outcome achieved.",
    };
  }

  const hasSituation = STAR_SITUATION.test(ans);
  const hasAction = STAR_ACTION.test(ans);
  const hasResult = STAR_RESULT.test(ans);
  const hasReflection = STAR_REFLECTION.test(ans);
  const hasReasoning = REASONING_PATTERN.test(ans);
  const hasOwnership = /\b(I |my |myself|took responsibility|my fault|I decided|I chose|I handled|I escalated|I managed)\b/i.test(ans);

  let score = 0;
  const strengths = [];
  const concerns = [];

  if (hasSituation) { score += 3; strengths.push("Described context and scenario"); }
  else concerns.push("Situation context was brief");

  if (hasAction) {
    score += 6;
    strengths.push("Articulated specific actions taken");
    if (hasOwnership) { score += 2; strengths.push("Demonstrated strong personal ownership"); }
  } else {
    concerns.push("Action steps not explicitly articulated");
  }

  if (hasResult) { score += 5; strengths.push("Communicated measurable outcomes/results"); }
  else concerns.push("Outcome or business impact omitted");

  if (hasReasoning) { score += 2; strengths.push("Explained decision-making rationale"); }
  if (hasReflection) { score += 2; strengths.push("Demonstrated self-reflection & key learnings"); }

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
    behavioralDimensions: {
      ownership: hasOwnership ? 4.5 : 3.0,
      decisionMaking: hasAction ? 4.0 : 2.5,
      professionalMaturity: hasReflection ? 4.5 : 3.5,
      confidence: 4.0,
    },
    reasoningStrengths: strengths,
    concerns,
    feedback: `Deterministic behavioral evaluation (AI unavailable). Score: ${score}/${maxScore}.`,
    betterAnswer: "A complete STAR response: Situation, Task, Action with ownership, and measurable Result.",
  };
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
      ownership: evaluations.reduce((s, e) => s + (e.behavioralDimensions?.ownership || 0), 0) / (evaluations.length || 1),
      decisionMaking: evaluations.reduce((s, e) => s + (e.behavioralDimensions?.decisionMaking || 0), 0) / (evaluations.length || 1),
      professionalMaturity: evaluations.reduce((s, e) => s + (e.behavioralDimensions?.professionalMaturity || 0), 0) / (evaluations.length || 1),
    },
    consistencyObservations: [],
    strengths: ["Behavioral answers evaluated using STAR framework detection"],
    areasForImprovement: ["AI evaluation was unavailable; STAR completeness scoring used"],
    finalFeedback: `HR evaluation completed using deterministic STAR framework fallback (${reason}).`,
    isFallback: true,
  };
}
