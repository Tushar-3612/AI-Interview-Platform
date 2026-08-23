/**
 * interviewCompletionService.js
 *
 * Shared finalization for the REAL AI INTERVIEW (AI CALL #2).
 * Used by both /api/interview and /api/student/interviews completion routes
 * so the logic (and the 2-call guarantee) lives in exactly one place.
 *
 * Performs:
 *   - load generated questions + answers
 *   - local aptitude score (NO AI)
 *   - gather coding compiler results (NO AI)
 *   - ONE AI request: evaluateCompleteInterview (AI CALL #2)
 *   - weighted overall score (AI technical/hr/coding + local aptitude)
 *   - create Result document, mark interview completed, send email
 */

import Interview from "../models/Interview.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import InterviewQuestion from "../models/InterviewQuestion.js";
import { evaluateCompleteInterview, gatherCodingResults } from "./interviewGenerationService.js";
import { sendReportEmail } from "../utils/emailSender.js";
import { onInterviewCompleted, onResultGenerated } from "../utils/csvExporter.js";

export async function finalizeInterview({ interviewId, userId }) {
  const interview = await Interview.findById(interviewId);
  if (!interview) {
    const err = new Error("Interview session not found");
    err.status = 404;
    throw err;
  }

  // Idempotency: if a result already exists, return it (no re-evaluation).
  let existingResult = await Result.findOne({ interviewId });
  if (existingResult) return { result: existingResult, alreadyCompleted: true };

  let interviewQuestions = await InterviewQuestion.find({ interviewId }).lean();
  if (!interviewQuestions || interviewQuestions.length === 0) {
    interviewQuestions = interview.generatedQuestions || [];
  }

  const roundQuestions = {
    aptitude: interviewQuestions.filter(q => (q.round || q.section || "").toLowerCase() === "aptitude"),
    resume_project: interviewQuestions.filter(q => (q.round || q.section || "").toLowerCase() === "resume_project"),
    technical: interviewQuestions.filter(q => (q.round || q.section || "").toLowerCase() === "technical"),
    coding: interviewQuestions.filter(q => (q.round || q.section || "").toLowerCase() === "coding"),
    hr: interviewQuestions.filter(q => (q.round || q.section || "").toLowerCase() === "hr"),
  };

  const totalQuestions = {
    aptitude: roundQuestions.aptitude.length,
    resume_project: roundQuestions.resume_project.length,
    technical: roundQuestions.technical.length,
    coding: roundQuestions.coding.length,
    hr: roundQuestions.hr.length,
  };
  const totalAttemptQuestions = interviewQuestions.length;

  const answers = await Answer.find({ interviewId }).lean();
  const answerMap = new Map();
  answers.forEach(a => {
    if (a.questionId) answerMap.set(String(a.questionId), a);
    if (a.question) answerMap.set(String(a.question).trim().toLowerCase(), a);
  });

  const countAttempted = (round) =>
    (roundQuestions[round] || []).filter(q => {
      const qKey = String(q.id || q.questionId || q._id);
      const ans = answerMap.get(qKey) || answerMap.get(String(q.question).trim().toLowerCase());
      return ans && ans.answer && String(ans.answer).trim().length > 0;
    }).length;

  const aptitudeAttempted = countAttempted("aptitude");
  const technicalAttempted = countAttempted("technical");
  const hrAttempted = countAttempted("hr");
  const codingAttempted = countAttempted("coding");

  // Aptitude — LOCAL objective correctness (NO AI)
  let aptitudeCorrect = 0;
  roundQuestions.aptitude.forEach(q => {
    const qKey = String(q.id || q.questionId || q._id);
    const ans = answerMap.get(qKey) || answerMap.get(String(q.question).trim().toLowerCase());
    if (ans && ans.answer && String(ans.answer).trim().length > 0) {
      const isCorrect = (q.correctAnswer && ans.answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) || ans.score === 100 || ans.score === 1;
      if (isCorrect) aptitudeCorrect++;
    }
  });
  const aptitudePercentage = totalQuestions.aptitude > 0 ? Math.round((aptitudeCorrect / totalQuestions.aptitude) * 100) : 0;

  // Coding — from EXISTING compiler (NO AI)
  const codingResults = await gatherCodingResults(interviewId, roundQuestions.coding);

  // Build Q&A context for AI CALL #2
  const buildQA = (round) =>
    (roundQuestions[round] || []).map(q => {
      const qKey = String(q.id || q.questionId || q._id);
      const ans = answerMap.get(qKey) || answerMap.get(String(q.question).trim().toLowerCase());
      const has = ans && ans.answer && String(ans.answer).trim().length > 0;
      return { question: q.question || q.title || "", answer: has ? ans.answer : "", skipped: !has };
    });

  // ---- AI CALL #2: FINAL EVALUATION (exactly one AI request) ----
  let aiEval;
  try {
    aiEval = await evaluateCompleteInterview({
      candidateProfile: interview.candidateProfile || {},
      technical: buildQA("technical"),
      hr: buildQA("hr"),
      coding: codingResults,
      aptitude: { attempted: aptitudeAttempted, correct: aptitudeCorrect, total: totalQuestions.aptitude, percentage: aptitudePercentage },
      skipped: {
        technical: totalQuestions.technical - technicalAttempted,
        hr: totalQuestions.hr - hrAttempted,
        coding: totalQuestions.coding - codingAttempted,
      },
    });
  } catch (err) {
    interview.aiEvaluationError = err.message || "AI_EVALUATION_FAILED";
    interview.status = "IN_PROGRESS"; // allow retry of evaluation only
    await interview.save();
    const e = new Error("Interview evaluation failed. Please try again.");
    e.errorType = err.message || "AI_EVALUATION_FAILED";
    throw e;
  }

  const technicalPercentage = aiEval.technical?.score ?? 0;
  const hrPercentage = aiEval.hr?.score ?? 0;
  const codingPercentage = aiEval.coding?.score ?? 0;
  const resumePercentage = technicalPercentage;

  const mergeUnique = (...arrs) => Array.from(new Set(arrs.flat().filter(Boolean)));
  const strengths = mergeUnique(
    aiEval.overall?.strengths || [],
    aiEval.technical?.strengths || [],
    aiEval.hr?.strengths || [],
    aiEval.coding?.strengths || []
  );
  const weaknesses = mergeUnique(
    aiEval.overall?.weaknesses || [],
    aiEval.technical?.weaknesses || [],
    aiEval.hr?.weaknesses || [],
    aiEval.coding?.weaknesses || []
  );

  const targetRound = "all";
  const completedRounds = [];
  const incompleteRounds = [];
  if (totalQuestions.aptitude > 0 && aptitudeAttempted >= totalQuestions.aptitude) completedRounds.push("APTITUDE"); else incompleteRounds.push("APTITUDE");
  if (totalQuestions.technical > 0 && technicalAttempted >= totalQuestions.technical) completedRounds.push("TECHNICAL"); else incompleteRounds.push("TECHNICAL");
  if (totalQuestions.coding > 0 && codingAttempted >= totalQuestions.coding) completedRounds.push("CODING"); else incompleteRounds.push("CODING");
  if (totalQuestions.hr > 0 && hrAttempted >= totalQuestions.hr) completedRounds.push("HR"); else incompleteRounds.push("HR");

  const weights = { aptitude: 0.18, technical: 0.30, coding: 0.25, hr: 0.15 };
  let totalWeight = 0, weightedSum = 0;
  if (totalQuestions.aptitude > 0) { totalWeight += weights.aptitude; weightedSum += aptitudePercentage * weights.aptitude; }
  if (totalQuestions.technical > 0) { totalWeight += weights.technical; weightedSum += technicalPercentage * weights.technical; }
  if (totalQuestions.coding > 0) { totalWeight += weights.coding; weightedSum += codingPercentage * weights.coding; }
  if (totalQuestions.hr > 0) { totalWeight += weights.hr; weightedSum += hrPercentage * weights.hr; }
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const totalAttempted = aptitudeAttempted + technicalAttempted + codingAttempted + hrAttempted;
  const isEndedEarly = totalAttempted < totalAttemptQuestions;
  const resumeAttempted = 0;

  const user = await User.findById(userId);
  const recipientEmail = user?.email || "";
  const totalEarnedMarks = Math.round((aptitudePercentage + technicalPercentage + codingPercentage + hrPercentage) / 4);

  const result = await Result.create({
    interviewId,
    userId,
    targetRound,
    overallScore,
    resumeScore: resumePercentage,
    technicalScore: technicalPercentage,
    codingScore: codingPercentage,
    hrScore: hrPercentage,
    aptitudeScore: aptitudePercentage,
    overall: { obtainedMarks: totalEarnedMarks, maximumMarks: totalAttemptQuestions, percentage: overallScore },
    sections: {
      aptitude: { score: aptitudePercentage, percentage: aptitudePercentage, completed: aptitudeAttempted, total: totalQuestions.aptitude, unanswered: Math.max(0, totalQuestions.aptitude - aptitudeAttempted), correct: aptitudeCorrect },
      resume_project: { score: resumePercentage, percentage: resumePercentage, completed: resumeAttempted, total: totalQuestions.resume_project, unanswered: Math.max(0, totalQuestions.resume_project - resumeAttempted) },
      technical: { score: technicalPercentage, percentage: technicalPercentage, completed: technicalAttempted, total: totalQuestions.technical, unanswered: Math.max(0, totalQuestions.technical - technicalAttempted) },
      coding: { score: codingPercentage, percentage: codingPercentage, completed: codingAttempted, total: totalQuestions.coding, unanswered: Math.max(0, totalQuestions.coding - codingAttempted) },
      hr: { score: hrPercentage, percentage: hrPercentage, completed: hrAttempted, total: totalQuestions.hr, unanswered: Math.max(0, totalQuestions.hr - hrAttempted) },
    },
    strengths,
    weaknesses: weaknesses.length > 0 ? weaknesses : ["No major weaknesses identified"],
    recommendation: overallScore >= 70 ? "Highly Recommended" : overallScore >= 50 ? "Recommended with Practice" : "Needs Practice",
    isEndedEarly,
    completedRounds,
    incompleteRounds,
    attemptedQuestions: totalAttempted,
    skippedQuestions: Math.max(0, totalAttemptQuestions - totalAttempted),
    duration: Math.round(((new Date() - new Date(interview.startedAt || interview.createdAt)) / 1000) || 0),
    email: { recipient: recipientEmail, status: "PENDING", sentAt: null, error: null },
  });

  onInterviewCompleted().catch((err) => console.error("CSV export error (interviews):", err.message));
  onResultGenerated().catch((err) => console.error("CSV export error (results):", err.message));

  interview.status = "completed";
  interview.completedAt = new Date();
  interview.aiEvaluationCompleted = true;
  interview.aiEvaluationAt = new Date();
  await interview.save();

  // Non-blocking email dispatch with duplicate protection
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
              <div style="font-size: 42px; font-weight: 900; color: ${overallScore >= 70 ? '#34d399' : '#f59e0b'}; margin: 10px 0;">${overallScore}%</div>
              <span style="display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; background-color: ${overallScore >= 70 ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)'}; color: ${overallScore >= 70 ? '#34d399' : '#f59e0b'}; border: 1px solid ${overallScore >= 70 ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'};">${result.recommendation}</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr style="border-bottom: 1px solid #1e293b;"><td style="padding: 10px 0; color: #94a3b8; font-size: 13px;">Aptitude Round (25 Qs)</td><td style="padding: 10px 0; text-align: right; font-weight: bold; color: #e2e8f0; font-size: 14px;">${aptitudePercentage}%</td></tr>
              <tr style="border-bottom: 1px solid #1e293b;"><td style="padding: 10px 0; color: #94a3b8; font-size: 13px;">Technical Stack Round (25 Qs)</td><td style="padding: 10px 0; text-align: right; font-weight: bold; color: #e2e8f0; font-size: 14px;">${technicalPercentage}%</td></tr>
              <tr style="border-bottom: 1px solid #1e293b;"><td style="padding: 10px 0; color: #94a3b8; font-size: 13px;">Coding IDE Round (3 Qs)</td><td style="padding: 10px 0; text-align: right; font-weight: bold; color: #e2e8f0; font-size: 14px;">${codingPercentage}%</td></tr>
              <tr style="border-bottom: 1px solid #1e293b;"><td style="padding: 10px 0; color: #94a3b8; font-size: 13px;">HR Behavioral Round (5 Qs)</td><td style="padding: 10px 0; text-align: right; font-weight: bold; color: #e2e8f0; font-size: 14px;">${hrPercentage}%</td></tr>
            </table>
            <div style="text-align: center; margin: 25px 0;"><a href="${resultLink}" style="display: inline-block; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: bold; background-color: #2563eb; color: #ffffff; text-decoration: none;">View Full Result</a></div>
            <div style="margin-bottom: 16px;"><h3 style="font-size: 14px; color: #34d399; margin-bottom: 8px;">Key Strengths Identified</h3><ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px;">${strengths.map((s) => `<li>${s}</li>`).join("")}</ul></div>
            <div style="margin-bottom: 20px;"><h3 style="font-size: 14px; color: #f87171; margin-bottom: 8px;">Recommended Focus Areas</h3><ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px;">${(weaknesses.length > 0 ? weaknesses : ["No major weaknesses identified"]).map((w) => `<li>${w}</li>`).join("")}</ul></div>
          </div>
          <div style="text-align: center; padding-top: 16px; border-top: 1px solid #334155; font-size: 12px; color: #64748b;"><p>PrepHire AI Interview Platform • Automated Evaluation System</p></div>
        </div>`;
      const emailRes = await sendReportEmail(recipientEmail, emailSubject, emailText, emailHtml);
      const finalEmailStatus = emailRes?.simulated ? "SIMULATED" : emailRes?.success ? "SENT" : "FAILED";
      result.email = { recipient: recipientEmail, status: finalEmailStatus, sentAt: new Date(), error: null };
      await result.save();
    } catch (emailErr) {
      console.warn("Interview completion email dispatch notice:", emailErr.message);
      result.email = { recipient: recipientEmail, status: "FAILED", sentAt: new Date(), error: emailErr.message };
      await result.save();
    }
  }

  return { result, alreadyCompleted: false };
}
