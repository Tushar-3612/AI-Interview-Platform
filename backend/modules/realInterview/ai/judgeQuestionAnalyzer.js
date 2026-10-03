/**
 * judgeQuestionAnalyzer.js
 * =========================
 * Dynamically analyzes an interview question, its expected reference criteria,
 * and round context without hardcoding question IDs or fixed text strings.
 *
 * Produces a structured analysis of question type, expected deliverables,
 * cognitive requirements, and whether short answers can be fully sufficient.
 */

// Classification regexes
const SQL_PATTERN = /\b(sql|query|queries|database\s+query|select\s+\*|select\s+from|insert\s+into|update\s+set|delete\s+from|create\s+table|join\s+table|group\s+by|order\s+by)\b/i;
const CLI_PATTERN = /\b(command|cli|terminal|bash|shell|linux|git|docker|kubectl|npm|pip|curl|chmod|systemctl|push|commit|branch|clone|pull|checkout)\b/i;
const OUTPUT_PATTERN = /\b(what\s+is\s+the\s+output|what\s+will\s+(?:this\s+code\s+)?print|what\s+does\s+(?:this\s+code\s+)?output|predicted\s+output|printed\s+result)\b/i;
const CODE_PATTERN = /\b(write\s+(?:a\s+)?(?:code|function|method|class|snippet|query)|how\s+do\s+you\s+(?:declare|initialize|access|write|create|implement)|syntax\s+for|code\s+to\s+implement|code\s+to\s+create)\b/i;
const KEYWORD_PATTERN = /\b(what\s+keyword|which\s+keyword|keyword\s+is\s+used|http\s+method|http\s+status\s+code|status\s+code|time\s+complexity|space\s+complexity|which\s+protocol|what\s+protocol|name\s+the\s+protocol)\b/i;
const COMPARISON_PATTERN = /\b(difference\s+between|compare\s+and\s+contrast|versus|vs\.?|how\s+does\s+.*\s+differ\s+from|advantages\s+and\s+disadvantages|trade.?offs?\s+between)\b/i;
const DEFINITION_PATTERN = /\b(what\s+is\s+(?:a|an|the)|define\s+|definition\s+of|what\s+does\s+.*\s+mean|what\s+do\s+you\s+understand\s+by)\b/i;
const ARCHITECTURE_PATTERN = /\b(architecture|design|system\s+design|scalab|high\s+availability|load\s+balanc|microservice|distributed|failover|caching\s+strategy|pipeline|data\s+flow|api\s+flow)\b/i;
const DEBUGGING_PATTERN = /\b(debug|how\s+would\s+you\s+fix|troubleshoot|root\s+cause|stack\s+trace|memory\s+leak|performance\s+bottleneck|resolve\s+the\s+issue|investigate\s+an\s+error)\b/i;

// HR Classification regexes
const HR_INTRO_PATTERN = /\b(introduce\s+yourself|tell\s+me\s+about\s+yourself|walk\s+me\s+through\s+your\s+resume|who\s+are\s+you|brief\s+introduction)\b/i;
const HR_STRENGTHS_PATTERN = /\b(strengths?|strongest\s+asset|greatest\s+strength|core\s+competenc|superpower)\b/i;
const HR_WEAKNESS_PATTERN = /\b(weakness(?:es)?|greatest\s+weakness|area\s+of\s+improvement|areas?\s+to\s+improve|struggle\s+with)\b/i;
const HR_MOTIVATION_PATTERN = /\b(why\s+(?:should\s+we\s+hire\s+you|do\s+you\s+want\s+to\s+join|this\s+company|work\s+here|choose\s+this\s+role|fit\s+for\s+this\s+role)|what\s+makes\s+you\s+(?:a\s+good\s+fit|stand\s+out))\b/i;
const HR_CAREER_GOALS_PATTERN = /\b(career\s+goals?|where\s+do\s+you\s+see\s+yourself|5\s+years?|future\s+aspirations?|long.?term\s+goal|career\s+vision)\b/i;
const HR_BEHAVIORAL_PATTERN = /\b(tell\s+me\s+about\s+(?:a\s+)?(?:time|conflict|situation|challenge|failure|project|disagreement|mistake)|conflict|disagreement|disagreed|faced|challenging|pressure|failure|failed|describe\s+a\s+situation|give\s+an\s+example|difficult\s+decision|tight\s+deadline|handled\s+a)\b/i;

/**
 * Classifies question type and extracts deliverable metadata.
 *
 * @param {object} params
 * @param {string} params.question
 * @param {string} [params.expectedKnowledge]
 * @param {number} [params.maxMarks=5]
 * @param {string} [params.round="technical"]
 * @returns {object} Structured question analysis
 */
