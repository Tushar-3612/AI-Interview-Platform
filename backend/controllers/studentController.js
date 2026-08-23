import User from "../models/User.js";
import Interview from "../models/Interview.js";
import InterviewQuestion from "../models/InterviewQuestion.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";
import Company from "../models/Company.js";
import { parseResumeComplete } from "../services/resumeParser.js";
import { parseResumeToProfile, sanitizeRoundQuestionsForClient, generateAptitudeQuestions } from "../services/roundGenerators.js";
import {
  generateInterviewQuestions,
  persistInterviewQuestions,
  evaluateCompleteInterview,
  gatherCodingResults,
} from "../services/interviewGenerationService.js";
import { finalizeInterview } from "../services/interviewCompletionService.js";
import { isAIConfigured, getModel } from "../services/ai/aiClient.js";
import {
  ROUND_META,
  TOTAL_QUESTIONS,
  AI_ROUNDS,
  generateRoundQuestions,
  evaluateRound,
  computeOverallFromSections,
} from "../services/roundService.js";

// In-flight generation lock keyed by userId. Prevents React Strict Mode (or any
// duplicate) from launching two Groq generations for the same user concurrently;
// the second request waits for and reuses the first one's result.
const generatingInFlight = new Set();
import dotenv from "dotenv";
import { normalizeYear, normalizeDepartment } from "../utils/academicConfig.js";

dotenv.config();

/**
 * Get student profile details.
 */
export const getProfile = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select("-password");
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }
    res.json(student);
  } catch (error) {
    console.error("Get Profile Error:", error.message);
    res.status(500).json({ message: "Server error retrieving profile" });
  }
};

/**
 * Update student profile details.
 */
export const updateProfile = async (req, res) => {
  try {
    const { phone, portfolio, github, linkedin, skills, categorizedSkills, department, year, name, targetCompany } = req.body;

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    if (name) student.name = name;
    if (department) student.department = normalizeDepartment(department);
    if (year) student.year = normalizeYear(year);
    if (phone !== undefined) student.phone = phone;
    if (portfolio !== undefined) student.portfolio = portfolio;
    if (github !== undefined) student.github = github;
    if (linkedin !== undefined) student.linkedin = linkedin;
    if (skills !== undefined) student.skills = skills;
    if (categorizedSkills !== undefined) student.categorizedSkills = categorizedSkills;
    if (targetCompany !== undefined) student.targetCompany = targetCompany;

    await student.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        department: student.department,
        year: student.year,
        phone: student.phone,
        skills: student.skills,
        categorizedSkills: student.categorizedSkills,
        all_skills: student.skills,
        portfolio: student.portfolio,
        github: student.github,
        linkedin: student.linkedin,
        atsScore: student.atsScore,
        resumeFileName: student.resumeFileName,
        targetCompany: student.targetCompany,
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error.message);
    res.status(500).json({ message: "Server error updating profile" });
  }
};

/**
 * Upload Resume PDF, extract complete skills across all categories, compute ATS score, and update user profile.
 */
export const uploadResumeAndAnalyze = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Only PDF resumes are allowed" });
    }

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    console.log(`\n===== RESUME UPLOAD FOR: ${student.name} (${req.file.originalname}) =====`);

    const resumeBase64 = req.file.buffer.toString("base64");
    const parsed = await parseResumeComplete(req.file.buffer, req.file.mimetype, student);

    // Save details to student's User document
    student.resumeFileName = req.file.originalname;
    student.resumeUploadedAt = new Date();
    student.resumeBase64 = resumeBase64;
    student.atsScore = parsed.atsScore || 82;
    student.skills = parsed.all_skills || [];
    student.categorizedSkills = parsed.categorizedSkills || parsed.skills || {};
    await student.save();

    res.json({
      message: "Resume analyzed and profile skills updated successfully",
      atsScore: student.atsScore,
      skills: student.skills,
      categorizedSkills: student.categorizedSkills,
      all_skills: student.skills,
      resumeFileName: student.resumeFileName,
      resumeUploadedAt: student.resumeUploadedAt,
      projects: parsed.projects || [],
      experience: parsed.experience || [],
      education: parsed.education || [],
      certifications: parsed.certifications || []
    });
  } catch (error) {
    console.error("Resume Upload/Analyze Error:", error.message);
    res.status(500).json({
      message: "Resume analysis failed",
      error: error.message,
    });
  }
};

