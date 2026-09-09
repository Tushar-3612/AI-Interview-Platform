import PDFDocument from "pdfkit";

/**
 * Generates a professional, text-based PDF report for Individual Project / Resume Practice.
 * Strictly uses persisted database result/session data (ZERO AI calls executed).
 */
export function generateIndividualProjectReportPDF({ result, session, user, res }) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 50, left: 40, right: 40 },
    info: {
      Title: `Individual Project Practice Report - ${user?.name || "Student"}`,
      Author: "AI Interview Platform",
      Subject: "Individual Project Assessment Report",
    },
  });

  const candidateName = (user?.name || "Student").trim();
  const safeFileName = `Individual_Project_Result_${candidateName.replace(/[^a-zA-Z0-9]/g, "_")}_${session?.sessionId || result?.sessionId}.pdf`;

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
  doc.fontSize(10).font("Helvetica").fillColor(COLOR_MUTED).text("Individual Project / Resume Practice Report", 40, y + 24);

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

  doc.font("Helvetica-Bold").text(`Practice Type: `, 48, metaY, { continued: true }).font("Helvetica").text("Individual Project / Resume Practice");
  doc.font("Helvetica-Bold").text(`Source Mode: `, 300, metaY, { continued: true }).font("Helvetica").text(session.sourceMode || "RESUME");
  metaY += 14;

  doc.font("Helvetica-Bold").text(`Difficulty Mode: `, 48, metaY, { continued: true }).font("Helvetica").text(session.difficulty || "Mixed");
  doc.font("Helvetica-Bold").text(`Total Questions: `, 300, metaY, { continued: true }).font("Helvetica").text("10 Project Questions");
  
  y += 78;

  // --- SCORE OVERVIEW CARD ---
  const obtainedScore = Number(result.obtainedScore || 0);
  const maxScore = 100;
  const percentage = Number(result.percentage || 0);
  const attemptedCount = Number(result.attemptedCount || 0);
  const unattemptedCount = Number(result.unattemptedCount || Math.max(0, 10 - attemptedCount));
  const performanceStatus = result.performanceStatus || "NOT ASSESSED";

  let statusBadgeColor = COLOR_MUTED;
  if (performanceStatus === "Strong Performance") statusBadgeColor = COLOR_GREEN;
  else if (performanceStatus === "Developing") statusBadgeColor = COLOR_AMBER;
  else if (performanceStatus === "Needs Significant Improvement") statusBadgeColor = COLOR_RED;

  doc.rect(40, y, 515, 75).fillAndStroke(COLOR_BG_LIGHT, COLOR_BORDER);

  // Big Score Display
  doc.fillColor(COLOR_BRAND).fontSize(28).font("Helvetica-Bold").text(`${obtainedScore}`, 58, y + 14);
  doc.fillColor(COLOR_MUTED).fontSize(12).font("Helvetica").text(`/ 100 Marks`, 115, y + 26);
  doc.fillColor(COLOR_PRIMARY).fontSize(11).font("Helvetica-Bold").text(`Score (${percentage}%)`, 58, y + 48);

  // Status Badge
  doc.rect(220, y + 16, 170, 22).fillColor(statusBadgeColor).fill();
  doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold").text(performanceStatus, 220, y + 22, { width: 170, align: "center" });

  // Attempted Statistics
  doc.fillColor(COLOR_PRIMARY).fontSize(9).font("Helvetica-Bold");
  doc.text(`Attempted: `, 410, y + 18, { continued: true }).font("Helvetica").fillColor(COLOR_GREEN).text(`${attemptedCount} / 10`);
  doc.fillColor(COLOR_PRIMARY).font("Helvetica-Bold").text(`Unattempted: `, 410, y + 36, { continued: true }).font("Helvetica").fillColor(COLOR_MUTED).text(`${unattemptedCount} / 10`);

  y += 90;

  // --- EXECUTIVE SUMMARY & FEEDBACK ---
  doc.fillColor(COLOR_PRIMARY).fontSize(12).font("Helvetica-Bold").text("Executive Summary & Feedback", 40, y);
  y += 18;

  const insight = result.feedback?.performanceInsight || "The candidate completed the project assessment.";
  doc.fillColor(COLOR_TEXT).fontSize(9).font("Helvetica").text(insight, 40, y, { width: 515 });
  y += doc.heightOfString(insight, { width: 515 }) + 10;

  if (Array.isArray(result.feedback?.whatWentWell) && result.feedback.whatWentWell.length > 0) {
    doc.fillColor(COLOR_GREEN).fontSize(9).font("Helvetica-Bold").text("Key Strengths:", 40, y);
    y += 12;
    result.feedback.whatWentWell.forEach((item) => {
      doc.fillColor(COLOR_TEXT).fontSize(8.5).font("Helvetica").text(`• ${item}`, 50, y, { width: 505 });
      y += 12;
    });
    y += 6;
  }

  if (Array.isArray(result.feedback?.weakAreas) && result.feedback.weakAreas.length > 0) {
    doc.fillColor(COLOR_RED).fontSize(9).font("Helvetica-Bold").text("Areas for Growth:", 40, y);
    y += 12;
    result.feedback.weakAreas.forEach((item) => {
      doc.fillColor(COLOR_TEXT).fontSize(8.5).font("Helvetica").text(`• ${item}`, 50, y, { width: 505 });
      y += 12;
    });
    y += 6;
  }

  y += 15;

  // --- DETAILED QUESTION BREAKDOWN (10 QUESTIONS) ---
  doc.fillColor(COLOR_PRIMARY).fontSize(12).font("Helvetica-Bold").text("Detailed Question & Answer Breakdown (10 Questions)", 40, y);
  y += 18;

  const questionResults = Array.isArray(result.questionResults) ? result.questionResults : [];

  questionResults.forEach((qItem, idx) => {
    // Check page overflow
    if (y > 720) {
      doc.addPage();
      y = 40;
    }

    const qNum = idx + 1;
    const qText = qItem.question || `Question ${qNum}`;
    const diff = qItem.difficulty || "Medium";
    const topic = qItem.topic || "Project Architecture";
    const projName = qItem.projectName || "Project";
    const rawScore = Number(qItem.rawScore || 0);
    const rawMax = Number(qItem.rawMaxScore || 10);
    const candidateAns = qItem.candidateAnswer || "(No answer provided)";
    const feedbackText = qItem.feedback || "";
    const improvedAns = qItem.improvedAnswer || "";

    // Question Container Header Box
    doc.rect(40, y, 515, 20).fillAndStroke(COLOR_PRIMARY, COLOR_PRIMARY);
    doc.fillColor("#ffffff").fontSize(8.5).font("Helvetica-Bold");
    doc.text(`Q${qNum}. [${diff.toUpperCase()}] ${topic} (${projName})`, 46, y + 5);
    doc.text(`Score: ${rawScore} / ${rawMax}`, 450, y + 5, { width: 100, align: "right" });

    y += 24;

    // Question Body
    doc.fillColor(COLOR_PRIMARY).fontSize(9).font("Helvetica-Bold").text(qText, 44, y, { width: 505 });
    y += doc.heightOfString(qText, { width: 505 }) + 8;

    // Candidate Answer Box
    doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica-Bold").text("Candidate Answer:", 44, y);
    y += 10;

    const isAnsEmpty = candidateAns === "(No answer provided)" || !qItem.attempted;
    doc.fillColor(isAnsEmpty ? COLOR_RED : COLOR_TEXT)
       .fontSize(8)
       .font(isAnsEmpty ? "Helvetica-Oblique" : "Helvetica")
       .text(candidateAns, 44, y, { width: 505 });

    y += doc.heightOfString(candidateAns, { width: 505 }) + 8;

    // Evaluation & Feedback Box
    if (feedbackText) {
      doc.fillColor(COLOR_BRAND).fontSize(8).font("Helvetica-Bold").text("Evaluator Feedback:", 44, y);
      y += 10;
      doc.fillColor(COLOR_TEXT).fontSize(8).font("Helvetica").text(feedbackText, 44, y, { width: 505 });
      y += doc.heightOfString(feedbackText, { width: 505 }) + 6;
    }

    if (Array.isArray(qItem.missingPoints) && qItem.missingPoints.length > 0) {
      doc.fillColor(COLOR_AMBER).fontSize(8).font("Helvetica-Bold").text("Missing Key Concepts:", 44, y);
      y += 10;
      qItem.missingPoints.forEach((mp) => {
        doc.fillColor(COLOR_TEXT).fontSize(7.5).font("Helvetica").text(`- ${mp}`, 52, y, { width: 495 });
        y += 10;
      });
      y += 4;
    }

    if (improvedAns) {
      doc.fillColor(COLOR_GREEN).fontSize(8).font("Helvetica-Bold").text("Recommended Exemplar Answer:", 44, y);
      y += 10;
      doc.fillColor(COLOR_TEXT).fontSize(7.5).font("Helvetica-Oblique").text(improvedAns, 44, y, { width: 505 });
      y += doc.heightOfString(improvedAns, { width: 505 }) + 6;
    }

    y += 12;
    doc.moveTo(40, y).lineTo(555, y).strokeColor(COLOR_BORDER).dash(2, { space: 2 }).stroke().undash();
    y += 12;
  });

  // Footer on all pages
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fontSize(7.5).font("Helvetica").fillColor(COLOR_MUTED).text(
      `Individual Project Practice Report | Session ID: ${session.sessionId || result.sessionId} | Page ${i + 1} of ${totalPages}`,
      40,
      800,
      { align: "center", width: 515 }
    );
  }

  doc.end();
}
