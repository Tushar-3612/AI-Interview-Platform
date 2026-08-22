import User from "../models/User.js";
import Interview from "../models/Interview.js";
import InterviewQuestion from "../models/InterviewQuestion.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";
import Company from "../models/Company.js";
import { parseResumeComplete } from "../services/resumeParser.js";
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

    // Fetch up to 3 recent previous Q&A for conversational context
    const previousAnswers = await Answer.find({ interviewId })
      .sort({ createdAt: -1 })
      .limit(3)
      .select("question answer score");

    const formattedContext = previousAnswers
      .map((pa, idx) => `Q${idx + 1}: "${pa.question}" -> Candidate Answer: "${pa.answer}" (Score: ${pa.score}/100)`)
      .join("\n");

    // AI evaluate answer & decide contextual follow-up using Gemini 2.5
    const evaluationPrompt = `
You are a senior technical interviewer conducting a live interview.

CURRENT QUESTION: "${question}"
CANDIDATE RESPONSE: "${officialAnswer || "[No answer / Skipped]"}"
CATEGORY: "${questionType || "technical"}"
IS FOLLOW UP QUESTION: ${isFollowUp ? "Yes" : "No"}

PREVIOUS INTERVIEW CONTEXT:
${formattedContext || "None (First question in session)"}

YOUR TASKS:
1. Evaluate the candidate's response. Assign a score out of 100 for technical accuracy, depth, and clarity.
2. Provide short constructive feedback (max 2 sentences).
3. DECIDE if a contextual follow-up question is required:
   - Set "needsFollowUp": true ONLY IF the candidate introduced specific technical concepts, architectural choices, or incomplete claims that warrant probing deeper.
   - Set "needsFollowUp": false IF the answer is already complete, skipped, or if this is already a follow-up question.
   - IF "needsFollowUp": true, generate "followUpQuestion" (a direct, natural 1-sentence technical follow-up) and a brief "reason".

Return ONLY valid JSON using this structure:
{
  "score": 85,
  "feedback": "Good explanation of database indexing.",
  "needsFollowUp": true,
  "followUpQuestion": "You mentioned B-Tree indexes for range queries. How does a B+ Tree handle node splitting during high-volume writes?",
  "reason": "Probing deeper into candidate's B-Tree indexing claim."
}
`;

    let score = 0;
    let feedback = "No answer provided / Skipped.";
    let needsFollowUp = false;
    let followUpQuestion = "";
    let reason = "";

    if (officialAnswer && officialAnswer.trim()) {
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
        needsFollowUp = Boolean(evalData.needsFollowUp && !isFollowUp); // Prevent nested infinite follow-ups
        followUpQuestion = evalData.followUpQuestion || "";
        reason = evalData.reason || "";
      } catch (aiErr) {
        console.error("Gemini Answer & Follow-up Grade Error:", aiErr.message);
        score = officialAnswer.length > 30 ? 75 : 40;
        feedback = "Answer recorded.";
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

    const interview = await Interview.findOne({ _id: interviewId, userId: req.user.id });
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    // 1. If result already exists, return it directly
    let existingResult = await Result.findOne({ interviewId });
    if (existingResult) {
      return res.json({ message: "Interview already completed", interview, result: existingResult });
    }

    interview.status = "completed";
    interview.completedAt = new Date();
    await interview.save();

    // 2. RETRIEVE ACTUAL QUESTIONS FOR THIS SPECIFIC ATTEMPT
    let interviewQuestions = await InterviewQuestion.find({ interviewId }).lean();
    if (!interviewQuestions || interviewQuestions.length === 0) {
      interviewQuestions = interview.generatedQuestions || [
        ...(interview.aptitudeQuestions || []),
        ...(interview.technicalQuestions || []),
        ...(interview.codingQuestions || []),
        ...(interview.hrQuestions || [])
      ];
    }

    const roundQuestions = {
      aptitude: (interviewQuestions || []).filter(q => (q.round || q.section || "").toLowerCase() === "aptitude"),
      technical: (interviewQuestions || []).filter(q => (q.round || q.section || "").toLowerCase() === "technical"),
      coding: (interviewQuestions || []).filter(q => (q.round || q.section || "").toLowerCase() === "coding"),
      hr: (interviewQuestions || []).filter(q => (q.round || q.section || "").toLowerCase() === "hr"),
    };

    const totalQuestions = {
      aptitude: roundQuestions.aptitude.length,
      technical: roundQuestions.technical.length,
      coding: roundQuestions.coding.length,
      hr: roundQuestions.hr.length,
    };
    const totalAttemptQuestions = interviewQuestions.length;

    // 3. FETCH ANSWERS STRICTLY BELONGING TO THIS ATTEMPT
    const answers = await Answer.find({ interviewId }).lean();
    const answerMap = new Map();
    answers.forEach(a => {
      if (a.questionId) answerMap.set(String(a.questionId), a);
      if (a.question) answerMap.set(String(a.question).trim().toLowerCase(), a);
    });

    // 4. DYNAMIC ROUND-BY-ROUND SCORING
    let aptitudeAttempted = 0, aptitudeCorrect = 0, aptitudeEarned = 0;
    roundQuestions.aptitude.forEach(q => {
      const qKey = String(q.id || q.questionId || q._id);
      const ans = answerMap.get(qKey) || answerMap.get(String(q.question).trim().toLowerCase());
      if (ans && ans.answer && String(ans.answer).trim().length > 0) {
        aptitudeAttempted++;
        const isCorrect = (q.correctAnswer && ans.answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) || ans.score === 100 || ans.score === 1;
        if (isCorrect) {
          aptitudeCorrect++;
          aptitudeEarned += 100;
        }
      }
    });
    const aptitudePercentage = totalQuestions.aptitude > 0
      ? Math.round((aptitudeCorrect / totalQuestions.aptitude) * 100)
      : 0;

    let technicalAttempted = 0, technicalEarned = 0;
    roundQuestions.technical.forEach(q => {
      const qKey = String(q.id || q.questionId || q._id);
      const ans = answerMap.get(qKey) || answerMap.get(String(q.question).trim().toLowerCase());
      if (ans && ans.answer && String(ans.answer).trim().length > 0) {
        technicalAttempted++;
        const scoreVal = typeof ans.score === "number" ? Math.max(0, Math.min(100, ans.score)) : 70;
        technicalEarned += scoreVal;
      }
    });
    const technicalPercentage = totalQuestions.technical > 0
      ? Math.round((technicalEarned / (totalQuestions.technical * 100)) * 100)
      : 0;

    let codingAttempted = 0, codingEarned = 0;
    roundQuestions.coding.forEach(q => {
      const qKey = String(q.id || q.questionId || q._id);
      const ans = answerMap.get(qKey) || answerMap.get(String(q.question).trim().toLowerCase());
      if (ans && ans.answer && String(ans.answer).trim().length > 0) {
        codingAttempted++;
        const scoreVal = typeof ans.score === "number" ? Math.max(0, Math.min(100, ans.score)) : 80;
        codingEarned += scoreVal;
      }
    });
    const codingPercentage = totalQuestions.coding > 0
      ? Math.round((codingEarned / (totalQuestions.coding * 100)) * 100)
      : 0;

    let hrAttempted = 0, hrEarned = 0;
    roundQuestions.hr.forEach(q => {
      const qKey = String(q.id || q.questionId || q._id);
      const ans = answerMap.get(qKey) || answerMap.get(String(q.question).trim().toLowerCase());
      if (ans && ans.answer && String(ans.answer).trim().length > 0) {
        hrAttempted++;
        const scoreVal = typeof ans.score === "number" ? Math.max(0, Math.min(100, ans.score)) : 75;
        hrEarned += scoreVal;
      }
    });
    const hrPercentage = totalQuestions.hr > 0
      ? Math.round((hrEarned / (totalQuestions.hr * 100)) * 100)
      : 0;

    // 5. DYNAMIC OVERALL SCORE CALCULATION
    const targetRound = String(interview.targetRound || "all").toLowerCase();
    let overallScore = 0;

    if (targetRound === "aptitude") {
      overallScore = aptitudePercentage;
    } else if (targetRound === "technical") {
      overallScore = technicalPercentage;
    } else if (targetRound === "coding") {
      overallScore = codingPercentage;
    } else if (targetRound === "hr") {
      overallScore = hrPercentage;
    } else {
      const weights = { aptitude: 0.20, technical: 0.35, coding: 0.30, hr: 0.15 };
      let totalWeight = 0;
      let weightedSum = 0;

      if (totalQuestions.aptitude > 0) {
        totalWeight += weights.aptitude;
        weightedSum += (aptitudePercentage * weights.aptitude);
      }
      if (totalQuestions.technical > 0) {
        totalWeight += weights.technical;
        weightedSum += (technicalPercentage * weights.technical);
      }
      if (totalQuestions.coding > 0) {
        totalWeight += weights.coding;
        weightedSum += (codingPercentage * weights.coding);
      }
      if (totalQuestions.hr > 0) {
        totalWeight += weights.hr;
        weightedSum += (hrPercentage * weights.hr);
      }

      overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    }

    const totalAttempted = aptitudeAttempted + technicalAttempted + codingAttempted + hrAttempted;
    const isEndedEarly = totalAttempted < totalAttemptQuestions;

    const strengths = ["Analytical problem solving"];
    if (technicalPercentage >= 70) strengths.push("Strong technical knowledge");
    if (codingPercentage >= 70) strengths.push("Efficient code architecture");
    if (aptitudePercentage >= 70) strengths.push("High numerical/logical agility");
    if (hrPercentage >= 70) strengths.push("Effective communication skills");

    const weaknesses = [];
    if (totalQuestions.technical > 0 && technicalPercentage < 50) weaknesses.push("Needs improvement in technical depth");
    if (totalQuestions.coding > 0 && codingPercentage < 50) weaknesses.push("Practice edge cases in coding IDE");
    if (totalQuestions.aptitude > 0 && aptitudePercentage < 50) weaknesses.push("Review aptitude speed strategies");
    if (totalQuestions.hr > 0 && hrPercentage < 50) weaknesses.push("Apply STAR method in HR scenarios");

    const totalEarnedMarks = Math.round(aptitudeEarned/100 + technicalEarned/100 + codingEarned/100 + hrEarned/100);

    // Save final Result
    const resultDoc = await Result.create({
      interviewId,
      userId: req.user.id,
      targetRound,
      overallScore,
      resumeScore: technicalPercentage,
      technicalScore: technicalPercentage,
      codingScore: codingPercentage,
      hrScore: hrPercentage,
      aptitudeScore: aptitudePercentage,

      overall: {
        obtainedMarks: totalEarnedMarks,
        maximumMarks: totalAttemptQuestions,
        percentage: overallScore,
      },

      sections: {
        aptitude: {
          score: aptitudePercentage,
          percentage: aptitudePercentage,
          completed: aptitudeAttempted,
          total: totalQuestions.aptitude,
          unanswered: Math.max(0, totalQuestions.aptitude - aptitudeAttempted),
          correct: aptitudeCorrect,
        },
        technical: {
          score: technicalPercentage,
          percentage: technicalPercentage,
          completed: technicalAttempted,
          total: totalQuestions.technical,
          unanswered: Math.max(0, totalQuestions.technical - technicalAttempted),
        },
        coding: {
          score: codingPercentage,
          percentage: codingPercentage,
          completed: codingAttempted,
          total: totalQuestions.coding,
          unanswered: Math.max(0, totalQuestions.coding - codingAttempted),
        },
        hr: {
          score: hrPercentage,
          percentage: hrPercentage,
          completed: hrAttempted,
          total: totalQuestions.hr,
          unanswered: Math.max(0, totalQuestions.hr - hrAttempted),
        },
      },

      strengths,
      weaknesses: weaknesses.length > 0 ? weaknesses : ["No major weaknesses identified"],
      recommendation: overallScore >= 70 ? "Highly Recommended" : overallScore >= 50 ? "Recommended with Practice" : "Needs Practice",
      isEndedEarly,
      attemptedQuestions: totalAttempted,
      skippedQuestions: Math.max(0, totalAttemptQuestions - totalAttempted),
      duration: Math.round(((new Date() - new Date(interview.startedAt || interview.createdAt)) / 1000) || 0),
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
