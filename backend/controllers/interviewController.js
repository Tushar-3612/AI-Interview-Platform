import Interview from "../models/Interview.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import InterviewQuestion from "../models/InterviewQuestion.js";
import {
  parseResumeToProfile,
  generateAptitudeQuestions,
  sanitizeRoundQuestionsForClient,
} from "../services/roundGenerators.js";
import {
  generateInterviewQuestions,
  persistInterviewQuestions,
  evaluateCompleteInterview,
  gatherCodingResults,
} from "../services/interviewGenerationService.js";
import { finalizeInterview } from "../services/interviewCompletionService.js";
import { generateFollowUp } from "../services/ai/followUpGenerator.js";
import { checkAIConnectivity, isAIConfigured } from "../services/ai/aiClient.js";
import {
  onAnswerSubmitted,
  onInterviewCompleted,
  onResultGenerated,
} from "../utils/csvExporter.js";
import { sendReportEmail } from "../utils/emailSender.js";

/**
 * POST /api/interview/start
 * Initializes a new interview session. Supports Full AI Interview (all 4 rounds) or Individual Rounds.
 */
export const startInterview = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      interviewType = "actual",
      targetRound = "all",
      candidateName = "",
      resumeFileName = ""
    } = req.body;

    // Real AI interview is always the full 4-section flow (58 questions).
    const durationMinutes = 150;
    const totalQuestions = 58; // 25 aptitude + 25 technical + 5 hr + 3 coding

    const student = await User.findById(userId).select("-password");

    let candidateProfile = {
      candidateName: student?.name || candidateName || "Candidate",
      skills: student?.skills || ["Web Development", "Problem Solving"],
      programmingLanguages: student?.skills?.filter(s => ["Java", "Python", "JavaScript", "C++", "C", "SQL", "TypeScript"].includes(s)) || ["JavaScript"],
      frameworks: student?.skills?.filter(s => ["React", "Spring Boot", "Express", "Node.js"].includes(s)) || ["React"],
      databases: student?.skills?.filter(s => ["MongoDB", "MySQL", "PostgreSQL"].includes(s)) || ["MySQL"],
      tools: ["Git"],
      projects: [],
      department: student?.department || "Computer Science"
    };

    if (student?.resumeBase64) {
      try {
        candidateProfile = await parseResumeToProfile(student.resumeBase64, student);
      } catch (err) {
        console.warn("Resume profile parse fallback on session start:", err.message);
      }
    }

    // ---- IDEMPOTENCY: reuse an existing in-progress interview that already has the full AI set ----
    const existing = await Interview.findOne({ userId, status: "IN_PROGRESS", aiGenerationCompleted: true })
      .sort({ createdAt: -1 });
    if (existing) {
      const counts = await InterviewQuestion.aggregate([
        { $match: { interviewId: existing._id } },
        { $group: { _id: "$round", count: { $sum: 1 } } },
      ]);
      const byRound = {};
      counts.forEach((c) => { byRound[c._id] = c.count; });
      if (byRound.technical >= 25 && byRound.hr >= 5 && byRound.coding >= 3 && byRound.aptitude >= 25) {
        const questions = await InterviewQuestion.find({ interviewId: existing._id }).sort({ questionNumber: 1 }).lean();
        return res.json({
          message: "Existing interview session reused (questions already generated).",
          sessionId: existing._id,
          interviewId: existing._id,
          targetRound: "all",
          durationMinutes: existing.durationMinutes || durationMinutes,
          totalQuestions,
          candidateProfile: existing.candidateProfile,
          aiGenerationCompleted: true,
          generatedQuestions: sanitizeRoundQuestionsForClient(questions, "all"),
        });
      }
    }

    // ---- AI CALL #1: generate 25 Technical + 5 HR + 3 Coding in ONE request ----
    if (!isAIConfigured()) {
      return res.status(400).json({ success: false, message: "Interview question generation failed. Please try again.", errorType: "AI_NOT_CONFIGURED" });
    }

    let generated;
    try {
      generated = await generateInterviewQuestions(candidateProfile, { technical: 25, hr: 5, coding: 3 });
    } catch (err) {
      return res.status(400).json({ success: false, message: "Interview question generation failed. Please try again.", errorType: err.message || "AI_GENERATION_FAILED" });
    }

    const interview = await Interview.create({
      userId,
      status: "IN_PROGRESS",
      interviewType: "actual",
      targetRound: "all",
      durationMinutes,
      startedAt: new Date(),
      resumeFileName: student?.resumeFileName || resumeFileName || "Uploaded_Resume.pdf",
      resumeSnapshot: {
        resumeFileName: student?.resumeFileName || "",
        skills: student?.skills || [],
        snapshotAt: new Date()
      },
      totalQuestions,
      currentQuestionIndex: 1,
      questionsAnswered: 0,
      candidateProfile,
      aiGenerationCompleted: true,
      aiGenerationAt: new Date(),
      roundsProgress: {
        aptitude: "IN_PROGRESS",
        technical: "IN_PROGRESS",
        coding: "IN_PROGRESS",
        hr: "IN_PROGRESS",
      }
    });

    // Persist 25 Technical + 5 HR + 3 Coding (AI) + 25 Aptitude (local)
    await persistInterviewQuestions({ interviewId: interview._id, userId, generated, aptitudeCount: 25 });

    const questions = await InterviewQuestion.find({ interviewId: interview._id }).sort({ questionNumber: 1 }).lean();

    res.json({
      message: "Full Interview session created successfully",
      sessionId: interview._id,
      interviewId: interview._id,
      targetRound: "all",
      durationMinutes,
      totalQuestions,
      candidateProfile,
      aiGenerationCompleted: true,
      generatedQuestions: sanitizeRoundQuestionsForClient(questions, "all"),
    });
  } catch (error) {
    console.error("Start Interview Error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to start interview session",
      errorType: "AI_GENERATION_FAILED"
    });
  }
};

