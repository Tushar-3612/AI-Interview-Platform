function buildStudentContext(user, testResult) {
  return {
    name: user.name || "N/A",
    email: user.email || "N/A",
    department: user.department || "N/A",
    year: user.year || "N/A",
    skills: user.skills || [],
    atsScore: user.atsScore || 0,
    resumeFileName: user.resumeFileName || null,
    testTitle: testResult.testId?.title || "N/A",
    testType: testResult.testId?.testType || "N/A",
    difficulty: testResult.testId?.difficulty || "N/A",
  };
}

function buildTestResultSummary(testResult) {
  return {
    percentage: testResult.percentage,
    grade: testResult.grade,
    passed: testResult.passed,
    obtainedMarks: testResult.obtainedMarks,
    totalMarks: testResult.totalMarks,
    totalQuestions: testResult.totalQuestions,
    attempted: testResult.attempted,
    correct: testResult.correct,
    wrong: testResult.wrong,
    skipped: testResult.skipped,
    notVisited: testResult.notVisited,
    pendingEvaluation: testResult.pendingEvaluation,
    timeTaken: testResult.audit?.timeTaken || 0,
    sections: (testResult.sections || []).map(s => ({
      section: s.section,
      totalQuestions: s.totalQuestions,
      attempted: s.attempted,
      correct: s.correct,
      wrong: s.wrong,
      skipped: s.skipped,
      obtainedMarks: s.obtainedMarks,
      totalMarks: s.totalMarks,
      percentage: s.percentage,
    })),
    questionSummary: summarizeQuestions(testResult.questions || []),
  };
}

function summarizeQuestions(questions) {
  const bySubject = {};
  for (const q of questions) {
    const subject = q.subject || "general";
    if (!bySubject[subject]) {
      bySubject[subject] = { correct: 0, wrong: 0, skipped: 0, pending: 0, total: 0 };
    }
    bySubject[subject].total++;
    if (q.status === "correct") bySubject[subject].correct++;
    else if (q.status === "wrong") bySubject[subject].wrong++;
    else if (q.status === "pending_evaluation") bySubject[subject].pending++;
    else bySubject[subject].skipped++;
  }
  return bySubject;
}

function buildCodingDetails(questions) {
  const codingQuestions = (questions || []).filter(q => q.type === "Coding" && q.codingResult);
  if (!codingQuestions.length) return null;

  return codingQuestions.map(q => ({
    question: q.question?.substring(0, 200),
    language: q.language || q.codingResult?.language || "",
    code: q.codingResult?.code?.substring(0, 500) || "",
    compilationStatus: q.codingResult?.compilationStatus || "pending",
    executionStatus: q.codingResult?.executionStatus || "pending",
    visiblePassed: q.codingResult?.visibleTestCasesPassed || 0,
    visibleTotal: q.codingResult?.visibleTestCasesTotal || 0,
    hiddenPassed: q.codingResult?.hiddenTestCasesPassed || 0,
    hiddenTotal: q.codingResult?.hiddenTestCasesTotal || 0,
    executionTime: q.codingResult?.executionTime || 0,
    memoryUsage: q.codingResult?.memoryUsage || 0,
  }));
}

const OUTPUT_FORMAT_INSTRUCTION = `
Return ONLY valid JSON. No markdown, no code fences, no explanation.`;

function buildSystemRole(testType) {
  const roles = {
    aptitude: "You are an expert aptitude test evaluator. Analyze accuracy, speed, logical thinking, numerical ability, verbal ability, and pattern recognition.",
    technical: "You are a senior technical interviewer and subject matter expert in Computer Science. Analyze performance across Java, DBMS, OS, Computer Networks, SQL, React, Node, MongoDB, OOP.",
    coding: "You are a senior software engineer and code reviewer. Analyze problem-solving, logic, time complexity, code quality, optimization, and naming conventions.",
    mixed: "You are a comprehensive assessment analyst. Evaluate aptitude, technical knowledge, and coding skills together to provide holistic feedback.",
    resume: "You are a resume screening expert and career counselor. Compare resume claims against actual test performance to find skill gaps and provide improvement suggestions.",
    company: "You are a placement officer and recruitment analyst. Recommend suitable companies based on student's complete profile and test performance.",
    readiness: "You are a placement readiness assessor. Calculate technical readiness, coding readiness, communication readiness, and overall placement readiness scores.",
    feedback: "You are a personalized learning advisor. Generate actionable feedback, learning path, and study recommendations.",
  };
  return roles[testType] || roles.mixed;
}

