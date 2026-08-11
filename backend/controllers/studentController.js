import User from "../models/User.js";
import Interview from "../models/Interview.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";
import Company from "../models/Company.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
    const { phone, portfolio, github, linkedin, skills, department, year, name, targetCompany } = req.body;

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    if (name) student.name = name;
    if (department) student.department = department;
    if (year) student.year = year;
    if (phone !== undefined) student.phone = phone;
    if (portfolio !== undefined) student.portfolio = portfolio;
    if (github !== undefined) student.github = github;
    if (linkedin !== undefined) student.linkedin = linkedin;
    if (skills !== undefined) student.skills = skills;
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
 * Upload Resume PDF, parse with Gemini, compute ATS score, and update user profile.
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

    console.log(`\n===== RESUME UPLOAD FOR: ${student.name} =====`);

    const resumeBase64 = req.file.buffer.toString("base64");

    const prompt = `
You are an AI resume analyzer and technical recruiter.
Analyze the uploaded candidate resume carefully.
Extract only information explicitly present in the resume.

Generate exactly:
1. Candidate profile details (education, skills, projects, experience, certifications)
2. An ATS score out of 100 representing how well the candidate matches general software development or technical roles.
3. 5 personalized mock interview questions (mix of technical and resume-based questions).

Return ONLY valid JSON using this structure:
{
  "atsScore": 82,
  "skills": ["JavaScript", "React", "Node.js"],
  "interviewQuestions": [
    {
      "id": "RESUME-01",
      "question": "Explain the architecture of your project X.",
      "topic": "System Design",
      "difficulty": "medium"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: resumeBase64,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsedData = JSON.parse(response.text);
    const { atsScore, skills, interviewQuestions } = parsedData;

    // Save details to student's User document
    student.resumeFileName = req.file.originalname;
    student.resumeUploadedAt = new Date();
    student.resumeBase64 = resumeBase64;
    student.atsScore = atsScore || 50;
    if (skills && Array.isArray(skills)) {
      student.skills = [...new Set([...student.skills, ...skills])];
    }
    await student.save();

    res.json({
      message: "Resume analyzed and saved to profile successfully",
      atsScore: student.atsScore,
      skills: student.skills,
      resumeFileName: student.resumeFileName,
      resumeUploadedAt: student.resumeUploadedAt,
      interviewQuestions: interviewQuestions || [],
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
 * Start an interview session.
 * interviewType should be "actual" or "mock".
 */
export const startInterview = async (req, res) => {
  try {
    const { interviewType, companyId, totalQuestions } = req.body;

    // Validate interviewType
    const validInterviewType = ["actual", "mock"].includes(interviewType) ? interviewType : "mock";

    const interview = await Interview.create({
      userId: req.user.id,
      status: "in_progress",
      interviewType: validInterviewType,
      companyId: companyId || "",
      startedAt: new Date(),
      totalQuestions: totalQuestions || 5,
      questionsAnswered: 0,
      resumeFileName: (await User.findById(req.user.id))?.resumeFileName || "",
    });

    res.status(201).json(interview);
  } catch (error) {
    console.error("Start Interview Error:", error.message);
    res.status(500).json({ message: "Server error starting interview session" });
  }
};

/**
 * Submit single question answer.
 */
export const submitAnswer = async (req, res) => {
  try {
    const { interviewId, questionId, questionType, question, answer } = req.body;

    // Verify interview is in progress
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user.id });
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    if (interview.status !== "in_progress") {
      return res.status(400).json({ message: "Interview session is not in progress" });
    }

    // AI evaluate answer using Gemini
    const evaluationPrompt = `
You are a senior technical interviewer.
Evaluate the candidate's answer for this technical interview question.

Question: "${question}"
Candidate Answer: "${answer || "[No answer / Skipped]"}"

Provide:
1. A numerical score between 0 and 100 based on accuracy and depth.
2. Short constructive feedback (max 2 sentences).

