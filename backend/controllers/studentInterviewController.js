import mongoose from "mongoose";
import Interview from "../models/Interview.js";
import RealInterviewAptitudeQuestion from "../models/RealInterviewAptitudeQuestion.js";
import RealInterviewTechnicalQuestion from "../models/RealInterviewTechnicalQuestion.js";
import RealInterviewProjectQuestion from "../models/RealInterviewProjectQuestion.js";
import RealInterviewHRQuestion from "../models/RealInterviewHRQuestion.js";
import RealInterviewCodingQuestion from "../models/RealInterviewCodingQuestion.js";

/**
 * Aggregates questions from all 5 Real Interview round collections for a given session.
 */
async function fetchAllRealInterviewQuestions(sessionId) {
  if (!sessionId) return [];

  try {
    const [aptitudeDocs, technicalDocs, projectDocs, hrDocs, codingDocs] = await Promise.all([
      RealInterviewAptitudeQuestion.find({ sessionId }).lean(),
      RealInterviewTechnicalQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean(),
      RealInterviewProjectQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean(),
      RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean(),
      RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean(),
    ]);

    const formattedAptitude = aptitudeDocs.map((doc) => ({
      id: doc._id.toString(),
      questionId: doc._id.toString(),
      section: "APTITUDE",
      category: doc.topic || "Numerical Aptitude",
      topic: doc.topic,
      questionType: doc.questionType || "Numerical Aptitude",
      question: doc.question,
      options: (doc.options || []).map((o) => ({ label: o.label, text: o.text })),
      difficulty: doc.difficulty,
      maxMarks: doc.maxMarks || (doc.difficulty === "easy" ? 2 : doc.difficulty === "hard" ? 5 : 3),
      // Note: correctAnswer & explanation are explicitly omitted for candidate security
    }));

    const formattedTechnical = technicalDocs.map((doc) => ({
      id: doc._id.toString(),
      questionId: doc._id.toString(),
      section: "TECHNICAL",
      category: doc.category || "Conceptual",
      topic: doc.topic,
      question: doc.question,
      difficulty: doc.difficulty,
      maxMarks: doc.maxMarks || 5,
      orderIndex: doc.orderIndex,
      expectedKnowledge: doc.expectedKnowledge,
    }));

    const formattedProject = projectDocs.map((doc) => ({
      id: doc._id.toString(),
      questionId: doc._id.toString(),
      section: "RESUME_PROJECT",
      category: doc.category || "Architecture",
      topic: doc.topic,
      question: doc.question,
      difficulty: doc.difficulty,
      maxMarks: doc.maxMarks || 10,
      orderIndex: doc.orderIndex,
      projectName: doc.projectName,
      expectedKnowledge: doc.expectedKnowledge,
    }));

    const formattedHR = hrDocs.map((doc) => ({
      id: doc._id.toString(),
      questionId: doc._id.toString(),
      section: "HR",
      category: doc.category || "Behavioral",
      question: doc.question,
      difficulty: doc.difficulty,
      maxMarks: doc.maxMarks || 20,
      orderIndex: doc.orderIndex,
    }));

    const formattedCoding = codingDocs.map((doc) => ({
      id: doc._id.toString(),
      questionId: doc._id.toString(),
      section: "CODING",
      category: doc.category || "Problem Solving",
      title: doc.title,
      question: doc.description || doc.title,
      description: doc.description,
      difficulty: doc.difficulty,
      marks: doc.marks,
      maxMarks: doc.marks,
      orderIndex: doc.orderIndex,
      topic: doc.topic,
      constraints: doc.constraints,
      examples: doc.examples,
      starterCode: doc.starterCode,
      testCases: (doc.testCases || []).filter((tc) => !tc.isHidden),
    }));

    return [
      ...formattedAptitude,
      ...formattedTechnical,
      ...formattedProject,
      ...formattedHR,
      ...formattedCoding,
    ];
  } catch (error) {
    console.error("[StudentInterviewController] Error aggregating real interview questions:", error.message);
    return [];
  }
}