function buildEvaluationData(user, testResult) {
  const ctx = buildStudentContext(user, testResult);
  const summary = buildTestResultSummary(testResult);
  const coding = buildCodingDetails(testResult.questions || []);

  return {
    student: ctx,
    testResult: summary,
    codingDetails: coding,
  };
}

export function getMixedTemplate(user, testResult) {
  const data = buildEvaluationData(user, testResult);
  const json = JSON.stringify(data, null, 2);

  return {
    role: buildSystemRole("mixed"),
    prompt: `You are evaluating a student's complete test performance. Analyze ALL available data and provide comprehensive evaluation.

STUDENT & TEST DATA:
${json}

EVALUATE THE FOLLOWING:

1. APTITUDE EVALUATION (only if aptitude section data exists):
   - Analyze accuracy, speed, logical thinking, numerical ability, verbal ability, pattern recognition
   - Score each area 0-100
   - List strengths (what they did well)
   - List weaknesses (areas needing improvement)
   - Provide specific suggestions for improvement

2. TECHNICAL EVALUATION (only if technical/coding subject data exists):
   - Analyze performance across subjects present in data
   - Score each subject 0-100
   - Identify strong topics (scored > 60%)
   - Identify weak topics (scored < 40%)
   - Provide learning suggestions for weak areas

3. CODING EVALUATION (only if coding questions exist):
   - Analyze problem-solving approach, logic, code quality
   - Score each area 0-100
   - Provide overall coding feedback
   - Suggest optimizations

4. RESUME MATCH:
   - Compare student's listed skills against actual performance
   - Identify skill gaps (skills listed but not demonstrated)
   - Identify missing skills (not listed but needed)
   - Rate resume accuracy 0-100
   - Suggest resume improvements

5. COMPANY MATCH:
   - Based on ALL scores, recommend suitable companies from: TCS, Infosys, Accenture, Capgemini, Cognizant, Persistent, Wipro, Tech Mahindra, HCL, LTI Mindtree
   - For each company, provide match percentage 0-100 and rationale

6. INTERVIEW READINESS:
   - Calculate technical readiness 0-100
   - Calculate coding readiness 0-100
   - Calculate communication readiness 0-100
   - Calculate overall placement readiness 0-100

7. AI FEEDBACK:
   - List positive points (what they did well)
   - List weak areas (what needs improvement)
   - Recommend subjects to focus on
   - Provide a practice strategy
   - Suggest next learning path (specific topics/courses)

RULES:
- Base everything on the DATA provided. Do NOT invent information.
- If a subject or section has zero questions, mark scores as null or skip.
- Be constructive and specific in feedback.
- For coding, only evaluate if codingDetails is not null.

OUTPUT JSON STRUCTURE:
{
  "aptitudeEvaluation": {
    "status": "completed" or "skipped",
    "accuracy": number 0-100 or null,
    "speed": number 0-100 or null,
    "logicalThinking": { "score": number 0-100 or null, "analysis": "string" },
    "numericalAbility": { "score": number 0-100 or null, "analysis": "string" },
    "verbalAbility": { "score": number 0-100 or null, "analysis": "string" },
    "patternRecognition": { "score": number 0-100 or null, "analysis": "string" },
    "strengths": ["string"],
    "weaknesses": ["string"],
    "suggestions": ["string"]
  },
  "technicalEvaluation": {
    "status": "completed" or "skipped",
    "subjectScores": [{ "subject": "string", "score": 0-100, "analysis": "string" }],
    "strongTopics": ["string"],
    "weakTopics": ["string"],
    "learningSuggestions": ["string"]
  },
  "codingEvaluation": {
    "status": "completed" or "skipped",
    "problemSolving": { "score": 0-100 or null, "feedback": "string" },
    "logic": { "score": 0-100 or null, "feedback": "string" },
    "timeComplexity": { "score": 0-100 or null, "feedback": "string" },
    "codeQuality": { "score": 0-100 or null, "feedback": "string" },
    "optimization": { "score": 0-100 or null, "feedback": "string" },
    "namingConvention": { "score": 0-100 or null, "feedback": "string" },
    "overallFeedback": "string",
    "optimizationSuggestions": ["string"]
  },
  "resumeMatch": {
    "status": "completed" or "skipped",
    "skillGap": ["string"],
    "missingSkills": ["string"],
    "resumeAccuracy": number 0-100,
    "suggestions": ["string"]
  },
  "companyMatch": {
    "status": "completed",
    "recommendations": [{ "company": "string", "matchPercentage": 0-100, "rationale": "string" }]
  },
  "interviewReadiness": {
    "status": "completed",
    "technicalReadiness": number 0-100,
    "codingReadiness": number 0-100,
    "communicationReadiness": number 0-100,
    "overallPlacementReadiness": number 0-100
  },
  "aiFeedback": {
    "status": "completed",
    "positivePoints": ["string"],
    "weakAreas": ["string"],
    "recommendedSubjects": ["string"],
    "practiceStrategy": "string",
    "nextLearningPath": "string"
  }
}
${OUTPUT_FORMAT_INSTRUCTION}`,
  };
}