/**
 * POST /api/interview/start-round
 * Generates all questions for a specific round upfront, validates them,
 * saves to DB (InterviewQuestion collection & Interview doc), and returns them.
 */
export const startRound = async (req, res) => {
  try {
    const { interviewId, candidateId, round } = req.body;
    const userId = req.user?.id || candidateId;

    if (!round) {
      return res.status(400).json({ message: "Round name is required (e.g. 'technical', 'aptitude', 'coding', 'hr')" });
    }

    const normRound = String(round).toLowerCase();
    const validRounds = ["aptitude", "technical", "coding", "hr"];
    if (!validRounds.includes(normRound)) {
      return res.status(400).json({ message: `Invalid round: ${round}. Must be one of: ${validRounds.join(", ")}` });
    }

    let interview = null;
    if (interviewId) {
      interview = await Interview.findById(interviewId);
    }

    if (!interview) {
      // Find latest in-progress interview for user or create one
      interview = await Interview.findOne({ userId, status: "IN_PROGRESS" }).sort({ createdAt: -1 });
    }

    if (!interview) {
      const student = await User.findById(userId);
      interview = await Interview.create({
        userId,
        status: "IN_PROGRESS",
        interviewType: "actual",
        targetRound: normRound,
        startedAt: new Date(),
        candidateProfile: student?.skills ? { candidateName: student.name, skills: student.skills } : {}
      });
    }

    // 1. Check if questions already exist in InterviewQuestion collection
    let existingQuestions = await InterviewQuestion.find({
      interviewId: interview._id,
      round: normRound
    }).sort({ questionNumber: 1 }).lean();

    if (existingQuestions && existingQuestions.length > 0) {
      const sanitized = sanitizeRoundQuestionsForClient(existingQuestions, normRound);
      return res.json({
        round: normRound,
        fromCache: true,
        interviewId: interview._id,
        candidateId: userId,
        totalQuestions: sanitized.length,
        questionsReady: true,
        questions: sanitized
      });
    }

    // 2. Serve from DB cache only. Questions were generated at interview start
    //    (AI CALL #1). No new AI generation occurs here (0 API calls).
    const generated = await InterviewQuestion.find({ interviewId: interview._id, round: normRound })
      .sort({ questionNumber: 1 })
      .lean();

    if (!generated || generated.length === 0) {
      return res.status(404).json({
        message: `No questions found for ${normRound} round. Start the interview to generate questions.`,
        round: normRound,
        questions: [],
      });
    }

    const sanitized = sanitizeRoundQuestionsForClient(generated, normRound);

    res.json({
      message: `All ${normRound} questions loaded from cache`,
      round: normRound,
      fromCache: true,
      interviewId: interview._id,
      candidateId: userId,
      totalQuestions: sanitized.length,
      questionsReady: true,
      questions: sanitized
    });
  } catch (error) {
    console.error("Start Round Error:", error.message);
    res.status(500).json({ message: "Failed to start round and generate questions", error: error.message });
  }
};

