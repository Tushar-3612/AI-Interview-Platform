import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";
import Interview from "../models/Interview.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================================
   CSV EXPORT DIRECTORY
   Admin backup & export only.
   MongoDB remains primary database.
   ================================ */
const EXPORTS_DIR = path.join(__dirname, "..", "exports");

const CSV_FILES = {
  users: path.join(EXPORTS_DIR, "users.csv"),
  interviews: path.join(EXPORTS_DIR, "interviews.csv"),
  answers: path.join(EXPORTS_DIR, "answers.csv"),
  results: path.join(EXPORTS_DIR, "results.csv"),
};

const CSV_HEADERS = {
  users: "id,name,email,department,year,attemptUsed,createdAt",
  interviews:
    "id,userId,status,resumeFileName,startedAt,completedAt,totalQuestions,questionsAnswered,createdAt",
  answers:
    "id,interviewId,userId,questionId,questionType,question,answer,score,feedback,createdAt",
  results:
    "id,interviewId,userId,overallScore,resumeScore,technicalScore,codingScore,recommendation,createdAt",
};

/**
 * Escape CSV field values to handle commas and quotes.
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
 * Ensure exports directory and CSV files exist with headers.
 */
export const initializeCSVExports = () => {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }

  Object.entries(CSV_HEADERS).forEach(([key, header]) => {
    const filePath = CSV_FILES[key];
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, header + "\n", "utf-8");
      console.log(`Created CSV: ${key}.csv`);
    }
  });
};

/**
 * Write rows to a CSV file from MongoDB data.
 */
const writeCSV = (fileKey, headers, rows) => {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCSV(row[h])).join(",")
  );
  fs.writeFileSync(CSV_FILES[fileKey], [headerLine, ...dataLines].join("\n") + "\n", "utf-8");
};

/* ================================
   FULL SYNC — Rebuild CSV from MongoDB
   ================================ */

export const exportUsersCSV = async () => {
  const users = await User.find().select("-password").lean();

  writeCSV(
    "users",
    ["id", "name", "email", "department", "year", "attemptUsed", "createdAt"],
    users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      department: u.department,
      year: u.year,
      attemptUsed: u.attemptUsed,
      createdAt: u.createdAt?.toISOString() || "",
    }))
  );

  console.log(`Exported ${users.length} users to users.csv`);
};

export const exportInterviewsCSV = async () => {
  const interviews = await Interview.find().lean();

  writeCSV(
    "interviews",
    [
      "id", "userId", "status", "resumeFileName", "startedAt",
      "completedAt", "totalQuestions", "questionsAnswered", "createdAt",
    ],
    interviews.map((i) => ({
      id: i._id.toString(),
      userId: i.userId?.toString() || "",
      status: i.status,
      resumeFileName: i.resumeFileName || "",
      startedAt: i.startedAt?.toISOString() || "",
      completedAt: i.completedAt?.toISOString() || "",
      totalQuestions: i.totalQuestions,
      questionsAnswered: i.questionsAnswered,
      createdAt: i.createdAt?.toISOString() || "",
    }))
  );

  console.log(`Exported ${interviews.length} interviews to interviews.csv`);
};

export const exportAnswersCSV = async () => {
  const answers = await Answer.find().lean();

  writeCSV(
    "answers",
    [
      "id", "interviewId", "userId", "questionId", "questionType",
      "question", "answer", "score", "feedback", "createdAt",
    ],
    answers.map((a) => ({
      id: a._id.toString(),
      interviewId: a.interviewId?.toString() || "",
      userId: a.userId?.toString() || "",
      questionId: a.questionId,
      questionType: a.questionType || "",
      question: a.question || "",
      answer: a.answer || "",
      score: a.score ?? "",
      feedback: a.feedback || "",
      createdAt: a.createdAt?.toISOString() || "",
    }))
  );

  console.log(`Exported ${answers.length} answers to answers.csv`);
};

export const exportResultsCSV = async () => {
  const results = await Result.find().lean();

  writeCSV(
    "results",
    [
      "id", "interviewId", "userId", "overallScore", "resumeScore",
      "technicalScore", "codingScore", "recommendation", "createdAt",
    ],
    results.map((r) => ({
      id: r._id.toString(),
      interviewId: r.interviewId?.toString() || "",
      userId: r.userId?.toString() || "",
      overallScore: r.overallScore ?? "",
      resumeScore: r.resumeScore ?? "",
      technicalScore: r.technicalScore ?? "",
      codingScore: r.codingScore ?? "",
      recommendation: r.recommendation || "",
      createdAt: r.createdAt?.toISOString() || "",
    }))
  );

  console.log(`Exported ${results.length} results to results.csv`);
};

/* ================================
   EVENT HOOKS — Auto-update CSV
   Called after database mutations.
   ================================ */

/** Triggered when a new student registers */
export const onUserRegistered = async () => {
  await exportUsersCSV();
};

/** Triggered when an interview session starts */
export const onInterviewStarted = async () => {
  await exportInterviewsCSV();
};

/** Triggered when an interview session completes */
export const onInterviewCompleted = async () => {
  await exportInterviewsCSV();
};

/** Triggered when a final result is generated */
export const onResultGenerated = async () => {
  await exportResultsCSV();
};

/** Triggered when an answer is submitted */
export const onAnswerSubmitted = async () => {
  await exportAnswersCSV();
};

/** Full sync — rebuild all CSV files from MongoDB */
export const syncAllExports = async () => {
  await exportUsersCSV();
  await exportInterviewsCSV();
  await exportAnswersCSV();
  await exportResultsCSV();
  console.log("All CSV exports synced successfully");
};

export default {
  initializeCSVExports,
  exportUsersCSV,
  exportInterviewsCSV,
  exportAnswersCSV,
  exportResultsCSV,
  onUserRegistered,
  onInterviewStarted,
  onInterviewCompleted,
  onResultGenerated,
  onAnswerSubmitted,
  syncAllExports,
};
