import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";

const ORANGE = "#FF6B35";
const NAVY = "#38BDF8";
const DARK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const SOFT = "#F9FAFB";
const PURPLE = "#7C3AED";

const LOGO = path.resolve("public/images/metadata.png");

const rgb = (h) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function na(v) {
  if (v == null || v === "") return "N/A";
  if (typeof v === "number" && Number.isNaN(v)) return "N/A";
  return v;
}

function accuracy(a, b) {
  return b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : "N/A";
}

function newPage(doc, p, title) {
  if (p.page > 0) doc.addPage();
  p.page += 1;
  if (fs.existsSync(LOGO)) {
    const b64 = fs.readFileSync(LOGO).toString("base64");
    doc.addImage(`data:image/png;base64,${b64}`, "PNG", 40, 34, 100, 22);
  }
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...rgb(MUTED));
  doc.text("AI PLACEMENT PLATFORM", 555, 42, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...rgb(DARK));
  doc.text(title, 555, 56, { align: "right" });
  doc.setDrawColor(...rgb(LINE)).setLineWidth(0.8);
  doc.line(40, 92, 555, 92);
  p.y = 108;
}

function section(doc, p, text) {
  p.y += 6;
  doc.setFillColor(...rgb(ORANGE));
  doc.rect(40, p.y, 4, 13, "F");
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...rgb(DARK));
  doc.text(text, 52, p.y + 10);
  p.y += 26;
}

function metricRow(doc, p, items) {
  const gap = 8;
  const w = (515 - gap * (items.length - 1)) / items.length;
  const h = 52;
  const x0 = 40;
  const y0 = p.y;
  items.forEach((it, i) => {
    const x = x0 + i * (w + gap);
    doc.setFillColor(...rgb(SOFT));
    doc.roundedRect(x, y0, w, h, 5, 5, "F");
    doc.setDrawColor(...rgb(LINE)).setLineWidth(0.8);
    doc.roundedRect(x, y0, w, h, 5, 5, "S");
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...rgb(it.color || ORANGE));
    doc.text(String(na(it.value)), x + w / 2, y0 + 22, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...rgb(MUTED));
    doc.text(it.label, x + w / 2, y0 + 38, { align: "center", maxWidth: w - 8 });
  });
  p.y = y0 + h + 14;
}

function bar(doc, p, label, value, total, color) {
  const y = p.y;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(DARK));
  doc.text(label, 40, y + 8, { maxWidth: 150 });
  const bx = 200;
  const bw = 300;
  doc.setFillColor(...rgb("#EEF0F2"));
  doc.roundedRect(bx, y, bw, 9, 3, 3, "F");
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  if (pct > 0) {
    doc.setFillColor(...rgb(color || ORANGE));
    doc.roundedRect(bx, y, bw * pct, 9, 3, 3, "F");
  }
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(MUTED));
  doc.text(String(na(value)), bx + bw + 6, y + 8);
  p.y = y + 16;
}

function table(doc, p, headers, rows, colX, aligns) {
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...rgb(ORANGE));
  headers.forEach((h, i) => doc.text(h, colX[i], p.y, { align: aligns[i] }));
  p.y += 4;
  doc.setDrawColor(...rgb(LINE)).setLineWidth(0.6);
  doc.line(40, p.y, 555, p.y);
  p.y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(DARK));
  rows.forEach((row) => {
    if (p.y > 760) {
      doc.addPage();
      p.y = 60;
    }
    row.forEach((cell, i) =>
      doc.text(String(na(cell)), colX[i], p.y, { align: aligns[i], maxWidth: colX[i + 1] ? colX[i + 1] - colX[i] - 4 : 100 })
    );
    p.y += 14;
    doc.setDrawColor(...rgb("#F1F2F4")).setLineWidth(0.5);
    doc.line(40, p.y - 4, 555, p.y - 4);
  });
  p.y += 8;
}

