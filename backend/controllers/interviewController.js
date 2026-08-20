import Interview from "../models/Interview.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import { GoogleGenAI } from "@google/genai";
import {
  parseResumeToProfile,
  generateAptitudeQuestions,
  generateTechnicalQuestions,
  generateCodingQuestions,
  generateHRQuestions,
  sanitizeRoundQuestionsForClient
} from "../services/roundGenerators.js";
import {
  onAnswerSubmitted,
  onInterviewCompleted,
  onResultGenerated,
} from "../utils/csvExporter.js";
import { sendReportEmail } from "../utils/emailSender.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * POST /api/interview/start
 * Initializes a new interview session. Fast, lightweight start without generating all 58 questions up-front.
 */
export const startInterview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { interviewType = "actual", candidateName = "", resumeFileName = "" } = req.body;

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

    const interview = await Interview.create({
      userId,
      status: "IN_PROGRESS",
      interviewType: "actual",
      startedAt: new Date(),
      resumeFileName: student?.resumeFileName || resumeFileName || "Uploaded_Resume.pdf",
      resumeSnapshot: {
        resumeFileName: student?.resumeFileName || "",
        skills: student?.skills || [],
        snapshotAt: new Date()
      },
      totalQuestions: 58,
      currentQuestionIndex: 1,
      questionsAnswered: 0,
      candidateProfile,
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
      message: "Real Interview session created successfully",
      sessionId: interview._id,
      interviewId: interview._id,
      totalQuestions: 58,
      candidateProfile,
      roundsProgress: interview.roundsProgress
    });
  } catch (error) {
    console.error("Start Interview Error:", error.message);
    res.status(500).json({ message: "Failed to start interview session", error: error.message });
  }
};