/**
 * GET /api/interview/questions/:interviewId/:round
 * GET /api/interview/:id/questions/:round
 * Fetches pre-generated questions directly from the database (zero AI latency).
 */
export const getRoundQuestions = async (req, res) => {
  try {
    const interviewId = req.params.interviewId || req.params.id;
    const round = req.params.round;

    if (!round) {
      return res.status(400).json({ message: "Round is required" });
    }

    const normRound = String(round).toLowerCase();

    // 1. Fetch from InterviewQuestion DB collection
    let questions = await InterviewQuestion.find({
      interviewId,
      round: normRound
    }).sort({ questionNumber: 1 }).lean();

    // 2. Fallback to Interview document if not in collection yet
    if (!questions || questions.length === 0) {
      const interview = await Interview.findById(interviewId);
      if (interview) {
      const roundFieldMap = {
        aptitude: "aptitudeQuestions",
        resume_project: "resumeQuestions",
        technical: "technicalQuestions",
        coding: "codingQuestions",
        hr: "hrQuestions"
      };
      const fieldQuestions = interview[roundFieldMap[normRound]] || [];
        if (fieldQuestions.length > 0) {
          questions = fieldQuestions;
        }
      }
    }

    if (!questions || questions.length === 0) {
      return res.status(404).json({
        message: `No questions found for ${normRound} round. Start the round first to generate questions.`,
        round: normRound,
        questions: []
      });
    }

    const sanitized = sanitizeRoundQuestionsForClient(questions, normRound);

    res.json({
      round: normRound,
      interviewId,
      totalQuestions: sanitized.length,
      questions: sanitized.map((q, idx) => ({
        questionNumber: q.questionNumber || idx + 1,
        question: q.question || q.problemStatement || "",
        section: q.section || normRound.toUpperCase(),
        topic: q.topic || q.skill || "General",
        skill: q.skill || q.topic || "General",
        difficulty: q.difficulty || "medium",
        type: q.questionType || q.type || "conceptual",
        options: q.options || [],
        starterCode: q.starterCode || "",
        testCases: q.testCases || [],
        aiSpeechText: q.aiSpeechText || q.question || "",
        status: q.status || "pending",
        id: q._id || q.id || `Q-${idx + 1}`,
        questionId: q.questionId || q.id || `Q-${idx + 1}`
      }))
    });
  } catch (error) {
    console.error("Get Round Questions Error:", error.message);
    res.status(500).json({ message: "Failed to retrieve round questions", error: error.message });
  }
};

/**
 * GET /api/interview/:id/round/:roundName
 * On-demand lazy load and DB cache for individual interview rounds:
 * - aptitude (10 questions)
 * - technical (10 questions, strictly resume-matched)
 * - coding (2 questions, progressive difficulty)
 * - hr (8 questions)
 */