/**
 * Download uploaded resume PDF
 */
export const downloadResume = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student || !student.resumeBase64) {
      return res.status(404).json({ message: "No resume found. Please upload your resume first." });
    }
    const pdfBuffer = Buffer.from(student.resumeBase64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${student.resumeFileName || "Candidate_Resume.pdf"}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Download Resume Error:", error.message);
    res.status(500).json({ message: "Failed to download resume" });
  }
};

/**
 * View uploaded resume PDF in browser
 */
export const viewResume = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student || !student.resumeBase64) {
      return res.status(404).json({ message: "No resume found. Please upload your resume first." });
    }
    const pdfBuffer = Buffer.from(student.resumeBase64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${student.resumeFileName || "Candidate_Resume.pdf"}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("View Resume Error:", error.message);
    res.status(500).json({ message: "Failed to view resume" });
  }
};

/**
 * Map an AI_* error code to a provider-appropriate HTTP status + safe message.
 * Never includes the API key, raw provider response, prompt, or candidate data.
 */
function buildAIError(code) {
  const map = {
    AI_INVALID_KEY: { status: 401, message: "Groq authentication failed. Check AI_API_KEY." },
    AI_FORBIDDEN: { status: 403, message: "Groq access forbidden for this key." },
    AI_MODEL_NOT_FOUND: { status: 404, message: "The configured Groq model is unavailable." },
    AI_RATE_LIMITED: { status: 429, message: "Groq rate limit reached. Please try again later." },
    AI_INSUFFICIENT_CREDITS: { status: 402, message: "Groq credits exhausted. Please try again later." },
    AI_REQUEST_TIMEOUT: { status: 408, message: "Groq request timed out. Please try again." },
    AI_INVALID_RESPONSE: { status: 422, message: "AI returned an invalid question format." },
    AI_PROVIDER_ERROR: { status: 502, message: "AI provider is currently unavailable." },
    AI_NOT_CONFIGURED: { status: 400, message: "AI provider is not configured." },
    AI_GENERATION_FAILED: { status: 400, message: "Interview question generation failed. Please try again." },
  };
  const entry = map[code] || map.AI_GENERATION_FAILED;
  return {
    status: entry.status,
    body: {
      success: false,
      provider: "groq",
      errorType: code,
      message: entry.message,
    },
  };
}

/**
 * Start an interview session (REAL AI INTERVIEW — NEW 4-ROUND ARCHITECTURE).
 *
 * IMPORTANT: NO AI call happens here. Only 25 Aptitude questions are generated
 * locally. AI rounds (Resume/Project, Technical, Coding, HR) are generated
 * LAZILY when the student enters each round (see generateRound). This guarantees
 * exactly 8 AI calls total (generate + evaluate per AI round).
 */
