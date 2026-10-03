import PDFDocument from "pdfkit";

function buildStudentReportDoc(reportData, doc) {
  // Header
  doc.fontSize(22).font("Helvetica-Bold")
    .fillColor("#2563eb")
    .text("AI Interview Platform", { align: "center" });
  doc.fontSize(10).font("Helvetica")
    .fillColor("#666")
    .text("Student Performance Report", { align: "center" })
    .moveDown(0.5);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke().moveDown(1);

  // Student Profile
  const p = reportData.profile;
  doc.fontSize(14).fillColor("#333").font("Helvetica-Bold").text("Student Profile").moveDown(0.5);
  doc.fontSize(10).font("Helvetica").fillColor("#444");
  const profileFields = [
    ["Name", p.name],
    ["Email", p.email],
    ["Phone", p.phone],
    ["Department", p.department],
    ["Academic Year", p.year],
    ["ATS Score", p.atsScore != null ? `${p.atsScore}/100` : "N/A"],
    ["Skills", (p.skills || []).join(", ") || "N/A"],
  ];
  if (p.github) profileFields.push(["GitHub", p.github]);
  if (p.linkedin) profileFields.push(["LinkedIn", p.linkedin]);
  if (p.portfolio) profileFields.push(["Portfolio", p.portfolio]);

  profileFields.forEach(([label, value]) => {
    doc.font("Helvetica-Bold").text(`  ${label}: `, { continued: true })
       .font("Helvetica").text(`${value}`);
  });
  doc.moveDown(1);

  // Test Results
  if (reportData.testResults?.length) {
    doc.fontSize(14).fillColor("#333").font("Helvetica-Bold").text("Test Results").moveDown(0.5);
    for (const tr of reportData.testResults) {
      doc.fontSize(11).fillColor("#2563eb").font("Helvetica-Bold")
        .text(`${tr.testTitle} (${tr.testType})`).moveDown(0.2);
      doc.fontSize(10).fillColor("#444").font("Helvetica");
      doc.text(`  Grade: ${tr.grade}  |  Percentage: ${tr.percentage}%  |  ${tr.passed ? "PASSED" : "FAILED"}`);
      doc.text(`  Score: ${tr.obtainedMarks}/${tr.totalMarks}  |  Correct: ${tr.correct}  |  Wrong: ${tr.wrong}  |  Skipped: ${tr.skipped}`);
      if (tr.sections?.length) {
        tr.sections.forEach(s => {
          doc.text(`  ${s.section}: ${s.obtainedMarks}/${s.totalMarks} (${s.percentage}%)`);
        });
      }
      doc.moveDown(0.5);
    }
    doc.moveDown(0.5);
  }

  // Practice Summary
  if (reportData.practiceSummary?.length) {
    doc.fontSize(14).fillColor("#333").font("Helvetica-Bold").text("Practice Interview Summary").moveDown(0.5);
    doc.fontSize(10).fillColor("#444").font("Helvetica");
    const headerY = doc.y;
    doc.font("Helvetica-Bold");
    doc.text("Company", 50, headerY, { width: 100 });
    doc.text("Attempts", 160, headerY, { width: 60, align: "center" });
    doc.text("Highest", 230, headerY, { width: 60, align: "center" });
    doc.text("Average", 300, headerY, { width: 60, align: "center" });
    doc.text("Latest", 370, headerY, { width: 60, align: "center" });
    doc.moveDown(0.3);

    doc.font("Helvetica");
    let rowY = doc.y;
    for (const ps of reportData.practiceSummary) {
      doc.text(ps.company, 50, rowY, { width: 100 });
      doc.text(String(ps.attempts), 160, rowY, { width: 60, align: "center" });
      doc.text(ps.highestScore != null ? String(ps.highestScore) : "-", 230, rowY, { width: 60, align: "center" });
      doc.text(ps.averageScore != null ? String(ps.averageScore) : "-", 300, rowY, { width: 60, align: "center" });
      doc.text(ps.latestScore != null ? String(ps.latestScore) : "-", 370, rowY, { width: 60, align: "center" });
      rowY += 18;
    }
    doc.y = rowY + 5;
  }

  // AI Evaluation Summary
  const ai = reportData.aiEvaluation;
  if (ai) {
    // Company Match
    if (ai.companyMatch?.recommendations?.length) {
      doc.fontSize(14).fillColor("#333").font("Helvetica-Bold").text("Company Recommendations").moveDown(0.5);
      doc.fontSize(10).fillColor("#444").font("Helvetica");
      for (const r of ai.companyMatch.recommendations) {
        doc.text(`  ${r.company}: ${r.matchPercentage}% match`);
        if (r.rationale) doc.fontSize(9).fillColor("#666").text(`    ${r.rationale}`).fontSize(10).fillColor("#444");
      }
      doc.moveDown(0.5);
    }

    // Placement Readiness
    if (ai.interviewReadiness) {
      const ir = ai.interviewReadiness;
      doc.fontSize(14).fillColor("#333").font("Helvetica-Bold").text("Placement Readiness").moveDown(0.5);
      doc.fontSize(10).fillColor("#444").font("Helvetica");
      doc.text(`  Technical: ${ir.technicalReadiness || "N/A"}%`);
      doc.text(`  Coding: ${ir.codingReadiness || "N/A"}%`);
      doc.text(`  Communication: ${ir.communicationReadiness || "N/A"}%`);
      doc.text(`  Overall: ${ir.overallPlacementReadiness || "N/A"}%`);
      doc.moveDown(0.5);
    }

    // AI Feedback
    if (ai.feedback) {
      const fb = ai.feedback;
      doc.fontSize(14).fillColor("#333").font("Helvetica-Bold").text("AI Feedback").moveDown(0.5);
      doc.fontSize(10).fillColor("#444").font("Helvetica");
      if (fb.positivePoints?.length) {
        doc.font("Helvetica-Bold").text("  Positive Points:").font("Helvetica");
        fb.positivePoints.forEach(p => doc.text(`    - ${p}`));
      }
      if (fb.weakAreas?.length) {
        doc.font("Helvetica-Bold").text("  Areas to Improve:").font("Helvetica");
        fb.weakAreas.forEach(w => doc.text(`    - ${w}`));
      }
      if (fb.practiceStrategy) doc.text(`  Practice Strategy: ${fb.practiceStrategy}`);
      if (fb.nextLearningPath) doc.text(`  Next Steps: ${fb.nextLearningPath}`);
    }
  }

  // Footer
  const bottomY = doc.page.height - 80;
  doc.y = bottomY;
  doc.moveTo(50, bottomY).lineTo(545, bottomY).strokeColor("#ddd").stroke().moveDown(0.3);
  doc.fontSize(8).fillColor("#999").font("Helvetica")
    .text(`Generated on ${new Date().toLocaleDateString()} | AI Interview Platform`, { align: "center" });

  doc.end();
}