Return ONLY valid JSON using this structure:
{
  "score": 85,
  "feedback": "Your answer is accurate. Consider mentioning memory allocation."
}
`;

    let score = 0;
    let feedback = "No answer provided / Skipped.";

    if (answer && answer.trim()) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: evaluationPrompt,
          config: {
            responseMimeType: "application/json",
          },
        });
        const evalData = JSON.parse(response.text);
        score = evalData.score || 0;
        feedback = evalData.feedback || "Good attempt.";
      } catch (aiErr) {
        console.error("Gemini Answer Grade Error:", aiErr.message);
        score = answer.length > 30 ? 75 : 40; // Fallback
        feedback = "Answer recorded.";
      }
    }

    // Save Answer
    const answerDoc = await Answer.create({
      interviewId,
      userId: req.user.id,
      questionId,
      questionType: questionType || "technical",
      question,
      answer: answer || "",
      score,
      feedback,
    });

    // Update questionsAnswered counter
    interview.questionsAnswered += 1;
    await interview.save();

    res.status(201).json(answerDoc);
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

    const interview = await Interview.findOne({ _id: interviewId, userId: req.user.id });
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    // Fetch all answers for this session
    const answers = await Answer.find({ interviewId });

    // AI grading of entire session
    const finalGradingPrompt = `
You are a career consultant and senior engineering manager.
Analyze the candidate's answers to these interview questions:
${JSON.stringify(answers.map(a => ({ q: a.question, a: a.answer, score: a.score })))}

Provide an overall rating:
1. overallScore (0-100 average)
2. resumeScore (0-100 based on project-related answers)
3. technicalScore (0-100 based on conceptual questions)
4. codingScore (0-100 based on logic/coding questions)
5. List of 2-3 key strengths (array of strings)
6. List of 2-3 development areas / weaknesses (array of strings)
7. Final recruitment advice / recommendation (1-2 sentences).

Return ONLY valid JSON using this structure:
{
  "overallScore": 80,
  "resumeScore": 75,
  "technicalScore": 85,
  "codingScore": 80,
  "strengths": ["Strong conceptual clarity", "Clear communication"],
  "weaknesses": ["Improve code optimization", "Could add project details"],
  "recommendation": "Recommended for Software Engineer Intern. Focus on DS/Algo optimization."
}
`;

    let overallScore = 0;
    let resumeScore = 0;
    let technicalScore = 0;
    let codingScore = 0;
    let strengths = ["Interview completed"];
    let weaknesses = ["Review answer details"];
    let recommendation = "Mock interview completed.";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: finalGradingPrompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      const resultData = JSON.parse(response.text);
      overallScore = resultData.overallScore || 0;
      resumeScore = resultData.resumeScore || 0;
      technicalScore = resultData.technicalScore || 0;
      codingScore = resultData.codingScore || 0;
      strengths = resultData.strengths || strengths;
      weaknesses = resultData.weaknesses || weaknesses;
      recommendation = resultData.recommendation || recommendation;
    } catch (aiErr) {
      console.error("Gemini Overall Grade Error:", aiErr.message);
      // Fallback: simple averages of individual scores
      const avg = answers.length > 0 ? Math.round(answers.reduce((acc, curr) => acc + curr.score, 0) / answers.length) : 0;
      overallScore = avg;
      resumeScore = avg;
      technicalScore = avg;
      codingScore = avg;
    }

    // Save final Result
    const resultDoc = await Result.create({
      interviewId,
      userId: req.user.id,
      overallScore,
      resumeScore,
      technicalScore,
      codingScore,
      strengths,
      weaknesses,
      recommendation,
    });

    // Update Interview status
    interview.status = "completed";
    interview.completedAt = new Date();
    interview.overallScore = overallScore;
    await interview.save();

    // Increment user's attemptUsed count
    const student = await User.findById(req.user.id);
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
    res.status(500).json({ message: "Server error completing interview session" });
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
