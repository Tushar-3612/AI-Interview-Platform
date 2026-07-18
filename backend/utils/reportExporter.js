/**
 * Utility to escape CSV fields.
 */
const escapeCSV = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Compiles a detailed CSV string for a single student.
 * Contains distinct blocks: Profile, Resume, Interview metrics, and attempts history.
 */
export const exportSingleStudentCSV = (student, interviews, results) => {
  const lines = [];

  // Title
  lines.push("STUDENT PERFORMANCE REPORT - AI INTERVIEW PLATFORM");
  lines.push(`Generated On: ${new Date().toLocaleString()}`);
  lines.push("");

  // Block 1: Profile
  lines.push("1. PROFILE DETAILS");
  lines.push("Field,Value");
  lines.push(`ID,${student._id.toString()}`);
  lines.push(`Name,${student.name}`);
  lines.push(`Email,${student.email}`);
  lines.push(`Phone,${student.phone || ""}`);
  lines.push(`Department,${student.department}`);
  lines.push(`Academic Year,${student.year}`);
  lines.push(`Portfolio,${student.portfolio || ""}`);
  lines.push(`GitHub,${student.github || ""}`);
  lines.push(`LinkedIn,${student.linkedin || ""}`);
  lines.push(`Skills,${(student.skills || []).join(" | ")}`);
  lines.push("");

  // Block 2: Resume & ATS
  lines.push("2. RESUME & ATS METRICS");
  lines.push("Field,Value");
  lines.push(`Resume Filename,${student.resumeFileName || "None"}`);
  lines.push(`Uploaded At,${student.resumeUploadedAt ? new Date(student.resumeUploadedAt).toLocaleString() : "N/A"}`);
  lines.push(`ATS Score,${student.atsScore || 0}%`);
  lines.push("");

  // Block 3: Aggregated Metrics
  const practiceAttempts = interviews.filter(i => i.interviewType === "practice");
  const realAttempts = interviews.filter(i => i.interviewType === "real");
  const realScores = results.map(r => r.overallScore).filter(s => s !== undefined);
  const avgScore = realScores.length > 0 ? Math.round(realScores.reduce((a, b) => a + b, 0) / realScores.length) : 0;
  const maxScore = realScores.length > 0 ? Math.max(...realScores) : 0;

  lines.push("3. INTERVIEW METRICS SUMMARY");
  lines.push("Metric,Value");
  lines.push(`Total Practice Attempts,${practiceAttempts.length}`);
  lines.push(`Total Real Attempts,${realAttempts.length}`);
  lines.push(`Average Mock Score,${avgScore}%`);
  lines.push(`Highest Score Achieved,${maxScore}%`);
  lines.push("");

  // Block 4: Real Interviews History
  lines.push("4. REAL AI INTERVIEWS HISTORY");
  lines.push("Date,Status,Overall Score,Resume Score,Tech Score,Coding Score,Strengths,Weaknesses,Recommendation");

  realAttempts.forEach((attempt) => {
    const res = results.find(r => r.interviewId.toString() === attempt._id.toString());
    const dateStr = new Date(attempt.createdAt).toLocaleDateString();
    
    if (res) {
      lines.push([
        escapeCSV(dateStr),
        escapeCSV(attempt.status),
        escapeCSV(`${res.overallScore}%`),
        escapeCSV(`${res.resumeScore || 0}%`),
        escapeCSV(`${res.technicalScore || 0}%`),
        escapeCSV(`${res.codingScore || 0}%`),
        escapeCSV((res.strengths || []).join(" | ")),
        escapeCSV((res.weaknesses || []).join(" | ")),
        escapeCSV(res.recommendation || "")
      ].join(","));
    } else {
      lines.push([
        escapeCSV(dateStr),
        escapeCSV(attempt.status),
        "N/A", "N/A", "N/A", "N/A", "", "", ""
      ].join(","));
    }
  });

  return lines.join("\n");
};

/**
 * Compiles a CSV list of all students with summaries and marks.
 */
export const exportAllStudentsCSV = (students, allInterviews, allResults) => {
  const headers = [
    "ID", "Name", "Email", "Phone", "Department", "Year",
    "Portfolio", "GitHub", "LinkedIn", "Skills",
    "Resume File Name", "Resume Uploaded At", "ATS Score",
    "Practice Attempts", "Real Attempts", "Avg Score", "Highest Score",
  ];

  const lines = [headers.join(",")];

  students.forEach((student) => {
    const studentId = student._id.toString();
    const studentInterviews = allInterviews.filter(i => i.userId.toString() === studentId);
    
    const practiceAttempts = studentInterviews.filter(i => i.interviewType === "practice").length;
    const realAttempts = studentInterviews.filter(i => i.interviewType === "real").length;

    const studentResults = allResults.filter(r => r.userId.toString() === studentId);
    const scores = studentResults.map(r => r.overallScore).filter(s => s !== undefined);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;

    const row = [
      escapeCSV(studentId),
      escapeCSV(student.name),
      escapeCSV(student.email),
      escapeCSV(student.phone || ""),
      escapeCSV(student.department),
      escapeCSV(student.year),
      escapeCSV(student.portfolio || ""),
      escapeCSV(student.github || ""),
      escapeCSV(student.linkedin || ""),
      escapeCSV((student.skills || []).join(" | ")),
      escapeCSV(student.resumeFileName || ""),
      escapeCSV(student.resumeUploadedAt ? new Date(student.resumeUploadedAt).toISOString() : ""),
      escapeCSV(student.atsScore || 0),
      escapeCSV(practiceAttempts),
      escapeCSV(realAttempts),
      escapeCSV(`${avgScore}%`),
      escapeCSV(`${highestScore}%`),
    ];

    lines.push(row.join(","));
  });

  return lines.join("\n");
};

export default {
  exportSingleStudentCSV,
  exportAllStudentsCSV,
};
