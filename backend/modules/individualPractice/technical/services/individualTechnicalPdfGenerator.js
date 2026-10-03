import PDFDocument from "pdfkit";

/**
 * Generates a professional, text-based PDF report for Individual Technical Practice.
 * Strictly uses persisted database result/session data (ZERO AI calls executed).
 */
export function generateIndividualTechnicalReportPDF({ result, session, user, res }) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 50, left: 40, right: 40 },
    info: {
      Title: `Individual Technical Practice Report - ${user?.name || "Student"}`,
      Author: "AI Interview Platform",
      Subject: "Individual Technical Assessment Report",
    },
  });

  const candidateName = (user?.name || "Student").trim();
  const safeFileName = `Individual_Technical_Result_${candidateName.replace(/[^a-zA-Z0-9]/g, "_")}_${session?.sessionId || result?.sessionId}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  doc.pipe(res);

  // --- BRAND COLORS ---
  const COLOR_BRAND = "#f97316"; // Prephire Orange
  const COLOR_PRIMARY = "#0f172a"; // Dark Slate
  const COLOR_TEXT = "#334155";
  const COLOR_MUTED = "#64748b";
  const COLOR_BORDER = "#cbd5e1";
  const COLOR_BG_LIGHT = "#f8fafc";
  const COLOR_GREEN = "#16a34a";
  const COLOR_AMBER = "#d97706";
  const COLOR_RED = "#dc2626";

  let y = 40;

  // --- HEADER ---
  doc.fontSize(20).font("Helvetica-Bold").fillColor(COLOR_BRAND).text("AI INTERVIEW PLATFORM", 40, y);
  doc.fontSize(10).font("Helvetica").fillColor(COLOR_MUTED).text("Individual Technical Practice Report", 40, y + 24);

  doc.fontSize(9).font("Helvetica-Bold").fillColor(COLOR_PRIMARY).text("PERFORMANCE REPORT", 400, y, { align: "right" });
  doc.fontSize(8).font("Helvetica").fillColor(COLOR_MUTED).text(`Date: ${new Date(result.createdAt || Date.now()).toLocaleDateString()}`, 400, y + 14, { align: "right" });
  
  y += 42;
  doc.moveTo(40, y).lineTo(555, y).strokeColor(COLOR_BORDER).stroke();
  y += 15;

  // --- CANDIDATE & SESSION METADATA BOX ---
  doc.rect(40, y, 515, 65).fillAndStroke(COLOR_BG_LIGHT, COLOR_BORDER);
  let metaY = y + 8;
  
  doc.fillColor(COLOR_PRIMARY).fontSize(9).font("Helvetica-Bold");
  doc.text(`Candidate Name: `, 48, metaY, { continued: true }).font("Helvetica").text(candidateName);
  doc.font("Helvetica-Bold").text(`Practice ID: `, 300, metaY, { continued: true }).font("Helvetica").text(session.sessionId || result.sessionId);
  metaY += 14;

  doc.font("Helvetica-Bold").text(`Practice Type: `, 48, metaY, { continued: true }).font("Helvetica").text("Individual Technical Practice");
  doc.font("Helvetica-Bold").text(`Source Mode: `, 300, metaY, { continued: true }).font("Helvetica").text(session.sourceMode || "RESUME");
  metaY += 14;

  doc.font("Helvetica-Bold").text(`Difficulty Mode: `, 48, metaY, { continued: true }).font("Helvetica").text(session.difficulty || "Mixed");
  doc.font("Helvetica-Bold").text(`Total Questions: `, 300, metaY, { continued: true }).font("Helvetica").text("20 Technical Questions");
  
  y += 78;

  // --- SCORE OVERVIEW CARD ---
  const obtainedScore = Number(result.obtainedScore || 0);
  const maxScore = 100;
  const percentage = Number(result.percentage || 0);
  const attemptedCount = Number(result.attemptedCount || 0);
  const unattemptedCount = Number(result.unattemptedCount || 0);
  const performanceStatus = result.performanceStatus || "NOT ASSESSED";

  let statusBadgeColor = COLOR_MUTED;
  if (performanceStatus === "Strong Performance") statusBadgeColor = COLOR_GREEN;
  else if (performanceStatus === "Developing") statusBadgeColor = COLOR_AMBER;
  else if (performanceStatus === "Needs Significant Improvement") statusBadgeColor = COLOR_RED;

  doc.rect(40, y, 515, 75).fillAndStroke(COLOR_BG_LIGHT, COLOR_BORDER);
  doc.fillColor(COLOR_PRIMARY).fontSize(11).font("Helvetica-Bold").text("OVERALL TECHNICAL PERFORMANCE", 48, y + 10);
  doc.fillColor(statusBadgeColor).fontSize(10).font("Helvetica-Bold").text(performanceStatus, 380, y + 10, { width: 165, align: "right" });

  let scoreY = y + 32;
  doc.fontSize(8).font("Helvetica-Bold").fillColor(COLOR_MUTED);
  doc.text("TOTAL SCORE", 55, scoreY, { width: 100, align: "center" });
  doc.text("PERCENTAGE", 175, scoreY, { width: 100, align: "center" });
  doc.text("ATTEMPTED", 295, scoreY, { width: 100, align: "center" });
  doc.text("UNATTEMPTED", 415, scoreY, { width: 100, align: "center" });

  scoreY += 13;
  doc.fontSize(14).font("Helvetica-Bold").fillColor(COLOR_PRIMARY);
  doc.text(`${obtainedScore} / ${maxScore}`, 55, scoreY, { width: 100, align: "center" });
  doc.fillColor(COLOR_BRAND).text(`${percentage}%`, 175, scoreY, { width: 100, align: "center" });
  doc.fillColor(COLOR_GREEN).text(`${attemptedCount} / 20`, 295, scoreY, { width: 100, align: "center" });
  doc.fillColor(COLOR_MUTED).text(`${unattemptedCount} / 20`, 415, scoreY, { width: 100, align: "center" });

  y += 90;

  // --- EVIDENCE-BASED EVALUATION FEEDBACK ---
  doc.fillColor(COLOR_PRIMARY).fontSize(11).font("Helvetica-Bold").text("PERFORMANCE FEEDBACK & INSIGHTS", 40, y);
  y += 16;

  const feedback = result.feedback || {};
  const insightText = feedback.performanceInsight || `Completed ${attemptedCount} of 20 technical questions with ${percentage}% accuracy.`;
  const strengths = Array.isArray(feedback.whatWentWell) ? feedback.whatWentWell : [];
  const weakAreas = Array.isArray(feedback.weakAreas) ? feedback.weakAreas : [];
  const nextStep = feedback.recommendedNextStep || "Review weak technical areas and practice targeted drills.";

  doc.rect(40, y, 515, 80).fillAndStroke("#ffffff", COLOR_BORDER);
  doc.fillColor(COLOR_PRIMARY).fontSize(8.5).font("Helvetica-Bold").text("Performance Insight:", 48, y + 8);
  doc.fillColor(COLOR_TEXT).fontSize(8).font("Helvetica").text(insightText, 48, y + 20, { width: 498 });

  let fbSubY = y + 36;
  if (strengths.length > 0) {
    doc.fillColor(COLOR_GREEN).fontSize(8).font("Helvetica-Bold").text(`Key Strengths: `, 48, fbSubY, { continued: true })
       .font("Helvetica").fillColor(COLOR_TEXT).text(strengths.slice(0, 2).join("; "));
    fbSubY += 12;
  }
  if (weakAreas.length > 0) {
    doc.fillColor(COLOR_AMBER).fontSize(8).font("Helvetica-Bold").text(`Focus Areas: `, 48, fbSubY, { continued: true })
       .font("Helvetica").fillColor(COLOR_TEXT).text(weakAreas.slice(0, 2).join("; "));
    fbSubY += 12;
  }
  doc.fillColor(COLOR_BRAND).fontSize(8).font("Helvetica-Bold").text(`Next Step: `, 48, fbSubY, { continued: true })
     .font("Helvetica").fillColor(COLOR_TEXT).text(nextStep);

  y += 95;

  // --- QUESTION-WISE DETAILED REVIEW (ALL 20 QUESTIONS) ---
  if (y > 680) {
    doc.addPage();
    y = 40;
  }

  const questionResults = Array.isArray(result.questionResults) ? result.questionResults : [];
  doc.fillColor(COLOR_PRIMARY).fontSize(11).font("Helvetica-Bold").text(`DETAILED QUESTION REVIEW (${questionResults.length} QUESTIONS)`, 40, y);
  y += 18;

  for (let i = 0; i < questionResults.length; i++) {
    const q = questionResults[i];

    if (y > 680) {
      doc.addPage();
      y = 40;
    }

    const isAttempted = Boolean(q.attempted);
    const qDifficulty = q.difficulty || "Medium";
    const qTopic = q.topic || "Technical";
    const qScore = Number(q.rawScore ?? 0);
    const qMaxScore = Number(q.rawMaxScore ?? (qDifficulty === "Easy" ? 3 : qDifficulty === "Hard" ? 13 : 5));

    // Top Header Banner for Question
    doc.rect(40, y, 515, 18).fillAndStroke("#f1f5f9", COLOR_BORDER);
    doc.fillColor(COLOR_BRAND).fontSize(8).font("Helvetica-Bold").text(`QUESTION ${String(i + 1).padStart(2, "0")}`, 48, y + 5);
    doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica").text(`Difficulty: ${qDifficulty} | Topic: ${qTopic}`, 140, y + 5);
    
    if (isAttempted) {
      doc.fillColor(COLOR_GREEN).fontSize(8).font("Helvetica-Bold").text("ATTEMPTED", 340, y + 5);
    } else {
      doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica-Bold").text("NOT ATTEMPTED", 340, y + 5);
    }

    doc.fillColor(COLOR_PRIMARY).fontSize(8).font("Helvetica-Bold").text(`Marks: ${qScore} / ${qMaxScore}`, 450, y + 5, { width: 95, align: "right" });
    y += 18;

    const qText = String(q.question || "Technical Question").trim();
    const candidateAns = isAttempted && q.candidateAnswer && q.candidateAnswer.trim()
      ? q.candidateAnswer.trim()
      : "NOT ATTEMPTED";
    const feedbackText = isAttempted
      ? String(q.feedback || "Answer evaluated based on technical principles.").trim()
      : "Not assessed because no answer was submitted.";
    const improvedAns = String(q.improvedAnswer || "").trim();

    doc.fontSize(8).font("Helvetica-Bold");
    const qTextHeight = doc.heightOfString(`Question: ${qText}`, { width: 495 });

    doc.fontSize(8).font("Helvetica");
    const ansTextHeight = doc.heightOfString(`Candidate Answer:\n${candidateAns}`, { width: 495 });

    let extraHeight = doc.heightOfString(`AI Review:\n${feedbackText}`, { width: 495 }) + 4;
    if (improvedAns) {
      extraHeight += doc.heightOfString(`Improved / Key Concepts Answer:\n${improvedAns}`, { width: 495 }) + 4;
    }

    const cardBodyHeight = Math.max(45, qTextHeight + ansTextHeight + extraHeight + 12);

    if (y + cardBodyHeight > 760) {
      doc.addPage();
      y = 40;
    }

    doc.rect(40, y, 515, cardBodyHeight).fillAndStroke("#ffffff", COLOR_BORDER);

    let currentY = y + 6;
    doc.fillColor(COLOR_PRIMARY).fontSize(8).font("Helvetica-Bold").text(`Question: ${qText}`, 48, currentY, { width: 495 });
    currentY += qTextHeight + 4;

    doc.fillColor(isAttempted ? COLOR_PRIMARY : COLOR_MUTED).fontSize(8).font(isAttempted ? "Helvetica" : "Helvetica-Oblique")
       .text(`Candidate Answer: ${candidateAns}`, 48, currentY, { width: 495 });
    currentY += ansTextHeight + 4;

    doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica-Oblique").text(`AI Review: ${feedbackText}`, 48, currentY, { width: 495 });
    currentY += doc.heightOfString(`AI Review: ${feedbackText}`, { width: 495 }) + 4;

    if (improvedAns) {
      doc.fillColor(COLOR_GREEN).fontSize(8).font("Helvetica").text(`Improved / Key Concepts Answer: ${improvedAns}`, 48, currentY, { width: 495 });
      currentY += doc.heightOfString(`Improved / Key Concepts Answer: ${improvedAns}`, { width: 495 }) + 4;
    }

    y += cardBodyHeight + 8;
  }

  // --- FOOTER ON FINAL PAGE ---
  const bottomY = doc.page.height - 40;
  doc.moveTo(40, bottomY - 10).lineTo(555, bottomY - 10).strokeColor(COLOR_BORDER).stroke();
  doc.fontSize(8).fillColor(COLOR_MUTED).font("Helvetica")
    .text(`Generated on ${new Date().toLocaleDateString()} | Individual Technical Practice Report | AI Interview Platform`, 40, bottomY - 4, { align: "center" });

  doc.end();
}
