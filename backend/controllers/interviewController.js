import Interview from "../models/Interview.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";
import { GoogleGenAI } from "@google/genai";
import {
  onAnswerSubmitted,
  onInterviewCompleted,
  onResultGenerated,
} from "../utils/csvExporter.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * POST /api/interview/start
 * Creates a new interview session and generates AI questions.
 * Works with or without a pre-uploaded resume (uses candidateName from body).
 */
export const startInterview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { interviewType = "Technical", difficulty = "Medium", duration = 30, candidateName = "", resumeFileName = "" } = req.body;

    const questionCount = 10;
    const prompt = `You are a professional AI interviewer.
Generate exactly ${questionCount} interview questions for a ${interviewType} interview at ${difficulty} difficulty level.
Candidate name: ${candidateName || "Candidate"}

For each question provide:
- A clear, specific question
- Topic/subject area
- A natural speech version (aiSpeechText) that sounds conversational, like a real interviewer would say it (include a greeting only for the first question)

Return ONLY valid JSON in exactly this structure:
{
  "questions": [
    {
      "id": "Q-01",
      "question": "",
      "topic": "",
      "difficulty": "${difficulty}",
      "category": "${interviewType.toLowerCase()}",
      "estimatedTime": "3-5 min",
      "marks": "10 Marks",
      "aiSpeechText": ""
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: prompt }],
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text);
    const generatedQuestions = (parsed.questions || []).map((q, i) => ({
      ...q,
      id: q.id || `Q-${String(i + 1).padStart(2, "0")}`,
    }));

    const interview = await Interview.create({
      userId,
      status: "in_progress",
      startedAt: new Date(),
      resumeFileName: resumeFileName || "",
      totalQuestions: generatedQuestions.length,
      candidateProfile: { candidateName: candidateName || "Candidate" },
      generatedQuestions,
    });

    res.json({
      message: "Interview session started",
      interviewId: interview._id,
      generatedQuestions,
    });
  } catch (error) {
    console.error("Start Interview Error:", error.message);
    res.status(500).json({ message: "Failed to start interview", error: error.message });
  }
};

export const uploadResumeAndGenerateQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }
    
    // Check if the user is authenticated (using authMiddleware)
    const userId = req.user.id;

    const resumeBase64 = req.file.buffer.toString("base64");
    
    const prompt = `You are an AI resume analyzer and professional technical interviewer.
Analyze the uploaded candidate resume carefully.
Extract only information explicitly present in the resume.
After analyzing the resume, create a personalized technical interview question set.

Generate exactly:
1. 5 Resume / Project Questions
2. 5 Technical Questions

Return ONLY valid JSON.
Use exactly this JSON structure:
{
  "candidateProfile": {
    "candidateName": "",
    "skills": [],
    "projects": [{"name": "", "description": "", "technologies": []}]
  },
  "resumeQuestions": [{"id": "RESUME-01", "question": "", "topic": "", "difficulty": "medium", "aiSpeechText": "..."}],
  "technicalQuestions": [{"id": "TECH-01", "question": "", "topic": "", "difficulty": "medium", "aiSpeechText": "..."}]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { inlineData: { mimeType: req.file.mimetype, data: resumeBase64 } },
        { text: prompt },
      ],
      config: { responseMimeType: "application/json" },
    });

    const interviewData = JSON.parse(response.text);
    
    // Map questions to a single array with category field
    const generatedQuestions = [
      ...(interviewData.resumeQuestions || []).map(q => ({ ...q, category: "resume" })),
      ...(interviewData.technicalQuestions || []).map(q => ({ ...q, category: "technical" })),
      ...(interviewData.codingQuestions || []).map(q => ({ ...q, category: "coding" }))
    ];
    
    // Save to DB
    const interview = await Interview.create({
      userId,
      status: "pending",
      resumeFileName: req.file.originalname,
      totalQuestions: generatedQuestions.length,
      candidateProfile: interviewData.candidateProfile,
      generatedQuestions: generatedQuestions
    });

    res.json({
      message: "Resume analyzed and interview generated successfully",
      interviewId: interview._id,
      candidateProfile: interviewData.candidateProfile,
      questions: generatedQuestions
    });
  } catch (error) {
    console.error("Interview Generation Error:", error.message);
    res.status(500).json({ message: "Resume analysis failed", error: error.message });
  }
};

export const getInterviewDetails = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }
    
    // Ensure the user owns this interview
    if (interview.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(interview);
  } catch (error) {
    console.error("Fetch Interview Error:", error.message);
    res.status(500).json({ message: "Failed to fetch interview details" });
  }
};