export const startInterview = async (req, res) => {
  try {
    const { interviewType } = req.body;
    const validInterviewType = ["actual", "mock"].includes(interviewType) ? interviewType : "mock";
    const userId = req.user.id;
    const totalQuestions = TOTAL_QUESTIONS; // 63

    const student = await User.findById(userId).select("-password");

    let candidateProfile = {
      candidateName: student?.name || "Candidate",
      skills: student?.skills || ["Web Development", "Problem Solving"],
      programmingLanguages: student?.skills?.filter(s => ["Java", "Python", "JavaScript", "C++", "C", "SQL", "TypeScript"].includes(s)) || ["JavaScript"],
      frameworks: student?.skills?.filter(s => ["React", "Spring Boot", "Express", "Node.js"].includes(s)) || ["React"],
      databases: student?.skills?.filter(s => ["MongoDB", "MySQL", "PostgreSQL"].includes(s)) || ["MySQL"],
      tools: ["Git"],
      projects: [],
      department: student?.department || "Computer Science",
    };
    if (student?.resumeBase64) {
      try {
        candidateProfile = await parseResumeToProfile(student.resumeBase64, student);
      } catch (err) {
        console.warn("Resume profile parse fallback on session start:", err.message);
      }
    }

    // IDEMPOTENCY: reuse an existing in-progress interview (any rounds already
    // generated are returned; missing rounds are generated lazily later).
    const existing = await Interview.findOne({ userId, status: "IN_PROGRESS" }).sort({ createdAt: -1 });
    if (existing) {
      const questions = await InterviewQuestion.find({ interviewId: existing._id }).sort({ questionNumber: 1 }).lean();
      return res.status(200).json(buildStartResponse(existing, candidateProfile, questions, totalQuestions));
    }

    // Generate 25 local Aptitude questions only — no AI at start.
    const aptitude = await generateAptitudeQuestions(ROUND_META.aptitude.count);

    const interview = await Interview.create({
      userId,
      status: "IN_PROGRESS",
      interviewType: validInterviewType,
      startedAt: new Date(),
      totalQuestions,
      questionsAnswered: 0,
      resumeFileName: student?.resumeFileName || "Uploaded_Resume.pdf",
      candidateProfile,
      aiGenerationCompleted: false,
      roundsProgress: {
        aptitude: "READY",
        technical: "NOT_STARTED",
        coding: "NOT_STARTED",
        hr: "NOT_STARTED",
        resume_project: "NOT_STARTED",
      },
    });

    const aptDocs = aptitude.map((q, idx) => ({
      ...q,
      interviewId: interview._id,
      userId,
      round: "aptitude",
      section: "APTITUDE",
      category: "aptitude",
      questionNumber: idx + 1,
      order: idx + 1,
    }));
    await InterviewQuestion.insertMany(aptDocs);

    const questions = await InterviewQuestion.find({ interviewId: interview._id }).sort({ questionNumber: 1 }).lean();
    res.status(201).json(buildStartResponse(interview, candidateProfile, questions, totalQuestions));
  } catch (error) {
    console.error("Start Interview Error:", error.message);
    res.status(500).json({ message: "Server error starting interview session" });
  }
};

function groupQuestionsByRound(questions = []) {
  const grouped = {};
  for (const q of questions) {
    const r = q.round || (q.section || "").toLowerCase();
    if (!r) continue;
    grouped[r] = grouped[r] || [];
    grouped[r].push(q);
  }
  return grouped;
}

function buildStartResponse(interview, candidateProfile, questions, totalQuestions) {
  const grouped = groupQuestionsByRound(questions);
  const rounds = {};
  for (const key of ["aptitude", "resume_project", "technical", "coding", "hr"]) {
    const meta = ROUND_META[key];
    const qs = grouped[key] || [];
    const status = interview.roundsProgress?.[key] || (key === "aptitude" ? "READY" : "NOT_STARTED");
    rounds[key] = {
      count: meta.count,
      status,
      ready: qs.length >= meta.count,
      questions: sanitizeRoundQuestionsForClient(qs, key),
    };
  }
  return {
    _id: interview._id,
    interviewId: interview._id,
    candidateProfile,
    totalQuestions,
    aiGenerationCompleted: false,
    rounds,
    aptitudeQuestions: rounds.aptitude.questions,
    generatedQuestions: rounds.aptitude.questions,
  };
}

/**
 * Lazy per-round question generation (AI CALL #N for AI rounds).
 * Idempotent — returns already-persisted questions if present.
 */
