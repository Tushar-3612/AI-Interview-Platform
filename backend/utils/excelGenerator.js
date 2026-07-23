import XLSX from "xlsx";

export function generateReportExcel(exportData, res) {
  const wb = XLSX.utils.book_new();

  const summaryWS = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, summaryWS, "Student Summary");

  const currentDate = new Date().toISOString().split("T")[0];
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="report_export_${currentDate}.xlsx"`);
  res.send(buffer);
}

export function generateFullReportExcel(reportData, res) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Student Summary
  const summaryRows = (reportData.students || []).map(s => ({
    "Student Name": s.name || s.profile?.name || "",
    "Email": s.email || s.profile?.email || "",
    "Department": s.department || s.profile?.department || "",
    "Year": s.year || s.profile?.year || "",
    "ATS Score": s.atsScore ?? s.profile?.atsScore ?? "",
    "Best Percentage": s.bestPercentage != null ? `${s.bestPercentage}%` : "",
    "Tests Taken": s.tests?.length || s.results?.length || 0,
  }));
  const summaryWS = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWS, "Student Summary");

  // Sheet 2: Section Summary
  const sectionRows = [];
  for (const student of reportData.students || []) {
    const name = student.name || student.profile?.name || "";
    for (const tr of student.tests || student.results || []) {
      for (const sec of tr.sections || []) {
        sectionRows.push({
          "Student": name,
          "Test": tr.testTitle || tr.testId?.title || "",
          "Section": sec.section,
          "Correct": sec.correct,
          "Wrong": sec.wrong,
          "Skipped": sec.skipped,
          "Marks": `${sec.obtainedMarks}/${sec.totalMarks}`,
          "Percentage": `${sec.percentage}%`,
        });
      }
    }
  }
  const sectionWS = XLSX.utils.json_to_sheet(sectionRows);
  XLSX.utils.book_append_sheet(wb, sectionWS, "Section Summary");

  // Sheet 3: Practice Summary
  if (reportData.practiceSummary?.length) {
    const practiceRows = reportData.practiceSummary.map(p => ({
      "Company": p.company,
      "Attempts": p.attempts,
      "Highest Score": p.highestScore ?? "",
      "Average Score": p.averageScore ?? "",
      "Latest Score": p.latestScore ?? "",
    }));
    const practiceWS = XLSX.utils.json_to_sheet(practiceRows);
    XLSX.utils.book_append_sheet(wb, practiceWS, "Practice Summary");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="full_report_${new Date().toISOString().split("T")[0]}.xlsx"`);
  res.send(buffer);
}