export function getTechnicalTemplate(user, testResult) {
  const data = buildEvaluationData(user, testResult);
  const json = JSON.stringify(data, null, 2);

  return {
    role: buildSystemRole("technical"),
    prompt: `You are evaluating a student's TECHNICAL test performance.

STUDENT & TEST DATA:
${json}

EVALUATE THE FOLLOWING:

1. TECHNICAL EVALUATION:
   - Analyze performance across subjects present in data
   - Score each subject 0-100
   - Identify strong topics (scored > 60%)
   - Identify weak topics (scored < 40%)
   - Provide learning suggestions for weak areas

2. RESUME MATCH:
   - Compare student's listed skills against actual performance
   - Identify skill gaps
   - Rate resume accuracy 0-100

3. COMPANY MATCH:
   - Recommend suitable IT/tech companies with match percentages
   - Consider: TCS, Infosys, Accenture, Capgemini, Cognizant, Persistent, Wipro, Tech Mahindra, HCL

4. INTERVIEW READINESS:
   - Calculate technical readiness, coding readiness, communication readiness, overall placement readiness (0-100)

5. AI FEEDBACK:
   - Positive points, weak areas, recommended subjects, practice strategy, next learning path

OUTPUT JSON STRUCTURE:
{
  "aptitudeEvaluation": { "status": "skipped" },
  "technicalEvaluation": {
    "status": "completed",
    "subjectScores": [{ "subject": "string", "score": 0-100, "analysis": "string" }],
    "strongTopics": ["string"],
    "weakTopics": ["string"],
    "learningSuggestions": ["string"]
  },
  "codingEvaluation": { "status": "skipped" },
  "resumeMatch": {
    "status": "completed",
    "skillGap": ["string"],
    "missingSkills": ["string"],
    "resumeAccuracy": number 0-100,
    "suggestions": ["string"]
  },
  "companyMatch": {
    "status": "completed",
    "recommendations": [{ "company": "string", "matchPercentage": 0-100, "rationale": "string" }]
  },
  "interviewReadiness": {
    "status": "completed",
    "technicalReadiness": number 0-100,
    "codingReadiness": number 0-100,
    "communicationReadiness": number 0-100,
    "overallPlacementReadiness": number 0-100
  },
  "aiFeedback": {
    "status": "completed",
    "positivePoints": ["string"],
    "weakAreas": ["string"],
    "recommendedSubjects": ["string"],
    "practiceStrategy": "string",
    "nextLearningPath": "string"
  }
}
${OUTPUT_FORMAT_INSTRUCTION}`,
  };
}