/**
 * GET /api/interview/:id/round/:roundName
 * On-demand lazy load and DB cache for individual interview rounds:
 * - aptitude (25 questions)
 * - technical (25 questions, batched & strictly resume-matched)
 * - coding (3 questions, progressive difficulty)
 * - hr (5 questions)
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
      technical: "technicalQuestions",
      coding: "codingQuestions",
      hr: "hrQuestions"
    };

    const targetField = roundFieldMap[normRound];
    if (!targetField) {
      return res.status(400).json({ message: `Invalid round name: ${roundName}` });
    }

    let questions = interview[targetField] || [];

    // 1. CHECK DB SESSION CACHE FIRST (0 Gemini API calls on refresh / re-open)
    if (questions && questions.length > 0) {
      const sanitized = sanitizeRoundQuestionsForClient(questions, normRound);
      return res.json({
        round: normRound,
        fromCache: true,
        count: sanitized.length,
        questions: sanitized
      });
    }

    // 2. GENERATE ROUND QUESTIONS IF NOT IN CACHE
    const profile = interview.candidateProfile || {};

    if (normRound === "aptitude") {
      questions = await generateAptitudeQuestions(25);
    } else if (normRound === "technical") {
      questions = await generateTechnicalQuestions(profile, 25);
    } else if (normRound === "coding") {
      questions = await generateCodingQuestions(profile, 3);
    } else if (normRound === "hr") {
      questions = await generateHRQuestions(profile, 5);
    }

    // Store in DB document
    interview[targetField] = questions;
    if (!interview.roundsProgress) {
      interview.roundsProgress = { aptitude: "NOT_STARTED", technical: "NOT_STARTED", coding: "NOT_STARTED", hr: "NOT_STARTED" };
    }
    interview.roundsProgress[normRound] = "IN_PROGRESS";

    // Re-combine cached questions into overall generatedQuestions in order
    const combined = [
      ...(interview.aptitudeQuestions || []),
      ...(interview.technicalQuestions || []),
      ...(interview.codingQuestions || []),
      ...(interview.hrQuestions || [])
    ];
    interview.generatedQuestions = combined;

    await interview.save();

    const sanitized = sanitizeRoundQuestionsForClient(questions, normRound);
    res.json({
      round: normRound,
      fromCache: false,
      count: sanitized.length,
      questions: sanitized
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

    const combinedQuestions = [
      ...(interview.aptitudeQuestions || []),
      ...(interview.technicalQuestions || []),
      ...(interview.codingQuestions || []),
      ...(interview.hrQuestions || [])
    ];

    const questionsToReturn = combinedQuestions.length > 0
      ? combinedQuestions
      : (interview.generatedQuestions || []);

    res.json({
      ...interview.toObject(),
      sessionId: interview._id.toString(),
      generatedQuestions: questionsToReturn,
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
      if (category === "aptitude" || category === "coding") {
        score = 85;
        feedback = "Response recorded successfully.";
      } else {
        try {
          const prompt = `You are a technical interviewer evaluating a candidate's answer.
          Question: ${question}
          Category: ${category}
          Candidate's Answer: ${officialAnswer}
          
          Rate this answer out of 100 for technical accuracy, clarity, and completeness.
          Provide a brief feedback sentence.
          
          Return exactly this JSON format:
          { "score": 85, "feedback": "Good understanding of the concept." }`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ text: prompt }],
            config: { responseMimeType: "application/json" }
          });

          const evalData = JSON.parse(response.text);
          score = evalData.score || 0;
          feedback = evalData.feedback || "";
        } catch (aiErr) {
          console.error("AI Evaluation failed:", aiErr);
          score = officialAnswer.length > 20 ? 75 : 40;
          feedback = "Answer recorded.";
        }
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

    onAnswerSubmitted().catch((err) =>
      console.error("CSV export error (answers):", err.message)
    );

    res.json({ message: "Answer saved", answer: newAnswer });
  } catch (error) {
    console.error("Save Answer Error:", error.message);
    res.status(500).json({ message: "Failed to save answer" });
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
    const interviewId = req.params.id;
    const userId = req.user.id;

    const interview = await Interview.findById(interviewId);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Interview session not found or not authorized" });
    }

    // 1. SINGLE SOURCE OF TRUTH: If result already exists, return it immediately (0 recalculation)
    let existingResult = await Result.findOne({ interviewId });
    if (existingResult) {
      return res.json({ message: "Interview already completed", result: existingResult });
    }

    interview.status = "completed";
    interview.completedAt = new Date();
    await interview.save();

    const answers = await Answer.find({ interviewId });

    let aptitudeScoreTotal = 0, aptitudeCount = 0;
    let techScoreTotal = 0, techCount = 0;
    let codeScoreTotal = 0, codeCount = 0;
    let hrScoreTotal = 0, hrCount = 0;

    answers.forEach((a) => {
      const sec = (a.section || a.questionType || "").toUpperCase();
      if (sec === "APTITUDE") {
        aptitudeScoreTotal += a.score;
        aptitudeCount++;
      } else if (sec === "TECHNICAL" || a.questionType === "resume" || a.questionType === "technical") {
        techScoreTotal += a.score;
        techCount++;
      } else if (sec === "CODING" || a.questionType === "coding") {
        codeScoreTotal += a.score;
        codeCount++;
      } else if (sec === "HR" || a.questionType === "hr") {
        hrScoreTotal += a.score;
        hrCount++;
      }
    });

    const aptitudeScore = aptitudeCount > 0 ? Math.round(aptitudeScoreTotal / aptitudeCount) : 0;
    const technicalScore = techCount > 0 ? Math.round(techScoreTotal / techCount) : 0;
    const codingScore = codeCount > 0 ? Math.round(codeScoreTotal / codeCount) : 0;
    const hrScore = hrCount > 0 ? Math.round(hrScoreTotal / hrCount) : 0;

    const overallScore = Math.round(
      (aptitudeScore * 0.2) + (technicalScore * 0.35) + (codingScore * 0.3) + (hrScore * 0.15)
    );

    const completedRounds = [];
    const incompleteRounds = [];
    if (aptitudeCount > 0) completedRounds.push("APTITUDE"); else incompleteRounds.push("APTITUDE");
    if (techCount > 0) completedRounds.push("TECHNICAL"); else incompleteRounds.push("TECHNICAL");
    if (codeCount > 0) completedRounds.push("CODING"); else incompleteRounds.push("CODING");
    if (hrCount > 0) completedRounds.push("HR"); else incompleteRounds.push("HR");

    const isEndedEarly = incompleteRounds.length > 0;

    const strengths = ["Solid conceptual understanding"];
    if (technicalScore > 75) strengths.push("Strong technical knowledge");
    if (codingScore > 75) strengths.push("Excellent algorithmic problem-solving");
    if (aptitudeScore > 75) strengths.push("High logical reasoning skills");
    if (hrScore > 75) strengths.push("Professional communication");

    const weaknesses = [];
    if (technicalScore < 50) weaknesses.push("Needs improvement in technical depth");
    if (codingScore < 50) weaknesses.push("Needs to practice IDE coding problems");
    if (aptitudeScore < 50) weaknesses.push("Practice speed and accuracy in Aptitude");
    if (hrScore < 50) weaknesses.push("Structure answers with the STAR method in HR");

    const user = await User.findById(userId);
    const recipientEmail = user?.email || "";

    const result = await Result.create({
      interviewId,
      userId,
      overallScore,
      resumeScore: technicalScore,
      technicalScore,
      codingScore,
      hrScore,
      aptitudeScore,

      overall: {
        obtainedMarks: answers.length,
        maximumMarks: 58,
        percentage: overallScore,
      },

      sections: {
        aptitude: { score: aptitudeScore, percentage: aptitudeScore, completed: aptitudeCount, total: 25 },
        technical: { score: technicalScore, percentage: technicalScore, completed: techCount, total: 25 },
        coding: { score: codingScore, percentage: codingScore, completed: codeCount, total: 3 },
        hr: { score: hrScore, percentage: hrScore, completed: hrCount, total: 5 },
      },

      strengths,
      weaknesses: weaknesses.length > 0 ? weaknesses : ["No major weaknesses identified"],
      recommendation: overallScore > 70 ? "Highly Recommended" : "Needs Practice",

      isEndedEarly,
      completedRounds,
      incompleteRounds,
      attemptedQuestions: answers.length,
      skippedQuestions: Math.max(0, 58 - answers.length),
      duration: Math.round(((new Date() - new Date(interview.startedAt || interview.createdAt)) / 1000) || 0),

      email: {
        recipient: recipientEmail,
        status: "PENDING",
        sentAt: null,
        error: null,
      },
    });

    onInterviewCompleted().catch((err) =>
      console.error("CSV export error (interviews):", err.message)
    );
    onResultGenerated().catch((err) =>
      console.error("CSV export error (results):", err.message)
    );

    // 2. NON-BLOCKING EMAIL DISPATCH WITH DUPLICATE PROTECTION
    if (recipientEmail) {
      try {
        const userName = user.name || user.candidateName || "Candidate";
        const emailSubject = `Your AI Interview Performance Results - Overall Score: ${overallScore}%`;
        const resultLink = `${process.env.CLIENT_URL || "http://localhost:5173"}/interview-history/${interviewId}/result`;
        
        const emailText = `Hello ${userName},\n\nYour AI Interview session is completed.\nOverall Score: ${overallScore}%\nRecommendation: ${result.recommendation}\n\nView Full Result: ${resultLink}\n\nThank you for using PrepHire AI Interview Platform.`;

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; background-color: #080a12; color: #f8fafc; padding: 30px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #334155;">
              <h1 style="color: #38bdf8; font-size: 24px; margin: 0;">PrepHire AI Interview Platform</h1>
              <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Official Candidate Performance Evaluation Report</p>
            </div>
            <div style="padding: 20px 0;">
              <p style="font-size: 16px; color: #e2e8f0;">Hello <strong>${userName}</strong>,</p>
              <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                ${isEndedEarly ? "Your AI Mock Interview session was completed (ended early)." : "Congratulations on completing your AI Mock Interview!"} Below is your official evaluation summary.
              </p>
              <div style="background-color: #0f172a; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #1e293b; text-align: center;">
                <span style="font-size: 12px; font-weight: bold; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Overall Placement Score</span>
                <div style="font-size: 42px; font-weight: 900; color: ${overallScore >= 70 ? '#34d399' : '#f59e0b'}; margin: 10px 0;">
                  ${overallScore}%
                </div>
                <span style="display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; background-color: ${overallScore >= 70 ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)'}; color: ${overallScore >= 70 ? '#34d399' : '#f59e0b'}; border: 1px solid ${overallScore >= 70 ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'};">
                  ${result.recommendation}
                </span>
              </div>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 13px;">Aptitude Round (25 Qs)</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #e2e8f0; font-size: 14px;">${aptitudeScore}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 13px;">Technical Stack Round (25 Qs)</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #e2e8f0; font-size: 14px;">${technicalScore}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 13px;">Coding IDE Round (3 Qs)</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #e2e8f0; font-size: 14px;">${codingScore}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 0; color: #94a3b8; font-size: 13px;">HR Behavioral Round (5 Qs)</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #e2e8f0; font-size: 14px;">${hrScore}%</td>
                </tr>
              </table>

              <div style="text-align: center; margin: 25px 0;">
                <a href="${resultLink}" style="display: inline-block; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: bold; background-color: #2563eb; color: #ffffff; text-decoration: none;">
                  View Full Result
                </a>
              </div>

              <div style="margin-bottom: 16px;">
                <h3 style="font-size: 14px; color: #34d399; margin-bottom: 8px;">Key Strengths Identified</h3>
                <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px;">
                  ${strengths.map((s) => `<li>${s}</li>`).join("")}
                </ul>
              </div>
              <div style="margin-bottom: 20px;">
                <h3 style="font-size: 14px; color: #f87171; margin-bottom: 8px;">Recommended Focus Areas</h3>
                <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px;">
                  ${(weaknesses.length > 0 ? weaknesses : ["No major weaknesses identified"]).map((w) => `<li>${w}</li>`).join("")}
                </ul>
              </div>
            </div>
            <div style="text-align: center; padding-top: 16px; border-top: 1px solid #334155; font-size: 12px; color: #64748b;">
              <p>PrepHire AI Interview Platform • Automated Evaluation System</p>
            </div>
          </div>
        `;

        const emailRes = await sendReportEmail(recipientEmail, emailSubject, emailText, emailHtml);
        const finalEmailStatus = emailRes?.simulated ? "SIMULATED" : emailRes?.success ? "SENT" : "FAILED";
        
        result.email = {
          recipient: recipientEmail,
          status: finalEmailStatus,
          sentAt: new Date(),
          error: null,
        };
        await result.save();
      } catch (emailErr) {
        console.warn("Interview completion email dispatch notice:", emailErr.message);
        result.email = {
          recipient: recipientEmail,
          status: "FAILED",
          sentAt: new Date(),
          error: emailErr.message,
        };
        await result.save();
      }
    }

    res.json({ message: "Interview completed successfully", result });
  } catch (error) {
    console.error("Complete Interview Error:", error.message);
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

    res.json(result);
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