/**
 * POST /api/student/interviews
 * Initializes or reuses an active student Real Interview session (IDEMPOTENT).
 */
export const createInterviewSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: User ID missing" });
    }

    const { interviewType = "actual", targetRound = "all", durationMinutes = 150 } = req.body || {};

    // Check if student ALREADY has an active IN_PROGRESS session of this interviewType
    const existingActive = await Interview.findOne({
      userId,
      interviewType,
      status: "IN_PROGRESS",
    }).sort({ createdAt: -1 });

    let interview;
    if (existingActive) {
      interview = existingActive;
      console.log(`[StudentInterviewController] Reusing existing active session ${interview._id} for user ${userId}`);
    } else {
      interview = await Interview.create({
        userId,
        interviewType,
        targetRound,
        durationMinutes,
        startedAt: new Date(),
        status: "IN_PROGRESS",
      });
      console.log(`[StudentInterviewController] Created Real Interview session ${interview._id} for user ${userId}`);
    }

    const sessionId = interview._id.toString();

    res.status(201).json({
      success: true,
      sessionId,
      interviewId: sessionId,
      interviewType: interview.interviewType,
      targetRound: interview.targetRound,
      durationMinutes: interview.durationMinutes,
      startedAt: interview.startedAt,
    });
  } catch (error) {
    console.error("[StudentInterviewController] Create session error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create Real Interview session",
    });
  }
};

/**
 * POST /api/student/interviews/:sessionId/answer
 * Continuously persists student candidate answers and current index to MongoDB.
 */
export const saveInterviewAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionId, question, category, section, answer, transcript, inputMethod, status, currentQuestionIndex } = req.body || {};

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, message: "Invalid sessionId" });
    }

    const session = await Interview.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const answers = session.answers || [];
    const qIdStr = String(questionId || "");
    const existingIdx = answers.findIndex((a) => String(a.questionId) === qIdStr);

    const record = {
      questionId: qIdStr,
      question: question || "",
      category: category || "",
      section: section || "APTITUDE",
      answer: answer || "",
      transcript: transcript || answer || "",
      inputMethod: inputMethod || "TEXT",
      status: status || "answered",
      updatedAt: new Date(),
    };

    if (existingIdx !== -1) {
      answers[existingIdx] = { ...answers[existingIdx], ...record };
    } else {
      record.createdAt = new Date();
      answers.push(record);
    }

    session.answers = answers;
    if (currentQuestionIndex) {
      session.currentQuestionIndex = Number(currentQuestionIndex) || session.currentQuestionIndex;
    }

    session.questionsAnswered = answers.filter((a) => a.answer && String(a.answer).trim().length > 0).length;
    await session.save();

    res.status(200).json({ success: true, message: "Answer saved successfully", answersCount: answers.length });
  } catch (error) {
    console.error("[StudentInterviewController] Save answer error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to save answer" });
  }
};

/**
 * POST /api/student/interviews/:sessionId/integrity-event
 * Logs candidate integrity events (fullscreen exit, tab switch, etc.).
 */
