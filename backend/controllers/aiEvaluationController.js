import TestResult from "../models/TestResult.js";
import {
  runEvaluation,
  retryEvaluation,
  getEvaluation,
  getStudentEvaluations,
  getEvaluationsByTest,
} from "../services/aiEvaluationService.js";

export const evaluateTestResult = async (req, res) => {
  try {
    const { testResultId } = req.params;

    const testResult = await TestResult.findById(testResultId).lean();
    if (!testResult) {
      return res.status(404).json({ message: "TestResult not found" });
    }

    const result = await runEvaluation(testResultId);

    if (result.status === "completed") {
      return res.json({
        message: "AI evaluation completed successfully",
        evaluation: result.evaluation,
      });
    }

    if (result.error) {
      return res.status(200).json({
        message: "AI evaluation completed with some errors",
        status: result.status,
        evaluation: result.evaluation,
        error: result.error,
      });
    }

    return res.status(200).json({
      message: "AI evaluation processed",
      status: result.status,
      evaluation: result.evaluation,
    });
  } catch (error) {
    console.error("Evaluate Test Result Error:", error.message);
    res.status(500).json({ message: "Failed to evaluate test result", error: error.message });
  }
};

export const retryEvaluationHandler = async (req, res) => {
  try {
    const { testResultId } = req.params;

    const result = await retryEvaluation(testResultId);

    res.json({
      message: "AI evaluation retry completed",
      status: result.status,
      evaluation: result.evaluation,
    });
  } catch (error) {
    console.error("Retry Evaluation Error:", error.message);
    res.status(500).json({ message: "Failed to retry evaluation", error: error.message });
  }
};

export const getEvaluationStatus = async (req, res) => {
  try {
    const { testResultId } = req.params;
    const evaluation = await getEvaluation(testResultId);

    if (!evaluation) {
      return res.status(200).json({
        exists: false,
        message: "No AI evaluation found for this test result",
      });
    }

    const testResult = await TestResult.findById(testResultId)
      .select("percentage grade passed obtainedMarks totalMarks")
      .lean();

    res.json({
      exists: true,
      status: evaluation.status,
      evaluation,
      testResultSummary: testResult || null,
    });
  } catch (error) {
    console.error("Get Evaluation Status Error:", error.message);
    res.status(500).json({ message: "Failed to fetch evaluation status" });
  }
};

export const getStudentEvaluationList = async (req, res) => {
  try {
    const userId = req.user.id;
    const evaluations = await getStudentEvaluations(userId);

    res.json({
      count: evaluations.length,
      evaluations,
    });
  } catch (error) {
    console.error("Get Student Evaluations Error:", error.message);
    res.status(500).json({ message: "Failed to fetch evaluations" });
  }
};

export const getAdminEvaluationsByTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const evaluations = await getEvaluationsByTest(testId);

    res.json({
      testId,
      count: evaluations.length,
      evaluations,
    });
  } catch (error) {
    console.error("Get Admin Evaluations Error:", error.message);
    res.status(500).json({ message: "Failed to fetch evaluations" });
  }
};

export const checkEvaluationReady = async (req, res) => {
  try {
    const { testResultId } = req.params;
    const testResult = await TestResult.findById(testResultId)
      .select("aiEvaluationReady aiEvaluationDone")
      .lean();

    if (!testResult) {
      return res.status(404).json({ message: "TestResult not found" });
    }

    const evaluation = await getEvaluation(testResultId);

    res.json({
      ready: testResult.aiEvaluationReady || false,
      done: testResult.aiEvaluationDone || false,
      evaluationStatus: evaluation?.status || null,
      evaluationExists: !!evaluation,
    });
  } catch (error) {
    console.error("Check Evaluation Ready Error:", error.message);
    res.status(500).json({ message: "Failed to check evaluation status" });
  }
};