export const getOrGenerateRoundQuestions = async (req, res) => {
  try {
    const { id: interviewId, roundName } = req.params;
    const userId = req.user.id;

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    if (interview.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const normRound = String(roundName).toLowerCase();
    const roundFieldMap = {
      aptitude: "aptitudeQuestions",
      resume_project: "resumeQuestions",
      technical: "technicalQuestions",
      coding: "codingQuestions",
      hr: "hrQuestions"
    };

    const targetField = roundFieldMap[normRound];
    if (!targetField) {
      return res.status(400).json({ message: `Invalid round name: ${roundName}` });
    }

    // ALL questions were generated at interview start (AI CALL #1) and saved to
    // the InterviewQuestion collection. No AI generation happens here — 0 API calls.
    let questions = await InterviewQuestion.find({ interviewId, round: normRound })
      .sort({ questionNumber: 1 })
      .lean();

    if (!questions || questions.length === 0) {
      return res.status(404).json({
        message: `No questions found for ${normRound} round. Start the interview to generate questions.`,
        round: normRound,
        questions: [],
      });
    }

    const sanitized = sanitizeRoundQuestionsForClient(questions, normRound);
    res.json({
      round: normRound,
      fromCache: true,
      count: sanitized.length,
      questions: sanitized,
    });
  } catch (error) {
    console.error(`Round generation error (${req.params.roundName}):`, error.message);
    res.status(500).json({
      message: `Failed to load ${req.params.roundName} round questions`,
      error: error.message
    });
  }
};

/**
 * POST /api/interview/upload-resume
 * Uploads resume PDF, extracts candidate profile once, and starts interview session.
 */
export const uploadResumeAndGenerateQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    const userId = req.user.id;
    const resumeBase64 = req.file.buffer.toString("base64");

    const student = await User.findById(userId);
    if (student) {
      student.resumeFileName = req.file.originalname;
      student.resumeUploadedAt = new Date();
      student.resumeBase64 = resumeBase64;
      await student.save();
    }

    const candidateProfile = await parseResumeToProfile(resumeBase64, student || {});

    if (student && candidateProfile.skills?.length) {
      student.skills = [...new Set([...(student.skills || []), ...candidateProfile.skills])];
      await student.save();
    }

    const interview = await Interview.create({
      userId,
      status: "IN_PROGRESS",
      interviewType: "mock",
      resumeFileName: req.file.originalname,
      candidateProfile,
      totalQuestions: 58,
      currentQuestionIndex: 1,
      questionsAnswered: 0,
      aptitudeQuestions: [],
      technicalQuestions: [],
      codingQuestions: [],
      hrQuestions: [],
      roundsProgress: {
        aptitude: "NOT_STARTED",
        technical: "NOT_STARTED",
        coding: "NOT_STARTED",
        hr: "NOT_STARTED"
      }
    });

    res.json({
      message: "Resume analyzed and candidate profile created successfully",
      sessionId: interview._id,
      interviewId: interview._id,
      candidateProfile
    });
  } catch (error) {
    console.error("Upload Resume Error:", error.message);
    res.status(500).json({ message: "Resume analysis failed", error: error.message });
  }
};

/**
 * GET /api/interview/:id
 * Fetches session details, combining cached round questions and saved answers.
 */
