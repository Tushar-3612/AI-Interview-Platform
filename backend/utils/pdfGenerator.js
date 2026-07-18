import PDFDocument from "pdfkit";

/**
 * Generates a styled, professional PDF report of a student's performance.
 * @param {Object} student - The student user document.
 * @param {Array} interviews - The list of student's interviews.
 * @param {Array} results - The list of student's results.
 * @returns {Promise<Buffer>} - Resolves with PDF file binary buffer.
 */
export const generateStudentPDF = (student, interviews, results) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Colors
      const primaryColor = "#2563eb";
      const secondaryColor = "#0f172a";
      const grayColor = "#475569";
      const lightGrayColor = "#f8fafc";
      const successColor = "#10b981";

      // Draw Top Header Background Accent Bar
      doc.rect(0, 0, 595.28, 15).fill(primaryColor);

      doc.moveDown(2);

      // Title & Institution
      doc
        .fillColor(primaryColor)
        .fontSize(22)
        .text("SANJIVANI AI INTERVIEW PLATFORM", { align: "center", font: "Helvetica-Bold" });
      
      doc
        .fillColor(secondaryColor)
        .fontSize(13)
        .text("Student Interview Performance & Evaluation Report", { align: "center" });

      doc.moveDown(1.5);

      // ----------------------------------------------------
      // SECTION 1: PERSONAL PROFILE
      // ----------------------------------------------------
      doc.fillColor(primaryColor).fontSize(14).text("1. Student Profile", { font: "Helvetica-Bold" });
      doc.rect(50, doc.y + 2, 495.28, 1).fill(primaryColor);
      doc.moveDown(0.5);

      doc.fillColor(secondaryColor).fontSize(10);
      const profileItems = [
        ["Full Name:", student.name],
        ["Email:", student.email],
        ["Phone Number:", student.phone || "Not Provided"],
        ["Department:", student.department],
        ["Academic Year:", student.year],
        ["Portfolio URL:", student.portfolio || "Not Provided"],
        ["GitHub Link:", student.github || "Not Provided"],
        ["LinkedIn Link:", student.linkedin || "Not Provided"],
      ];

      profileItems.forEach(([label, value]) => {
        doc.fillColor(grayColor).text(label, { width: 120, continued: true });
        doc.fillColor(secondaryColor).text(` ${value}`);
      });

      doc.moveDown(1.5);

      // ----------------------------------------------------
      // SECTION 2: RESUME & ATS METRICS
      // ----------------------------------------------------
      doc.fillColor(primaryColor).fontSize(14).text("2. Resume & ATS Analysis", { font: "Helvetica-Bold" });
      doc.rect(50, doc.y + 2, 495.28, 1).fill(primaryColor);
      doc.moveDown(0.5);

      doc.fillColor(secondaryColor).fontSize(10);
      doc.text(`Uploaded Resume: ${student.resumeFileName || "No resume uploaded"}`);
      
      if (student.resumeUploadedAt) {
        doc.text(`Upload Timestamp: ${new Date(student.resumeUploadedAt).toLocaleString()}`);
      }
      
      doc.moveDown(0.2);
      doc.text("ATS Score: ", { continued: true });
      doc.fillColor(successColor).text(`${student.atsScore || 0}%`, { font: "Helvetica-Bold" });
      doc.fillColor(secondaryColor);
      
      doc.text(`Skills Extracted: ${student.skills && student.skills.length > 0 ? student.skills.join(", ") : "No skills indexed"}`);

      doc.moveDown(1.5);

      // ----------------------------------------------------
      // SECTION 3: INTERVIEW METRICS SUMMARY
      // ----------------------------------------------------
      doc.fillColor(primaryColor).fontSize(14).text("3. Placement Interview Summary", { font: "Helvetica-Bold" });
      doc.rect(50, doc.y + 2, 495.28, 1).fill(primaryColor);
      doc.moveDown(0.5);

      const practiceCount = interviews.filter(i => i.interviewType === "practice").length;
      const realCount = interviews.filter(i => i.interviewType === "real").length;
      const overallScores = results.map(r => r.overallScore).filter(s => s !== undefined);
      const avgScore = overallScores.length > 0 
        ? Math.round(overallScores.reduce((a, b) => a + b, 0) / overallScores.length) 
        : 0;
      const topScore = overallScores.length > 0 ? Math.max(...overallScores) : 0;

      doc.fillColor(secondaryColor).fontSize(10);
      doc.text(`Practice Interviews Completed: ${practiceCount}`);
      doc.text(`Real Mock Interviews Completed: ${realCount}`);
      doc.text(`Average Mock Interview Score: ${avgScore}%`);
      doc.text(`Highest Score Achieved: ${topScore}%`);

      doc.moveDown(1.5);

      // ----------------------------------------------------
      // SECTION 4: REAL INTERVIEW DETAILS
      // ----------------------------------------------------
      doc.fillColor(primaryColor).fontSize(14).text("4. Real Mock Interview Records", { font: "Helvetica-Bold" });
      doc.rect(50, doc.y + 2, 495.28, 1).fill(primaryColor);
      doc.moveDown(0.5);

      const realInterviews = interviews.filter(i => i.interviewType === "real");
      if (realInterviews.length === 0) {
        doc.fillColor(grayColor).text("No AI-graded real interviews logged for this student.");
      } else {
        realInterviews.forEach((interview, idx) => {
          const result = results.find(r => r.interviewId.toString() === interview._id.toString());
          
          doc.fillColor(secondaryColor).fontSize(11).text(`Interview Attempt #${idx + 1} - ${new Date(interview.createdAt).toLocaleDateString()}`, { font: "Helvetica-Bold" });
          doc.fontSize(10);
          doc.text(`Status: ${interview.status.toUpperCase()}`);
          
          if (result) {
            doc.text(`Scores — Overall: ${result.overallScore}%, Resume match: ${result.resumeScore || 0}%, Tech: ${result.technicalScore || 0}%, Coding: ${result.codingScore || 0}%`);
            doc.fillColor(grayColor).text(`Key Strengths: ${result.strengths?.join(", ") || "N/A"}`);
            doc.text(`Areas to Focus: ${result.weaknesses?.join(", ") || "N/A"}`);
            doc.fillColor(secondaryColor).text(`Placement Advice: ${result.recommendation || "N/A"}`);
          }
          doc.moveDown(0.8);
        });
      }

      // Draw footer line and text
      doc.rect(50, 750, 495.28, 1).fill(borderThemeColor);
      doc.fillColor(grayColor).fontSize(8).text("Generated by Sanjivani AI Interview Platform Admin Panel", 50, 760, { align: "left" });
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 350, 760, { align: "right" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default {
  generateStudentPDF,
};