export const saveInterviewIntegrityEvent = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { eventType, questionId, questionIndex, section, details } = req.body || {};

    if (mongoose.Types.ObjectId.isValid(sessionId)) {
      await Interview.findByIdAndUpdate(sessionId, {
        $push: {
          integrityEvents: {
            eventType: eventType || "UNKNOWN",
            timestamp: new Date(),
            questionId: questionId || "",
            questionIndex: questionIndex || 1,
            section: section || "APTITUDE",
            details: details || "",
          },
        },
      });
    }

    res.status(200).json({ success: true, message: "Integrity event logged" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/student/interviews/:sessionId
 * Fetches existing Real Interview session metadata along with generated round questions.
 */
export const getInterviewSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId || sessionId === "undefined" || sessionId === "null") {
      return res.status(400).json({ success: false, message: "Invalid or missing sessionId" });
    }

    let session = null;
    if (mongoose.Types.ObjectId.isValid(sessionId)) {
      session = await Interview.findById(sessionId).lean();
    }

    if (!session && mongoose.Types.ObjectId.isValid(sessionId)) {
      session = await Interview.findOne({ _id: sessionId }).lean();
    }

    const realInterviewQuestions = await fetchAllRealInterviewQuestions(sessionId);

    const sectionCounts = {
      APTITUDE: realInterviewQuestions.filter((q) => q.section === "APTITUDE").length,
      TECHNICAL: realInterviewQuestions.filter((q) => q.section === "TECHNICAL").length,
      RESUME_PROJECT: realInterviewQuestions.filter((q) => q.section === "RESUME_PROJECT").length,
      HR: realInterviewQuestions.filter((q) => q.section === "HR").length,
      CODING: realInterviewQuestions.filter((q) => q.section === "CODING").length,
    };

    const totalCount = realInterviewQuestions.length;
    const isValidRealInterview =
      sectionCounts.APTITUDE === 15 &&
      sectionCounts.TECHNICAL === 20 &&
      sectionCounts.RESUME_PROJECT === 10 &&
      sectionCounts.HR === 5 &&
      sectionCounts.CODING === 3 &&
      totalCount === 53;

    if (!session) {
      // Safe fallback for custom/test session IDs to avoid 404 block
      return res.status(200).json({
        success: true,
        sessionId,
        interviewId: sessionId,
        interviewType: "actual",
        targetRound: "all",
        durationMinutes: 150,
        startedAt: new Date(),
        status: "IN_PROGRESS",
        generatedQuestions: realInterviewQuestions,
        candidateProfile: {},
        answers: [],
        sectionCounts,
        isValidRealInterview,
        totalQuestionsCount: totalCount,
      });
    }

    const isActual = (session ? (session.interviewType || "actual") : "actual") === "actual";
    const finalQuestions = isActual
      ? realInterviewQuestions
      : (realInterviewQuestions.length > 0 ? realInterviewQuestions : (session?.generatedQuestions || []));

    res.status(200).json({
      success: true,
      sessionId: session ? session._id.toString() : sessionId,
      interviewId: session ? session._id.toString() : sessionId,
      interviewType: session ? (session.interviewType || "actual") : "actual",
      targetRound: session ? (session.targetRound || "all") : "all",
      durationMinutes: session ? (session.durationMinutes || 150) : 150,
      startedAt: session ? (session.startedAt || session.createdAt) : new Date(),
      status: session ? (session.status || "IN_PROGRESS") : "IN_PROGRESS",
      candidateProfile: session ? (session.candidateProfile || {}) : {},
      generatedQuestions: finalQuestions,
      answers: session ? (session.answers || []) : [],
      sectionCounts,
      isValidRealInterview,
      totalQuestionsCount: totalCount,
    });
  } catch (error) {
    console.error("[StudentInterviewController] Get session error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve interview session details",
    });
  }
};

/**
 * POST /api/student/interviews/:sessionId/complete
 * Marks a Real Interview session completed.
 */
export const completeInterviewSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (mongoose.Types.ObjectId.isValid(sessionId)) {
      await Interview.findByIdAndUpdate(sessionId, {
        status: "completed",
        completedAt: new Date(),
      });
    } else {
      await Interview.updateOne(
        { _id: sessionId },
        { status: "completed", completedAt: new Date() }
      );
    }
    res.status(200).json({ success: true, message: "Interview session completed" });
  } catch (error) {
    console.error("[StudentInterviewController] Complete session error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to complete session" });
  }
};

/**
 * GET /api/student/interviews
 * Fetches list of all interview sessions for current student.
 */
export const getStudentInterviews = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const interviews = await Interview.find({ userId }).sort({ createdAt: -1 }).lean();
    res.status(200).json(interviews || []);
  } catch (error) {
    console.error("[StudentInterviewController] Get student interviews error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch interviews list" });
  }
};