export const getInterviewDetails = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    if (interview.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const answers = await Answer.find({ interviewId: interview._id }).sort({ createdAt: 1 });

    const targetRound = interview.targetRound || "all";

    // Single source of truth: the InterviewQuestion collection (unique per interview).
    const storedQuestions = await InterviewQuestion.find({ interviewId: interview._id })
      .sort({ questionNumber: 1 })
      .lean();

    // Defensively dedupe by stable id to avoid any duplicate React keys.
    const seen = new Set();
    const questionsToReturn = (storedQuestions || []).filter((q) => {
      const key = String(q._id || q.id || q.questionId || q.question);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json({
      ...interview.toObject(),
      sessionId: interview._id.toString(),
      targetRound,
      durationMinutes: interview.durationMinutes || (targetRound === "aptitude" ? 30 : targetRound === "technical" ? 45 : targetRound === "coding" ? 45 : targetRound === "hr" ? 15 : 150),
      totalQuestions: interview.totalQuestions || questionsToReturn.length || (targetRound === "coding" ? 3 : targetRound === "hr" ? 5 : 25),
      generatedQuestions: sanitizeRoundQuestionsForClient(questionsToReturn, "all"),
      answers,
    });
  } catch (error) {
    console.error("Fetch Interview Error:", error.message);
    res.status(500).json({ message: "Failed to fetch interview session details" });
  }
};

/**
 * POST /api/interview/:id/answer
 * Saves or updates a candidate's answer for a question node.
 */
export const saveAnswer = async (req, res) => {
  try {
    const {
      questionId,
      question,
      category,
      section,
      answer,
      transcript,
      inputMethod = "TEXT",
      mode = "text",
      duration = 0,
      currentQuestionIndex
    } = req.body;

    const interviewId = req.params.id;
    const userId = req.user.id;

    const interview = await Interview.findById(interviewId);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(404).json({ message: "Interview not found or not authorized" });
    }

    const officialAnswer = answer || transcript || "";
    const officialTranscript = transcript || answer || "";

    let score = 0;
    let feedback = "";

    if (officialAnswer && officialAnswer.trim().length > 0) {
      const normCategory = (category || section || "").toLowerCase();

      if (normCategory === "aptitude" || normCategory === "mcq") {
        // Find question to check correctAnswer
        let matchedQ = await InterviewQuestion.findOne({ interviewId, $or: [{ questionId }, { question }] }).lean();
        if (!matchedQ) {
          matchedQ = (interview.aptitudeQuestions || interview.generatedQuestions || []).find(
            q => (q.id === questionId || q.questionId === questionId || q.question === question)
          );
        }

        if (matchedQ && matchedQ.correctAnswer) {
          const isCorrect = officialAnswer.trim().toLowerCase() === matchedQ.correctAnswer.trim().toLowerCase();
          score = isCorrect ? 100 : 0;
          feedback = isCorrect ? "Correct answer selected." : `Incorrect answer. Correct answer was: ${matchedQ.correctAnswer}`;
        } else {
          score = 100;
          feedback = "Answer recorded.";
        }
      } else if (normCategory === "coding") {
        // Coding is evaluated by the existing compiler; the final AI evaluation
        // (AI CALL #2) consumes the compiler results. No per-answer AI call here.
        score = 0;
        feedback = "Coding solution recorded for final evaluation.";
      } else {
        // Technical / HR answers are NOT evaluated per-answer (would add AI calls).
        // They are evaluated once at interview completion (AI CALL #2).
        score = 0;
        feedback = "Answer recorded for final evaluation.";
      }
    } else {
      feedback = "Question skipped or answer empty.";
    }

    const formattedInputMethod = inputMethod === "VOICE" || mode === "voice" ? "VOICE" : "TEXT";
    const formattedSection = section || (category ? category.toUpperCase() : "TECHNICAL");

    let existingAnswer = await Answer.findOne({ interviewId, questionId });
    let newAnswer;
    if (existingAnswer) {
      existingAnswer.answer = officialAnswer;
      existingAnswer.transcript = officialTranscript;
      existingAnswer.inputMethod = formattedInputMethod;
      existingAnswer.mode = formattedInputMethod === "VOICE" ? "voice" : "text";
      existingAnswer.section = formattedSection;
      existingAnswer.duration = Math.max(0, Number(duration) || 0);
      existingAnswer.score = score;
      existingAnswer.feedback = feedback;
      existingAnswer.timestamp = new Date();
      newAnswer = await existingAnswer.save();
    } else {
      newAnswer = await Answer.create({
        interviewId,
        userId,
        questionId,
        questionType: category || "technical",
        section: formattedSection,
        question,
        answer: officialAnswer,
        transcript: officialTranscript,
        inputMethod: formattedInputMethod,
        mode: formattedInputMethod === "VOICE" ? "voice" : "text",
        duration: Math.max(0, Number(duration) || 0),
        evaluation: { score, feedback },
        score,
        feedback,
        timestamp: new Date()
      });
      interview.questionsAnswered += 1;
    }

    if (currentQuestionIndex) {
      interview.currentQuestionIndex = Number(currentQuestionIndex);
    }
    await interview.save();

    // Sync to InterviewQuestion collection
    try {
      const normSection = (section || category || "technical").toLowerCase();
      await InterviewQuestion.findOneAndUpdate(
        {
          interviewId,
          $or: [
            { questionNumber: Number(currentQuestionIndex) },
            { question: question },
            { questionId: questionId }
          ]
        },
        {
          candidateAnswer: officialAnswer,
          score,
          feedback,
          status: officialAnswer && officialAnswer.trim().length > 0 ? "answered" : "skipped"
        }
      );
    } catch (iqSyncErr) {
      console.warn("InterviewQuestion answer sync error:", iqSyncErr.message);
    }

    onAnswerSubmitted().catch((err) =>
      console.error("CSV export error (answers):", err.message)
    );

    res.json({ message: "Answer saved", answer: newAnswer, score, feedback });
  } catch (error) {
    console.error("Save Answer Error:", error.message);
    res.status(500).json({ message: "Failed to save answer" });
  }
};

