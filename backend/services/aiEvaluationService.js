import TestResult from "../models/TestResult.js";
import User from "../models/User.js";
import AIEvaluation from "../models/AIEvaluation.js";
import { generateJSON } from "./geminiClient.js";
import { getTemplateForTestType } from "./promptTemplates.js";

function createDefaultSection() {
  return { status: "pending" };
}

function createEmptyEvaluation() {
  return {
    status: "pending",
    aptitudeEvaluation: { status: "pending" },
    technicalEvaluation: { status: "pending" },
    codingEvaluation: { status: "pending" },
    resumeMatch: { status: "pending" },
    companyMatch: { status: "pending" },
    interviewReadiness: { status: "pending" },
    aiFeedback: { status: "pending" },
    processingStartedAt: null,
    processingCompletedAt: null,
    retryCount: 0,
    lastError: "",
  };
}

export async function runEvaluation(testResultId) {
  const testResult = await TestResult.findById(testResultId).populate("testId").lean();
  if (!testResult) {
    throw new Error("TestResult not found");
  }

  const user = await User.findById(testResult.userId).lean();
  if (!user) {
    throw new Error("User not found");
  }

  let evaluation = await AIEvaluation.findOne({ testResultId });
  if (!evaluation) {
    evaluation = new AIEvaluation({
      testResultId,
      userId: testResult.userId,
      testId: testResult.testId._id || testResult.testId,
      ...createEmptyEvaluation(),
    });
  }

  evaluation.status = "in_progress";
  evaluation.processingStartedAt = new Date();
  evaluation.lastError = "";
  await evaluation.save();

  try {
    const testType = testResult.testId?.testType || "mixed";
    const { prompt, role } = getTemplateForTestType(testType, user, testResult);

    const aiResult = await generateJSON(prompt);

    mergeEvaluationData(evaluation, aiResult);

    evaluation.status = determineOverallStatus(evaluation);
    evaluation.processingCompletedAt = new Date();
    await evaluation.save();

    if (evaluation.status === "completed") {
      await TestResult.findByIdAndUpdate(testResultId, {
        aiEvaluationDone: true,
        aiEvaluationReady: true,
      });
    }

    return { evaluation: evaluation.toObject(), status: evaluation.status };
  } catch (error) {
    evaluation.lastError = error.message;
    evaluation.status = markFailedSections(evaluation);
    evaluation.processingCompletedAt = new Date();
    await evaluation.save();

    return { evaluation: evaluation.toObject(), status: evaluation.status, error: error.message };
  }
}

function mergeEvaluationData(evaluation, aiResult) {
  const fields = [
    "aptitudeEvaluation",
    "technicalEvaluation",
    "codingEvaluation",
    "resumeMatch",
    "companyMatch",
    "interviewReadiness",
    "aiFeedback",
  ];

  for (const field of fields) {
    const data = aiResult[field];
    if (!data || data.status === "skipped") {
      if (evaluation[field]) {
        evaluation[field].status = data?.status === "skipped" ? "skipped" : "pending";
      }
      continue;
    }

    if (data.status === "completed" || hasData(data)) {
      if (!evaluation[field]) {
        evaluation[field] = {};
      }
      for (const [key, value] of Object.entries(data)) {
        if (key === "status" && value === "completed") {
          evaluation[field].status = "completed";
        } else if (key !== "error" && key !== "retryCount") {
          evaluation[field][key] = value;
        }
      }
    }
  }
}

function hasData(obj) {
  if (!obj || typeof obj !== "object") return false;
  return Object.keys(obj).some(k => k !== "status" && obj[k] != null &&
    (typeof obj[k] !== "object" || (Array.isArray(obj[k]) ? obj[k].length > 0 : Object.keys(obj[k]).length > 0)));
}

function determineOverallStatus(evaluation) {
  const sections = [
    evaluation.aptitudeEvaluation,
    evaluation.technicalEvaluation,
    evaluation.codingEvaluation,
    evaluation.resumeMatch,
    evaluation.companyMatch,
    evaluation.interviewReadiness,
    evaluation.aiFeedback,
  ];

  const allCompleted = sections.every(s => s?.status === "completed" || s?.status === "skipped");
  if (allCompleted) return "completed";

  const anyFailed = sections.some(s => s?.status === "failed");
  const anyCompleted = sections.some(s => s?.status === "completed");

  if (anyFailed && anyCompleted) return "partial";
  if (anyFailed) return "failed";

  return "in_progress";
}

function markFailedSections(evaluation) {
  const sections = [
    evaluation.aptitudeEvaluation,
    evaluation.technicalEvaluation,
    evaluation.codingEvaluation,
    evaluation.resumeMatch,
    evaluation.companyMatch,
    evaluation.interviewReadiness,
    evaluation.aiFeedback,
  ];

  let hasAnyCompleted = false;
  let hasAnyFailed = false;

  for (const section of sections) {
    if (section && section.status === "in_progress") {
      section.status = "failed";
      section.error = evaluation.lastError || "Processing failed";
      hasAnyFailed = true;
    } else if (section && section.status === "completed") {
      hasAnyCompleted = true;
    }
  }

  if (hasAnyCompleted && hasAnyFailed) return "partial";
  if (hasAnyFailed) return "failed";
  return "failed";
}

export async function retryEvaluation(testResultId) {
  const evaluation = await AIEvaluation.findOne({ testResultId });
  if (!evaluation) {
    return runEvaluation(testResultId);
  }

  evaluation.retryCount = (evaluation.retryCount || 0) + 1;

  const pendingFields = [
    "aptitudeEvaluation",
    "technicalEvaluation",
    "codingEvaluation",
    "resumeMatch",
    "companyMatch",
    "interviewReadiness",
    "aiFeedback",
  ];

  for (const field of pendingFields) {
    if (evaluation[field] && (evaluation[field].status === "failed" || evaluation[field].status === "pending")) {
      evaluation[field].status = "pending";
      evaluation[field].error = "";
    }
  }

  evaluation.status = "pending";
  evaluation.lastError = "";
  await evaluation.save();

  return runEvaluation(testResultId);
}

export async function getEvaluation(testResultId) {
  const evaluation = await AIEvaluation.findOne({ testResultId })
    .populate("testId", "title testType difficulty")
    .lean();
  return evaluation || null;
}

export async function getStudentEvaluations(userId) {
  const evaluations = await AIEvaluation.find({ userId })
    .populate("testId", "title testType difficulty")
    .sort({ createdAt: -1 })
    .lean();
  return evaluations;
}

export async function getEvaluationsByTest(testId) {
  const evaluations = await AIEvaluation.find({ testId })
    .populate("userId", "name email department year")
    .sort({ createdAt: -1 })
    .lean();
  return evaluations;
}