export const generatePlacementPDF = (res, { data, student, reportType = "overview", scopeLabel }) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const p = { page: 0, y: 108 };
  const genDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const title =
    reportType === "student"
      ? "STUDENT PERFORMANCE REPORT"
      : reportType === "company"
      ? "COMPANY PREPARATION REPORT"
      : "PLACEMENT PREPARATION REPORT";

  // PAGE 1
  newPage(doc, p, title);
  if (student) {
    section(doc, p, "Student");
    const info = [];
    if (student.name) info.push(["Student Name", student.name]);
    if (student.department) info.push(["Department", student.department]);
    if (student.year) info.push(["Academic Year", student.year]);
    info.push(["Section", student.section || "N/A"]);
    if (student.atsScore != null && student.atsScore !== "") info.push(["ATS Score", student.atsScore]);
    if (scopeLabel) info.push(["Scope", scopeLabel]);
    info.push(["Generated Date", genDate]);
    table(doc, p, ["Field", "Value"], info, [40, 200], ["left", "left"]);
  } else if (reportType === "company" && data.companies[0]) {
    section(doc, p, "Company");
    table(doc, p, ["Field", "Value"], [
      ["Company Name", data.companies[0].name],
      ["Scope", scopeLabel || "All activity"],
      ["Generated Date", genDate],
    ], [40, 200], ["left", "left"]);
  } else {
    section(doc, p, "Report");
    table(doc, p, ["Field", "Value"], [
      ["Scope", scopeLabel || "All Students"],
      ["Generated Date", genDate],
    ], [40, 200], ["left", "left"]);
  }

  section(doc, p, "Placement Preparation Snapshot");
  metricRow(doc, p, [
    { label: "Coding Problems Solved", value: data.overview.codingSolved, color: ORANGE },
    { label: "Aptitude Questions Attempted", value: data.overview.aptitudeAttempted, color: NAVY },
    { label: "Mock Interviews Completed", value: data.overview.mockCompleted, color: PURPLE },
    { label: "Companies Practiced", value: data.companies.length, color: DARK },
  ]);

  // PAGE 2
  newPage(doc, p, "Coding Performance");
  section(doc, p, "Summary");
  metricRow(doc, p, [
    { label: "Problems Attempted", value: data.coding.attempted, color: ORANGE },
    { label: "Problems Solved", value: data.coding.solved, color: "#10B981" },
    { label: "Failed Attempts", value: data.coding.failed, color: "#EF4444" },
    { label: "Accuracy", value: `${data.coding.accuracy}%`, color: NAVY },
  ]);

  section(doc, p, "Difficulty Breakdown");
  const diffTotal = Object.values(data.coding.byDifficulty).reduce((a, b) => a + b, 0);
  if (diffTotal > 0) {
    Object.entries(data.coding.byDifficulty).forEach(([d, v]) => bar(doc, p, d, v, diffTotal, ORANGE));
  } else {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(MUTED));
    doc.text("Difficulty data not available for these submissions.", 40, p.y + 6);
    p.y += 18;
  }

  section(doc, p, "Topic Performance");
  if (data.coding.byTopic.length) {
    table(doc, p, ["Topic", "Attempted", "Solved", "Accuracy"],
      data.coding.byTopic.map((t) => [t.topic, t.attempted, t.solved, accuracy(t.solved, t.attempted)]),
      [40, 300, 380, 460], ["left", "left", "left", "left"]);
  } else {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(MUTED));
    doc.text("Topic data not available for these submissions.", 40, p.y + 6);
    p.y += 18;
  }

  section(doc, p, "Company Preparation");
  const codingCompanies = data.companies.filter((c) => c.codingAttempted > 0);
  if (codingCompanies.length) {
    table(doc, p, ["Company", "Attempted", "Solved", "Accuracy"],
      codingCompanies.map((c) => [c.name, c.codingAttempted, c.codingSolved, accuracy(c.codingSolved, c.codingAttempted)]),
      [40, 300, 380, 460], ["left", "left", "left", "left"]);
  } else {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(MUTED));
    doc.text("No company coding activity in this scope.", 40, p.y + 6);
    p.y += 18;
  }
  // PAGE 3
  newPage(doc, p, "Aptitude Performance");
  section(doc, p, "Summary");
  metricRow(doc, p, [
    { label: "Questions Attempted", value: data.aptitude.attempted, color: NAVY },
    { label: "Correct", value: data.aptitude.correct, color: "#10B981" },
    { label: "Incorrect", value: data.aptitude.wrong, color: "#EF4444" },
    { label: "Accuracy", value: `${data.aptitude.accuracy}%`, color: ORANGE },
  ]);

  section(doc, p, "Category Performance");
  if (data.aptitude.byTopic.length) {
    table(doc, p, ["Category", "Attempted", "Correct", "Accuracy"],
      data.aptitude.byTopic.map((t) => [t.topic, t.attempted, t.correct, accuracy(t.correct, t.attempted)]),
      [40, 300, 380, 460], ["left", "left", "left", "left"]);
  } else {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(MUTED));
    doc.text("No aptitude practice in this scope.", 40, p.y + 6);
    p.y += 18;
  }

  section(doc, p, "Company Preparation");
  const aptCompanies = data.companies.filter((c) => c.aptitudeAttempted > 0);
  if (aptCompanies.length) {
    table(doc, p, ["Company", "Attempted", "Correct", "Accuracy"],
      aptCompanies.map((c) => [c.name, c.aptitudeAttempted, c.aptitudeCorrect, accuracy(c.aptitudeCorrect, c.aptitudeAttempted)]),
      [40, 300, 380, 460], ["left", "left", "left", "left"]);
  } else {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(MUTED));
    doc.text("No company aptitude activity in this scope.", 40, p.y + 6);
    p.y += 18;
  }

  // PAGE 4
  newPage(doc, p, "AI Mock Interview Performance");
  section(doc, p, "Summary");
  metricRow(doc, p, [
    { label: "Interviews Completed", value: data.mock.completed, color: PURPLE },
    { label: "Average Score", value: na(data.mock.avgOverall), color: ORANGE },
    { label: "Technical", value: na(data.mock.scores ? data.mock.scores.technical : null), color: NAVY },
    { label: "HR", value: na(data.mock.scores ? data.mock.scores.hr : null), color: NAVY },
  ]);
  metricRow(doc, p, [
    { label: "Communication", value: na(data.mock.scores ? data.mock.scores.communication : null), color: NAVY },
    { label: "Confidence", value: na(data.mock.scores ? data.mock.scores.confidence : null), color: NAVY },
    { label: "Attempted", value: data.mock.attempted, color: DARK },
    { label: "Types", value: data.mock.byType.length || "N/A", color: DARK },
  ]);

  section(doc, p, "Interview History");
  if (data.mock.history.length) {
    table(doc, p, ["Date", "Type", "Company", "Score", "Status"],
      data.mock.history.map((h) => [
        h.date ? new Date(h.date).toLocaleDateString("en-IN") : "N/A",
        h.type,
        h.company,
        na(h.overallScore),
        h.overallScore != null ? "Completed" : "Incomplete",
      ]),
      [40, 150, 250, 380, 460], ["left", "left", "left", "left", "left"]);
  } else {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(MUTED));
    doc.text("No completed mock interviews in this scope.", 40, p.y + 6);
    p.y += 18;
  }

  // PAGE 5
  newPage(doc, p, "Company Preparation");
  section(doc, p, "Company-wise Activity");
  if (data.companies.length) {
    table(doc, p, ["Company", "Coding", "Aptitude", "Mock", "Activity"],
      data.companies.map((c) => [
        c.name,
        `${c.codingSolved}/${c.codingAttempted}`,
        `${c.aptitudeCorrect}/${c.aptitudeAttempted}`,
        `${c.mockCompleted}/${c.mockAttempted}`,
        c.activity,
      ]),
      [40, 250, 330, 410, 480], ["left", "left", "left", "left", "left"]);
  } else {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...rgb(MUTED));
    doc.text("No company activity available in this scope.", 40, p.y + 6);
    p.y += 18;
  }

  // PAGE 6
  newPage(doc, p, "Placement Preparation Summary");
  section(doc, p, "Performance Highlights");
  const topCoding = [...data.coding.byTopic].sort((a, b) => b.solved - a.solved)[0];
  const topApt = [...data.aptitude.byTopic].sort((a, b) => b.correct - a.correct)[0];
  const topCompany = [...data.companies].sort((a, b) => b.activity - a.activity)[0];
  const highlights = [
    ["Coding Problems Solved", data.overview.codingSolved],
    ["Aptitude Questions Attempted", data.overview.aptitudeAttempted],
    ["Mock Interviews Completed", data.overview.mockCompleted],
    ["Strongest Coding Topic", topCoding ? `${topCoding.topic} (${topCoding.solved} solved)` : "N/A"],
    ["Strongest Aptitude Topic", topApt ? `${topApt.topic} (${topApt.correct} correct)` : "N/A"],
    ["Most Practiced Company", topCompany ? topCompany.name : "N/A"],
    ["Interview Progress", `${data.mock.completed}/${data.mock.attempted} completed`],
  ];
  table(doc, p, ["Metric", "Value"], highlights, [40, 260], ["left", "left"]);

  section(doc, p, "Areas to Improve");
  const improve = [];
  if (data.coding.accuracy < 50) improve.push("Coding accuracy is below 50% - focus on test-case coverage.");
  if (data.aptitude.accuracy < 50) improve.push("Aptitude accuracy is below 50% - practice more categories.");
  const weakTopic = [...data.coding.byTopic].sort((a, b) => a.accuracy - b.accuracy)[0];
  if (weakTopic && weakTopic.attempted >= 3 && weakTopic.accuracy < 50)
    improve.push(`Low coding performance in "${weakTopic.topic}" (${weakTopic.accuracy}%).`);
  const weakApt = [...data.aptitude.byTopic].sort((a, b) => a.accuracy - b.accuracy)[0];
  if (weakApt && weakApt.attempted >= 3 && weakApt.accuracy < 50)
    improve.push(`Low aptitude performance in "${weakApt.topic}" (${weakApt.accuracy}%).`);
  if (data.mock.completed === 0) improve.push("No completed mock interviews yet - schedule practice interviews.");
  if (!improve.length) improve.push("No major weak areas detected from current real data.");
  improve.forEach((t) => {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...rgb(ORANGE));
    doc.text("-", 40, p.y + 8);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...rgb(DARK));
    const lines = doc.splitTextToSize(t, 483);
    doc.text(lines, 52, p.y + 8);
    p.y += 14 * lines.length + 4;
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...rgb(MUTED));
    doc.text(`Page ${i}`, 40, 800, { align: "left" });
    doc.text("AI Placement Platform - Confidential", 555, 800, { align: "right" });
  }

  const buf = Buffer.from(doc.output("arraybuffer"));
  res.send(buf);
};