/**
 * POST /api/interview/:id/follow-up
 * Internal, authenticated follow-up generation. The AI decides whether a useful
 * contextual follow-up is appropriate given the candidate's answer. No AI keys
 * are ever returned. Never invents a question — returns shouldFollowUp:false on
 * any failure.
 */
export const generateFollowUpQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const interview = await Interview.findById(id);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const {
      section,
      currentQuestion,
      answer,
      previousQuestions = [],
      topicsCovered = [],
      interviewContext = "",
    } = req.body;

    if (!section || !currentQuestion || !answer) {
      return res.status(400).json({
        shouldFollowUp: false,
        message: "section, currentQuestion and answer are required",
      });
    }

    const result = await generateFollowUp({
      candidateProfile: interview.candidateProfile || {},
      section,
      currentQuestion,
      answer,
      previousQuestions,
      topicsCovered,
      interviewContext,
    });

    return res.json(result);
  } catch (error) {
    console.error("Follow-up generation error:", error.message);
    return res.status(200).json({ shouldFollowUp: false });
  }
};

/**
 * GET /api/interview/ai-health
 * Backend-only AI connectivity check. Never exposes the API key.
 */
export const aiHealthCheck = async (req, res) => {
  try {
    const status = await checkAIConnectivity();
    return res.json(status);
  } catch (err) {
    return res.json({ configured: false, provider: process.env.AI_PROVIDER || "openrouter", model: process.env.AI_MODEL || "", working: false, error: "AI_PROVIDER_ERROR" });
  }
};

/**
 * POST /api/interview/tts
 * Synthesis controller endpoint.
 */
export const generateTTS = async (req, res) => {
  try {
    const { text, persona = "technical" } = req.body;
    if (!text) {
      return res.status(400).json({ message: "Text is required for TTS synthesis" });
    }

    if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID) {
      const voiceId = process.env.ELEVENLABS_VOICE_ID;
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.75, similarity_boost: 0.75 }
        })
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString("base64");
        return res.json({
          provider: "elevenlabs",
          audioBase64: `data:audio/mpeg;base64,${base64Audio}`
        });
      }
    }

    return res.json({
      provider: "browser",
      fallback: true,
      text,
      profile: {
        pitch: persona === "hr" ? 0.92 : 0.86,
        rate: persona === "hr" ? 0.94 : 0.90,
        volume: 1.0,
        genderPreference: "male",
        style: "Deep, calm, corporate, mature senior interviewer"
      }
    });
  } catch (error) {
    console.error("TTS controller error:", error);
    res.status(500).json({ message: "TTS synthesis failed", fallback: true, text: req.body?.text || "" });
  }
};

export const completeInterview = async (req, res) => {
  try {
    const { id: interviewId } = req.params;
    const userId = req.user.id;

    const interview = await Interview.findById(interviewId);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Interview session not found or not authorized" });
    }

    // AI CALL #2 (final evaluation) is performed inside finalizeInterview.
    const { result, alreadyCompleted } = await finalizeInterview({ interviewId, userId });

    res.json({
      message: alreadyCompleted ? "Interview already completed" : "Interview completed and graded successfully",
      result,
    });  } catch (error) {
    console.error("Complete Interview Error:", error.message);
    if (error.errorType) {
      return res.status(500).json({ message: error.message || "Interview evaluation failed. Please try again.", errorType: error.errorType });
    }
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to complete interview" });
  }
};

/**
 * GET /api/interview/:id/result
 * Single source of truth fetch endpoint for an interview result document.
 */