export const generateRound = async (req, res) => {
  try {
    const { interviewId, roundName } = req.params;
    const userId = req.user.id;
    const result = await generateRoundQuestions({ interviewId, userId, round: roundName });
    res.status(result.generated ? 201 : 200).json({
      message: result.generated ? `${roundName} questions generated` : `${roundName} questions reused`,
      round: result.round,
      count: result.count,
      questions: result.questions,
    });
  } catch (error) {
    console.error("Generate Round Error:", error.message);
    if (error.errorType) {
      return res.status(error.status || 502).json({ message: error.message, errorType: error.errorType, provider: "groq" });
    }
    res.status(error.status || 500).json({ message: error.message || "Failed to generate round questions" });
  }
};

/**
 * Lazy per-round evaluation (AI CALL #N for AI rounds).
 * Idempotent — returns existing evaluation if present.
 */
export const evaluateRoundHandler = async (req, res) => {
  try {
    const { interviewId, roundName } = req.params;
    const userId = req.user.id;
    const result = await evaluateRound({ interviewId, userId, round: roundName });
    res.status(result.evaluated ? 201 : 200).json({
      message: result.evaluated ? `${roundName} evaluated` : `${roundName} evaluation reused`,
      round: result.round,
      evaluation: result.evaluation,
    });
  } catch (error) {
    console.error("Evaluate Round Error:", error.message);
    if (error.errorType) {
      return res.status(error.status || 502).json({ message: error.message, errorType: error.errorType, provider: "groq" });
    }
    res.status(error.status || 500).json({ message: error.message || "Failed to evaluate round" });
  }
};

/**
 * Submit single question answer.
 */
export const submitAnswer = async (req, res) => {
  try {
    const { interviewId, questionId, questionType, question, answer, transcript, mode = "text", duration = 0, isFollowUp = false, parentQuestionId = "" } = req.body;

    // Verify interview is in progress
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user.id });
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    if (interview.status !== "in_progress") {
      return res.status(400).json({ message: "Interview session is not in progress" });
    }

    const officialAnswer = answer || transcript || "";
    const officialTranscript = transcript || answer || "";

    // NOTE: No per-answer AI call. Answers are evaluated ONCE at interview
    // completion (AI CALL #2). This keeps the interview to exactly 2 AI calls.
    let score = 0;
    let feedback = "Answer recorded for final evaluation.";
    let needsFollowUp = false;
    let followUpQuestion = "";
    let reason = "";

    if (officialAnswer && officialAnswer.trim()) {
      // Aptitude answers are scored locally (objective correctness, NO AI).
      if (String(questionType || "").toLowerCase() === "aptitude") {
        try {
          const q = await InterviewQuestion.findOne({
            interviewId,
            $or: [{ questionId }, { question }],
          }).lean();
          if (q && q.correctAnswer) {
            const correct = officialAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            score = correct ? 100 : 0;
            feedback = correct ? "Correct answer." : `Incorrect. Correct answer was: ${q.correctAnswer}`;
          }
        } catch {
          /* ignore */
        }
      }
    }

    const evaluationObj = {
      score,
      feedback,
      needsFollowUp,
      followUpQuestion,
      reason
    };

    // Save Answer with persistent voice transcript & follow-up fields
    const answerDoc = await Answer.create({
      interviewId,
      userId: req.user.id,
      questionId,
      questionType: questionType || "technical",
      question,
      answer: officialAnswer,
      transcript: officialTranscript,
      mode: mode === "voice" ? "voice" : "text",
      duration: Math.max(0, Number(duration) || 0),
      evaluation: evaluationObj,
      isFollowUp: Boolean(isFollowUp),
      parentQuestionId: parentQuestionId || "",
      score,
      feedback,
      timestamp: new Date(),
    });

    // Update questionsAnswered counter
    interview.questionsAnswered += 1;
    await interview.save();

    res.status(201).json({
      message: "Answer evaluated successfully",
      answer: answerDoc,
      needsFollowUp,
      followUpQuestion,
      reason
    });
  } catch (error) {
    console.error("Submit Answer Error:", error.message);
    res.status(500).json({ message: "Server error saving answer" });
  }
};