export const saveAnswer = async (req, res) => {
  try {
    const { questionId, question, category, answer } = req.body;
    const interviewId = req.params.id;
    const userId = req.user.id;

    // Verify interview exists and belongs to user
    const interview = await Interview.findById(interviewId);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(404).json({ message: "Interview not found or not authorized" });
    }

    let score = 0;
    let feedback = "";
    
    // Minimal AI Evaluation if answer exists
    if (answer && answer.trim().length > 0) {
      try {
        const prompt = `You are a technical interviewer evaluating a candidate's answer.
        Question: ${question}
        Category: ${category}
        Candidate's Answer: ${answer}
        
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
        feedback = "Answer recorded. (AI Evaluation temporarily unavailable)";
      }
    } else {
      feedback = "Question skipped or answer empty.";
    }

    const newAnswer = await Answer.create({
      interviewId,
      userId,
      questionId,
      questionType: category,
      question,
      answer: answer || "",
      score,
      feedback
    });
    
    // Increment answered counter
    interview.questionsAnswered += 1;
    await interview.save();

    // Update CSV export (non-blocking)
    onAnswerSubmitted().catch((err) =>
      console.error("CSV export error (answers):", err.message)
    );

    res.json({ message: "Answer saved", answer: newAnswer });
  } catch (error) {
    console.error("Save Answer Error:", error.message);
    res.status(500).json({ message: "Failed to save answer" });
  }
};

export const completeInterview = async (req, res) => {
  try {
    const interviewId = req.params.id;
    const userId = req.user.id;

    // Verify interview exists and belongs to user
    const interview = await Interview.findById(interviewId);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(404).json({ message: "Interview not found or not authorized" });
    }

    interview.status = "completed";
    interview.completedAt = new Date();
    await interview.save();

    // Fetch all answers for this interview
    const answers = await Answer.find({ interviewId });
    
    let resumeScoreTotal = 0;
    let techScoreTotal = 0;
    let codeScoreTotal = 0;
    let resumeCount = 0;
    let techCount = 0;
    let codeCount = 0;

    answers.forEach(a => {
      if (a.questionType === "resume") {
        resumeScoreTotal += a.score;
        resumeCount++;
      } else if (a.questionType === "technical") {
        techScoreTotal += a.score;
        techCount++;
      } else if (a.questionType === "coding") {
        codeScoreTotal += a.score;
        codeCount++;
      }
    });

    const resumeScore = resumeCount > 0 ? Math.round(resumeScoreTotal / resumeCount) : 0;
    const technicalScore = techCount > 0 ? Math.round(techScoreTotal / techCount) : 0;
    const codingScore = codeCount > 0 ? Math.round(codeScoreTotal / codeCount) : 0;
    
    // Overall score weighted average (tech 40%, code 40%, resume 20%)
    const overallScore = Math.round((resumeScore * 0.2) + (technicalScore * 0.4) + (codingScore * 0.4));

    const strengths = ["Good understanding of concepts"];
    if (technicalScore > 75) strengths.push("Strong technical knowledge");
    if (codingScore > 75) strengths.push("Excellent problem-solving skills");
    if (resumeScore > 75) strengths.push("Clear communication of past projects");

    const weaknesses = [];
    if (technicalScore < 50) weaknesses.push("Needs improvement in technical depth");
    if (codingScore < 50) weaknesses.push("Needs to practice coding problems");
    if (resumeScore < 50) weaknesses.push("Need better explanation of resume projects");

    const result = await Result.create({
      interviewId,
      userId,
      overallScore,
      resumeScore,
      technicalScore,
      codingScore,
      strengths,
      weaknesses: weaknesses.length > 0 ? weaknesses : ["No major weaknesses identified"],
      recommendation: overallScore > 70 ? "Highly Recommended" : "Needs Practice"
    });

    // Update CSV exports (non-blocking)
    onInterviewCompleted().catch((err) =>
      console.error("CSV export error (interviews):", err.message)
    );
    onResultGenerated().catch((err) =>
      console.error("CSV export error (results):", err.message)
    );

    res.json({ message: "Interview completed successfully", result });
  } catch (error) {
    console.error("Complete Interview Error:", error.message);
    res.status(500).json({ message: "Failed to complete interview" });
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

/**
 * GET /api/interview/user/history
 * Returns all past interview sessions for the logged-in user.
 */
export const getUserInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select("-generatedQuestions"); // Exclude large questions array for listing

    // Fetch results for each interview to include scores
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