export const getInterviewResult = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    // User Isolation check
    if (interview.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized access to interview result" });
    }

    const result = await Result.findOne({ interviewId: id });
    if (!result) {
      return res.status(404).json({ message: "Result document not found for this interview session" });
    }

    // Retrieve all recorded answers for this interview
    const answers = await Answer.find({ interviewId: id }).sort({ createdAt: 1 });

    // Gather all questions from interview
    const rawQuestions = [
      ...(interview.aptitudeQuestions || []),
      ...(interview.technicalQuestions || []),
      ...(interview.codingQuestions || []),
      ...(interview.hrQuestions || []),
      ...(interview.generatedQuestions || []),
    ];

    // Deduplicate questions by ID or question text
    const questionMap = new Map();
    rawQuestions.forEach((q, idx) => {
      const qKey = String(q.id || q.questionId || q._id || `q_${idx}`);
      if (!questionMap.has(qKey)) {
        questionMap.set(qKey, q);
      }
    });

    const answerMap = new Map();
    answers.forEach((ans) => {
      const aKey = String(ans.questionId || "");
      answerMap.set(aKey, ans);
    });

    // Build comprehensive answer key list
    const answerKey = [];
    const processedQuestionKeys = new Set();

    // 1. Iterate over questions
    questionMap.forEach((q, qKey) => {
      processedQuestionKeys.add(qKey);
      const ans = answerMap.get(qKey) || answers.find(a => a.question === q.question || a.question === q.title) || null;
      
      const candidateAnswer = ans ? (ans.answer || ans.transcript || "") : "";
      const isSkipped = !candidateAnswer || candidateAnswer.trim() === "";
      
      // Determine correct answer
      let correctAnswer = q.correctAnswer || q.expectedAnswer || q.sampleOutput || q.solution || "";
      if (!correctAnswer && Array.isArray(q.options) && typeof q.correctOptionIndex === "number") {
        correctAnswer = q.options[q.correctOptionIndex] || "";
      }
      if (!correctAnswer && q.type === "coding") {
        correctAnswer = q.solution || "Passes all required automated test cases";
      }

      const score = ans ? (ans.score != null ? ans.score : (ans.evaluation?.score ?? (candidateAnswer ? 75 : 0))) : 0;
      
      let status = "skipped";
      if (!isSkipped) {
        if (score >= 70) status = "correct";
        else if (score >= 40) status = "partially_correct";
        else status = "incorrect";
      }

      answerKey.push({
        questionId: qKey,
        questionText: q.question || q.title || "Interview Question",
        section: q.section || q.category || ans?.section || "TECHNICAL",
        type: q.type || (q.options?.length ? "mcq" : "text"),
        options: q.options || [],
        candidateAnswer: isSkipped ? "No answer provided / Skipped" : candidateAnswer,
        correctAnswer: correctAnswer || "Valid technical explanation matching question criteria",
        score: isSkipped ? 0 : score,
        maxScore: 100,
        status,
        feedback: ans?.feedback || ans?.evaluation?.feedback || (isSkipped ? "Question was skipped." : "Answer evaluated."),
        explanation: q.explanation || q.solutionExplanation || "",
      });
    });

    // 2. Add any answers that weren't in questionMap (e.g. dynamic follow-ups)
    answers.forEach((ans) => {
      const aKey = String(ans.questionId || "");
      if (!processedQuestionKeys.has(aKey)) {
        const candidateAnswer = ans.answer || ans.transcript || "";
        const isSkipped = !candidateAnswer || candidateAnswer.trim() === "";
        const score = ans.score != null ? ans.score : (ans.evaluation?.score ?? 0);
        
        let status = "skipped";
        if (!isSkipped) {
          if (score >= 70) status = "correct";
          else if (score >= 40) status = "partially_correct";
          else status = "incorrect";
        }

        answerKey.push({
          questionId: aKey,
          questionText: ans.question || "Interview Question",
          section: ans.section || ans.questionType || "TECHNICAL",
          type: "text",
          options: [],
          candidateAnswer: isSkipped ? "No answer provided / Skipped" : candidateAnswer,
          correctAnswer: "Contextual AI follow-up response matching question criteria",
          score,
          maxScore: 100,
          status,
          feedback: ans.feedback || ans.evaluation?.feedback || "",
          explanation: ans.evaluation?.reason || "",
        });
      }
    });

    const resultObj = result.toObject ? result.toObject() : result;
    res.json({
      ...resultObj,
      answerKey,
      questions: answerKey,
    });
  } catch (error) {
    console.error("Get Interview Result Error:", error.message);
    res.status(500).json({ message: "Failed to fetch interview result" });
  }
};