/**
 * Complete the interview and generate final AI result.
 */
export const completeInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user.id;

    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    if (interview.status === "completed") {
      const existingResult = await Result.findOne({ interviewId });
      return res.json({ message: "Interview already completed", interview, result: existingResult });
    }

    // NO final AI call. Score is computed from the per-round evaluations that
    // were persisted when each round was evaluated (8 AI calls total, no 9th).
    const agg = computeOverallFromSections(interview);

    // Aptitude is scored locally from stored correct answers.
    const aptQuestions = await InterviewQuestion.find({ interviewId, round: "aptitude" }).lean();
    const aptAnswers = await Answer.find({ interviewId, questionType: "aptitude" }).lean();
    const aptCorrect = aptAnswers.filter((a) => {
      const q = aptQuestions.find((x) => x.questionId === a.questionId || x.question === a.question);
      return q && q.correctAnswer && String(a.answer || "").trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
    }).length;
    const aptScore = aptQuestions.length
      ? Math.round((aptCorrect / aptQuestions.length) * 100)
      : 0;

    const sectionScores = {
      resume_project: interview.sectionEvaluations?.resume_project?.score || 0,
      technical: interview.sectionEvaluations?.technical?.score || 0,
      coding: interview.sectionEvaluations?.coding?.score || 0,
      hr: interview.sectionEvaluations?.hr?.score || 0,
    };

    const completedRounds = AI_ROUNDS.filter((r) => interview.sectionEvaluations?.[r]?.score != null);

    const resultDoc = await Result.findOneAndUpdate(
      { interviewId },
      {
        userId,
        overallScore: agg.overallScore,
        targetRound: interview.targetRound || "all",
        resumeScore: sectionScores.resume_project,
        technicalScore: sectionScores.technical,
        codingScore: sectionScores.coding,
        hrScore: sectionScores.hr,
        aptitudeScore: aptScore,
        sections: {
          aptitude: { score: aptScore, completed: aptQuestions.length, total: aptQuestions.length, correct: aptCorrect },
          technical: { score: sectionScores.technical },
          coding: { score: sectionScores.coding },
          hr: { score: sectionScores.hr },
        },
        strengths: Object.values(interview.sectionEvaluations || {}).flatMap((e) => e.strengths || []),
        weaknesses: Object.values(interview.sectionEvaluations || {}).flatMap((e) => e.weaknesses || []),
        recommendation: completedRounds.length === AI_ROUNDS.length ? "Well performed across all rounds." : "Some rounds were not evaluated.",
        completedRounds,
        incompleteRounds: AI_ROUNDS.filter((r) => !completedRounds.includes(r)),
        duration: interview.durationMinutes || 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    interview.status = "completed";
    interview.completedAt = new Date();
    await interview.save();

    // Increment user's attemptUsed count (only on first completion)
    const student = await User.findById(userId);
    if (student) {
      student.attemptUsed = (student.attemptUsed || 0) + 1;
      await student.save();
    }

    res.json({
      message: "Interview completed and graded successfully",
      interview,
      result: resultDoc,
    });
  } catch (error) {
    console.error("Complete Interview Error:", error.message);
    if (error.errorType) {
      return res.status(500).json({ message: error.message || "Interview evaluation failed. Please try again.", errorType: error.errorType });
    }
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error completing interview session" });
  }
};

/**
 * GET /api/student/interviews/:interviewId
 * Load a single interview's questions + answers for the active student room.
 * No AI call — questions already exist in MongoDB.
 */