export function analyzeQuestion({
  question = "",
  expectedKnowledge = "",
  maxMarks = 5,
  round = "technical",
}) {
  const cleanQ = String(question || "").trim();
  const cleanExp = String(expectedKnowledge || "").trim();
  const lowerRound = String(round || "technical").toLowerCase();

  // 1. HR Round Analysis
  if (lowerRound === "hr" || lowerRound === "behavioral") {
    if (HR_INTRO_PATTERN.test(cleanQ)) {
      return {
        questionType: "HR_INTRODUCTION",
        intent: "Professional self-introduction covering education, core skills, and technical interests.",
        canShortAnswerSuffice: false,
        isReasoningRequired: false,
        isSTARRequired: false,
        expectedDeliverables: ["Education / Academic background", "Core technical skills", "Practical projects built", "Career enthusiasm"],
        keyConcepts: ["education", "skills", "projects", "interests"],
      };
    }
    if (HR_STRENGTHS_PATTERN.test(cleanQ)) {
      return {
        questionType: "HR_STRENGTHS",
        intent: "Identify core professional strengths with practical contextual evidence.",
        canShortAnswerSuffice: false,
        isReasoningRequired: true,
        isSTARRequired: false,
        expectedDeliverables: ["Identified strengths", "Practical workplace context", "Impact/Value"],
        keyConcepts: ["strengths", "problem-solving", "learning", "teamwork"],
      };
    }
    if (HR_WEAKNESS_PATTERN.test(cleanQ)) {
      return {
        questionType: "HR_WEAKNESS",
        intent: "Self-awareness of a genuine area for improvement accompanied by actionable mitigation steps.",
        canShortAnswerSuffice: false,
        isReasoningRequired: true,
        isSTARRequired: false,
        expectedDeliverables: ["Identified weakness", "Actionable mitigation steps", "Growth mindset"],
        keyConcepts: ["weakness", "mitigation", "growth", "improvement"],
      };
    }
    if (HR_MOTIVATION_PATTERN.test(cleanQ)) {
      return {
        questionType: "HR_MOTIVATION",
        intent: "Articulate value proposition, relevant capabilities, and role alignment.",
        canShortAnswerSuffice: false,
        isReasoningRequired: true,
        isSTARRequired: false,
        expectedDeliverables: ["Relevant technical proficiencies", "Value proposition", "Role alignment"],
        keyConcepts: ["skills", "contribution", "alignment", "dedication"],
      };
    }
    if (HR_CAREER_GOALS_PATTERN.test(cleanQ)) {
      return {
        questionType: "HR_CAREER_GOALS",
        intent: "3-5 year professional trajectory focusing on technical depth, ownership, and learning.",
        canShortAnswerSuffice: false,
        isReasoningRequired: true,
        isSTARRequired: false,
        expectedDeliverables: ["Career progression aspirations", "Technical domain mastery", "Continuous learning"],
        keyConcepts: ["progression", "architecture", "leadership", "learning"],
      };
    }
    if (HR_BEHAVIORAL_PATTERN.test(cleanQ)) {
      return {
        questionType: "HR_BEHAVIORAL_STAR",
        intent: "Describe a specific workplace scenario demonstrating personal ownership, actions, and measurable outcomes.",
        canShortAnswerSuffice: false,
        isReasoningRequired: true,
        isSTARRequired: true,
        expectedDeliverables: ["Situation/Context", "Action taken with personal ownership", "Result/Outcome", "Reflection/Learning"],
        keyConcepts: ["situation", "action", "result", "ownership", "conflict", "resolution"],
      };
    }
    return {
      questionType: "HR_GENERAL",
      intent: "Professional workplace discussion addressing communication, ethics, or workplace collaboration.",
      canShortAnswerSuffice: false,
      isReasoningRequired: true,
      isSTARRequired: false,
      expectedDeliverables: ["Clear professional reasoning", "Contextual example or principle"],
      keyConcepts: ["professionalism", "teamwork", "responsibility"],
    };
  }

  // 2. Project / Resume Round Analysis
  if (lowerRound === "project" || lowerRound === "resume_project") {
    if (ARCHITECTURE_PATTERN.test(cleanQ) || ARCHITECTURE_PATTERN.test(cleanExp)) {
      return {
        questionType: "PROJECT_ARCHITECTURE",
        intent: "Explain project system design, API contracts, component layering, and data flow.",
        canShortAnswerSuffice: false,
        isReasoningRequired: true,
        isSTARRequired: false,
        expectedDeliverables: ["Component architecture", "API/Data communication flow", "Design justification"],
        keyConcepts: ["architecture", "api", "database", "flow", "services", "caching"],
      };
    }
    return {
      questionType: "PROJECT_IMPLEMENTATION",
      intent: "Explain technical decisions, technologies used, challenges, or implementation details of the project.",
      canShortAnswerSuffice: false,
      isReasoningRequired: true,
      isSTARRequired: false,
      expectedDeliverables: ["Technical implementation details", "Technologies/Tools rationale", "Problem resolution"],
      keyConcepts: ["implementation", "technologies", "database", "security", "decision"],
    };
  }

  // 3. Technical Round Analysis
  if (SQL_PATTERN.test(cleanQ) || /^(?:select|insert|update|delete|create)\b/i.test(cleanExp)) {
    return {
      questionType: "SQL_QUERY",
      intent: "Provide syntactically and semantically correct SQL query.",
      canShortAnswerSuffice: true,
      isReasoningRequired: false,
      isSTARRequired: false,
      expectedDeliverables: ["SQL syntax", "Target table", "Columns/Projections", "WHERE filtering"],
      keyConcepts: ["sql", "select", "table", "where", "filter"],
    };
  }

  if (CLI_PATTERN.test(cleanQ) || /^(?:git|docker|kubectl|npm|npx|pip|curl|chmod|systemctl)\b/i.test(cleanExp)) {
    return {
      questionType: "CLI_COMMAND",
      intent: "Provide the accurate CLI command, tool flags, and parameters.",
      canShortAnswerSuffice: true,
      isReasoningRequired: false,
      isSTARRequired: false,
      expectedDeliverables: ["Command tool", "Subcommand", "Required options/flags"],
      keyConcepts: ["command", "cli", "flags", "syntax"],
    };
  }

  if (OUTPUT_PATTERN.test(cleanQ)) {
    return {
      questionType: "OUTPUT_PREDICTION",
      intent: "Predict the exact terminal/console output produced by code execution.",
      canShortAnswerSuffice: true,
      isReasoningRequired: false,
      isSTARRequired: false,
      expectedDeliverables: ["Exact literal output string or value"],
      keyConcepts: ["output", "printed value", "return"],
    };
  }

  if (CODE_PATTERN.test(cleanQ) || /[=\(\)\[\]\{\};]/.test(cleanExp)) {
    return {
      questionType: "CODE_SNIPPET",
      intent: "Write or specify programming language syntax and construct implementation.",
      canShortAnswerSuffice: true,
      isReasoningRequired: false,
      isSTARRequired: false,
      expectedDeliverables: ["Language syntax", "Correct construct initialization / method header"],
      keyConcepts: ["syntax", "construct", "code", "implementation"],
    };
  }

  if (KEYWORD_PATTERN.test(cleanQ) || /^[a-zA-Z0-9_\$#\+\-\[\]\(\)\{\}\.\/]{1,25}$/.test(cleanExp.trim())) {
    return {
      questionType: "KEYWORD_IDENTIFIER",
      intent: "Identify a specific technical keyword, protocol, status code, or identifier.",
      canShortAnswerSuffice: true,
      isReasoningRequired: false,
      isSTARRequired: false,
      expectedDeliverables: ["Exact technical keyword or protocol name"],
      keyConcepts: ["keyword", "identifier", "status code", "protocol"],
    };
  }

  if (COMPARISON_PATTERN.test(cleanQ)) {
    return {
      questionType: "COMPARISON",
      intent: "Compare two or more technologies/concepts, highlighting differences and trade-offs.",
      canShortAnswerSuffice: false,
      isReasoningRequired: true,
      isSTARRequired: false,
      expectedDeliverables: ["Key differences", "Trade-offs", "Use-case distinctions"],
      keyConcepts: ["differences", "comparison", "trade-offs", "advantages"],
    };
  }

  if (ARCHITECTURE_PATTERN.test(cleanQ) || maxMarks >= 10) {
    return {
      questionType: "ARCHITECTURE_SYSTEM",
      intent: "Explain architectural principles, scalability mechanisms, or system design trade-offs.",
      canShortAnswerSuffice: false,
      isReasoningRequired: true,
      isSTARRequired: false,
      expectedDeliverables: ["Architectural components", "Mechanisms", "Trade-off justification"],
      keyConcepts: ["architecture", "scaling", "caching", "failover", "design"],
    };
  }

  if (DEBUGGING_PATTERN.test(cleanQ)) {
    return {
      questionType: "DEBUGGING_PROBLEM_SOLVING",
      intent: "Diagnose an error, identify root cause, and formulate technical resolution.",
      canShortAnswerSuffice: false,
      isReasoningRequired: true,
      isSTARRequired: false,
      expectedDeliverables: ["Root cause identification", "Diagnosis procedure", "Resolution"],
      keyConcepts: ["debugging", "diagnosis", "fix", "resolution"],
    };
  }

  if (DEFINITION_PATTERN.test(cleanQ)) {
    return {
      questionType: "DEFINITION",
      intent: "Define technical concept and state its purpose and primary characteristics.",
      canShortAnswerSuffice: maxMarks <= 3,
      isReasoningRequired: false,
      isSTARRequired: false,
      expectedDeliverables: ["Core definition", "Primary function/purpose"],
      keyConcepts: ["definition", "purpose", "concept"],
    };
  }

  return {
    questionType: "EXPLANATION_CONCEPTUAL",
    intent: "Explain underlying technical principle, mechanism, and practical significance.",
    canShortAnswerSuffice: maxMarks <= 3,
    isReasoningRequired: maxMarks >= 5,
    isSTARRequired: false,
    expectedDeliverables: ["Core concept mechanics", "Practical technical rationale"],
    keyConcepts: ["principle", "mechanism", "explanation"],
  };
}