/**
 * GET /api/interview/history
 * Returns student's historical interview attempts with scores, statuses, and email delivery state.
 */
export const getInterviewHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const interviews = await Interview.find({ userId })
      .sort({ createdAt: -1 })
      .select("-generatedQuestions");

    const interviewIds = interviews.map((i) => i._id);
    const results = await Result.find({ interviewId: { $in: interviewIds } });

    const resultMap = {};
    results.forEach((r) => {
      resultMap[r.interviewId.toString()] = r;
    });

    const history = interviews.map((interview, index) => {
      const result = resultMap[interview._id.toString()] || null;
      const attemptNumber = interviews.length - index;

      return {
        id: interview._id,
        interviewId: interview._id,
        attemptNumber,
        interviewType: interview.interviewType || "Mock Interview",
        startedAt: interview.startedAt || interview.createdAt,
        completedAt: interview.completedAt,
        status: interview.status,
        resumeFileName: interview.resumeFileName || "",
        isEndedEarly: result?.isEndedEarly || false,

        overallScore: result?.overallScore || 0,
        overallPercentage: result?.overall?.percentage || result?.overallScore || 0,

        scores: {
          aptitude: result?.sections?.aptitude?.percentage || result?.aptitudeScore || 0,
          technical: result?.sections?.technical?.percentage || result?.technicalScore || 0,
          coding: result?.sections?.coding?.percentage || result?.codingScore || 0,
          hr: result?.sections?.hr?.percentage || result?.hrScore || 0,
        },

        emailStatus: result?.email?.status || "PENDING",
        result: result,
      };
    });

    res.json({ history });
  } catch (error) {
    console.error("Get Interview History Error:", error.message);
    res.status(500).json({ message: "Failed to fetch interview history" });
  }
};

export const getUserResults = async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(results);
  } catch (error) {
    console.error("Get User Results Error:", error.message);
    res.status(500).json({ message: "Failed to fetch user results" });
  }
};

export const getUserInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select("-generatedQuestions");

    const interviewIds = interviews.map((i) => i._id);
    const results = await Result.find({ interviewId: { $in: interviewIds } })
      .select("interviewId overallScore recommendation");

    const resultMap = {};
    results.forEach((r) => {
      resultMap[r.interviewId.toString()] = r;
    });

    const history = interviews.map((interview) => {
      const result = resultMap[interview._id.toString()];
      return {
        id: interview._id,
        interviewType: interview.interviewType || "mock",
        status: interview.status,
        resumeFileName: interview.resumeFileName || "",
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
        totalQuestions: interview.totalQuestions,
        questionsAnswered: interview.questionsAnswered,
        candidateName: interview.candidateProfile?.candidateName || "Candidate",
        createdAt: interview.createdAt,
        overallScore: result?.overallScore ?? null,
        recommendation: result?.recommendation || null,
      };
    });

    res.json(history);
  } catch (error) {
    console.error("Get User Interviews Error:", error.message);
    res.status(500).json({ message: "Failed to fetch interview history" });
  }
};

export const logIntegrityEvent = async (req, res) => {
  try {
    const interviewId = req.params.id;
    const userId = req.user.id;
    const { eventType, questionId = "", questionIndex = 1, section = "TECHNICAL", details = "" } = req.body;

    if (!eventType) {
      return res.status(400).json({ message: "eventType is required" });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(404).json({ message: "Interview session not found or unauthorized" });
    }

    interview.integrityEvents.push({
      eventType,
      timestamp: new Date(),
      questionId,
      questionIndex: Number(questionIndex) || 1,
      section,
      details
    });

    await interview.save();

    res.json({
      message: "Integrity event recorded successfully",
      totalEvents: interview.integrityEvents.length
    });
  } catch (error) {
    console.error("Log integrity event error:", error.message);
    res.status(500).json({ message: "Failed to record integrity event" });
  }
};