export function generateStudentReportPDF(reportData, res) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Student Report - ${reportData.profile.name}`,
      Author: "AI Interview Platform",
      Subject: "Student Performance Report",
    },
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="report_${reportData.profile.name.replace(/\s+/g, "_")}.pdf"`);
  doc.pipe(res);
  buildStudentReportDoc(reportData, doc);
}

export function generateStudentReportBuffer(reportData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Student Report - ${reportData.profile.name}`,
        Author: "AI Interview Platform",
        Subject: "Student Performance Report",
      },
    });
    const buffers = [];
    doc.on("data", chunk => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
    buildStudentReportDoc(reportData, doc);
  });
}

export function generateBatchReportPDF(batchReport, res) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Batch Report - ${batchReport.department}`,
      Author: "AI Interview Platform",
      Subject: "Batch Performance Report",
    },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="batch_report_${batchReport.department.replace(/\s+/g, "_")}.pdf"`);
  doc.pipe(res);

  doc.fontSize(22).font("Helvetica-Bold").fillColor("#2563eb")
    .text("AI Interview Platform", { align: "center" });
  doc.fontSize(10).font("Helvetica").fillColor("#666")
    .text(`Batch Report - ${batchReport.department} (${batchReport.year})`, { align: "center" })
    .moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke().moveDown(1);

  const stats = batchReport.stats || {};
  doc.fontSize(14).fillColor("#333").font("Helvetica-Bold").text("Overview").moveDown(0.5);
  doc.fontSize(10).fillColor("#444").font("Helvetica");
  doc.text(`  Total Students: ${batchReport.totalStudents}`);
  doc.text(`  Average Marks: ${stats.averageMarks || 0}%`);
  doc.text(`  Highest Marks: ${stats.highestMarks || 0}%`);
  doc.text(`  Lowest Marks: ${stats.lowestMarks || 0}%`);
  doc.text(`  Pass Percentage: ${stats.passPercentage || 0}%`);
  doc.moveDown(1);

  if (batchReport.topStudents?.length) {
    doc.fontSize(14).fillColor("#333").font("Helvetica-Bold").text("Top Students").moveDown(0.5);
    doc.fontSize(10).fillColor("#444").font("Helvetica");
    const headerY = doc.y;
    doc.font("Helvetica-Bold");
    doc.text("#", 50, headerY, { width: 20 });
    doc.text("Name", 75, headerY, { width: 150 });
    doc.text("Best %", 250, headerY, { width: 60, align: "center" });
    doc.text("Tests", 320, headerY, { width: 60, align: "center" });
    doc.moveDown(0.3);

    doc.font("Helvetica");
    let rowY = doc.y;
    batchReport.topStudents.forEach((s, i) => {
      doc.text(String(i + 1), 50, rowY, { width: 20 });
      doc.text(s.name, 75, rowY, { width: 150 });
      doc.text(`${s.bestPercentage}%`, 250, rowY, { width: 60, align: "center" });
      doc.text(String(s.totalTests), 320, rowY, { width: 60, align: "center" });
      rowY += 18;
    });
    doc.y = rowY + 5;
  }

  const bottomY = doc.page.height - 80;
  doc.y = bottomY;
  doc.moveTo(50, bottomY).lineTo(545, bottomY).strokeColor("#ddd").stroke().moveDown(0.3);
  doc.fontSize(8).fillColor("#999").font("Helvetica")
    .text(`Generated on ${new Date().toLocaleDateString()} | AI Interview Platform`, { align: "center" });

  doc.end();
}