export const getInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user.id;

    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    const answers = await Answer.find({ interviewId }).sort({ createdAt: 1 });

    // Single source of truth: InterviewQuestion collection (unique per interview).
    const storedQuestions = await InterviewQuestion.find({ interviewId }).sort({ questionNumber: 1 }).lean();

    // Defensive dedupe by stable id to avoid duplicate React keys.
    const seen = new Set();
    const questionsToReturn = (storedQuestions || []).filter((q) => {
      const key = String(q._id || q.id || q.questionId || q.question);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Strip sensitive fields (technical correctAnswer) even in the bulk payload.
    const safeQuestions = (questionsToReturn || []).map((q) => {
      const c = { ...q };
      if (String(q.round || "").toLowerCase() === "technical" || String(q.section || "").toUpperCase() === "TECHNICAL") {
        delete c.correctAnswer;
        delete c.explanation;
      }
      return c;
    });

    res.json({
      ...interview.toObject(),
      sessionId: interview._id.toString(),
      targetRound: interview.targetRound || "all",
      durationMinutes: interview.durationMinutes || 150,
      totalQuestions: interview.totalQuestions || questionsToReturn.length,
      generatedQuestions: safeQuestions,
      answers,
    });
  } catch (error) {
    console.error("Get Interview Error:", error.message);
    res.status(500).json({ message: "Failed to fetch interview session" });
  }
};

/**
 * GET /api/student/interviews/:interviewId/round/:roundName
 * Load a single round's questions from MongoDB (DB-only, no AI call).
 */
export const getInterviewRound = async (req, res) => {
  try {
    const { interviewId, roundName } = req.params;
    const userId = req.user.id;

    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    const normRound = String(roundName).toLowerCase();
    const validRounds = ["aptitude", "technical", "coding", "hr", "resume_project"];
    if (!validRounds.includes(normRound)) {
      return res.status(400).json({ message: `Invalid round: ${roundName}` });
    }

    const questions = await InterviewQuestion.find({ interviewId, round: normRound })
      .sort({ questionNumber: 1 })
      .lean();

    if (!questions || questions.length === 0) {
      return res.status(404).json({ message: `No questions found for ${normRound} round.`, round: normRound, questions: [] });
    }

    res.json({
      round: normRound,
      interviewId,
      totalQuestions: questions.length,
      questionsReady: true,
      questions: sanitizeRoundQuestionsForClient(questions, normRound),
    });
  } catch (error) {
    console.error("Get Interview Round Error:", error.message);
    res.status(500).json({ message: "Failed to load round questions" });
  }
};

/**
 * Fetch all interviews for current student.
 * Optional query param: interviewType ("actual" or "mock")
 * For backward compatibility, "actual" also includes "real", and "mock" also includes "practice".
 */
export const getInterviews = async (req, res) => {
  try {
    const { interviewType } = req.query;
    const query = { userId: req.user.id };
    
    if (interviewType === "actual") {
      // Include both "actual" and legacy "real" for backward compatibility
      query.interviewType = { $in: ["actual", "real"] };
    } else if (interviewType === "mock") {
      // Include both "mock" and legacy "practice" for backward compatibility
      query.interviewType = { $in: ["mock", "practice"] };
    }
    
    const list = await Interview.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error("Get Student Interviews Error:", error.message);
    res.status(500).json({ message: "Server error fetching interviews" });
  }
};

/**
 * Update target company for current student.
 */
export const updateTargetCompany = async (req, res) => {
  try {
    const { targetCompany } = req.body;
    
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    student.targetCompany = targetCompany || "";
    await student.save();
    
    res.json({ 
      message: "Target company updated successfully",
      targetCompany: student.targetCompany 
    });
  } catch (error) {
    console.error("Update Target Company Error:", error.message);
    res.status(500).json({ message: "Server error updating target company" });
  }
};

/**
 * Fetch all results for current student.
 */
export const getResults = async (req, res) => {
  try {
    const list = await Result.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error("Get Student Results Error:", error.message);
    res.status(500).json({ message: "Server error fetching results" });
  }
};