export function getCodingTemplate(user, testResult) {
  const data = buildEvaluationData(user, testResult);
  const json = JSON.stringify(data, null, 2);

  return {
    role: buildSystemRole("coding"),
    prompt: `You are evaluating a student's CODING test performance.

STUDENT & TEST DATA:
${json}

EVALUATE THE FOLLOWING:

1. CODING EVALUATION (if coding details exist):
   - Analyze problem-solving approach, logic, time complexity, code quality, optimization, naming conventions
   - Score each area 0-100
   - Provide overall coding feedback
   - Suggest specific optimizations

2. RESUME MATCH:
   - Compare coding skills listed vs demonstrated
   - Identify skill gaps
   - Rate resume accuracy 0-100

3. COMPANY MATCH:
   - Recommend suitable product-based/software companies
   - Consider: TCS, Infosys, Accenture, Cognizant, Wipro, Persistent, Tech Mahindra

4. INTERVIEW READINESS:
   - Calculate technical readiness, coding readiness, communication readiness, overall placement readiness (0-100)

5. AI FEEDBACK:
   - Positive points, weak areas, recommended subjects, practice strategy, next learning path

OUTPUT JSON STRUCTURE:
{
  "aptitudeEvaluation": { "status": "skipped" },
  "technicalEvaluation": { "status": "skipped" },
  "codingEvaluation": {
    "status": "completed",
    "problemSolving": { "score": 0-100 or null, "feedback": "string" },
    "logic": { "score": 0-100 or null, "feedback": "string" },
    "timeComplexity": { "score": 0-100 or null, "feedback": "string" },
    "codeQuality": { "score": 0-100 or null, "feedback": "string" },
    "optimization": { "score": 0-100 or null, "feedback": "string" },
    "namingConvention": { "score": 0-100 or null, "feedback": "string" },
    "overallFeedback": "string",
    "optimizationSuggestions": ["string"]
  },
  "resumeMatch": {
    "status": "completed",
    "skillGap": ["string"],
    "missingSkills": ["string"],
    "resumeAccuracy": number 0-100,
    "suggestions": ["string"]
  },
  "companyMatch": {
    "status": "completed",
    "recommendations": [{ "company": "string", "matchPercentage": 0-100, "rationale": "string" }]
  },
  "interviewReadiness": {
    "status": "completed",
    "technicalReadiness": number 0-100,
    "codingReadiness": number 0-100,
    "communicationReadiness": number 0-100,
    "overallPlacementReadiness": number 0-100
  },
  "aiFeedback": {
    "status": "completed",
    "positivePoints": ["string"],
    "weakAreas": ["string"],
    "recommendedSubjects": ["string"],
    "practiceStrategy": "string",
    "nextLearningPath": "string"
  }
}
${OUTPUT_FORMAT_INSTRUCTION}`,
  };
}

export function getAptitudeTemplate(user, testResult) {
  const data = buildEvaluationData(user, testResult);
  const json = JSON.stringify(data, null, 2);

  return {
    role: buildSystemRole("aptitude"),
    prompt: `You are evaluating a student's APTITUDE test performance.

STUDENT & TEST DATA:
${json}

EVALUATE THE FOLLOWING:

1. APTITUDE EVALUATION:
   - Analyze accuracy, speed, logical thinking, numerical ability, verbal ability, pattern recognition
   - Score each area 0-100
   - List strengths and weaknesses
   - Provide specific improvement suggestions

2. RESUME MATCH:
   - Compare skills vs performance
   - Rate resume accuracy 0-100

3. COMPANY MATCH:
   - Recommend suitable companies based on aptitude performance
   - Consider: TCS, Infosys, Accenture, Capgemini, Cognizant, Wipro, Persistent

4. INTERVIEW READINESS:
   - Calculate readiness scores (0-100)

5. AI FEEDBACK:
   - Positive points, weak areas, practice strategy, next learning path

OUTPUT JSON STRUCTURE:
{
  "aptitudeEvaluation": {
    "status": "completed",
    "accuracy": number 0-100,
    "speed": number 0-100,
    "logicalThinking": { "score": number 0-100, "analysis": "string" },
    "numericalAbility": { "score": number 0-100, "analysis": "string" },
    "verbalAbility": { "score": number 0-100, "analysis": "string" },
    "patternRecognition": { "score": number 0-100, "analysis": "string" },
    "strengths": ["string"],
    "weaknesses": ["string"],
    "suggestions": ["string"]
  },
  "technicalEvaluation": { "status": "skipped" },
  "codingEvaluation": { "status": "skipped" },
  "resumeMatch": {
    "status": "completed",
    "skillGap": ["string"],
    "missingSkills": ["string"],
    "resumeAccuracy": number 0-100,
    "suggestions": ["string"]
  },
  "companyMatch": {
    "status": "completed",
    "recommendations": [{ "company": "string", "matchPercentage": 0-100, "rationale": "string" }]
  },
  "interviewReadiness": {
    "status": "completed",
    "technicalReadiness": number 0-100,
    "codingReadiness": number 0-100,
    "communicationReadiness": number 0-100,
    "overallPlacementReadiness": number 0-100
  },
  "aiFeedback": {
    "status": "completed",
    "positivePoints": ["string"],
    "weakAreas": ["string"],
    "recommendedSubjects": ["string"],
    "practiceStrategy": "string",
    "nextLearningPath": "string"
  }
}
${OUTPUT_FORMAT_INSTRUCTION}`,
  };
}

export function getTemplateForTestType(testType, user, testResult) {
  const type = (testType || "mixed").toLowerCase();
  switch (type) {
    case "technical":
      return getTechnicalTemplate(user, testResult);
    case "coding":
      return getCodingTemplate(user, testResult);
    case "aptitude":
      return getAptitudeTemplate(user, testResult);
    case "mixed":
    default:
      return getMixedTemplate(user, testResult);
  }
}
