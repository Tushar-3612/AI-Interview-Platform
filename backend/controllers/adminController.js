import User from "../models/User.js";
import Interview from "../models/Interview.js";
import Result from "../models/Result.js";
import Answer from "../models/Answer.js";
import {
  exportUsersCSV,
  exportInterviewsCSV,
  exportAnswersCSV,
  exportResultsCSV,
  syncAllExports,
} from "../utils/csvExporter.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================================
   ADMIN STATS
   GET /api/admin/stats
   ================================ */
export const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalInterviews,
      completedInterviews,
      allResults,
    ] = await Promise.all([
      User.countDocuments(),
      Interview.countDocuments(),
      Interview.countDocuments({ status: "completed" }),
      Result.find().select("overallScore recommendation"),
    ]);

    const avgScore =
      allResults.length > 0
        ? Math.round(
            allResults.reduce((sum, r) => sum + (r.overallScore || 0), 0) /
              allResults.length
          )
        : 0;

    const highlyRecommended = allResults.filter(
      (r) => r.recommendation === "Highly Recommended"
    ).length;

    res.json({
      totalUsers,
      totalInterviews,
      completedInterviews,
      avgScore,
      highlyRecommended,
      totalResults: allResults.length,
    });
  } catch (error) {
    console.error("Admin Stats Error:", error.message);
    res.status(500).json({ message: "Failed to fetch admin statistics" });
  }
};

/* ================================
   ALL USERS
   GET /api/admin/users
   ================================ */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    // Attach interview count per user
    const userIds = users.map((u) => u._id);
    const interviewCounts = await Interview.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
    ]);

    const countMap = {};
    interviewCounts.forEach((c) => {
      countMap[c._id.toString()] = c;
    });

    const enrichedUsers = users.map((u) => {
      const counts = countMap[u._id.toString()] || { count: 0, completed: 0 };
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        department: u.department,
        year: u.year,
        portfolio: u.portfolio,
        github: u.github,
        linkedin: u.linkedin,
        attemptUsed: u.attemptUsed,
        interviewCount: counts.count,
        completedCount: counts.completed,
        createdAt: u.createdAt,
      };
    });

    res.json(enrichedUsers);
  } catch (error) {
    console.error("Get All Users Error:", error.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

/* ================================
   ALL RESULTS
   GET /api/admin/results
   ================================ */
export const getAllResults = async (req, res) => {
  try {
    const results = await Result.find()
      .populate("userId", "name email department year")
      .populate("interviewId", "status resumeFileName startedAt completedAt candidateProfile")
      .sort({ createdAt: -1 });

    res.json(results);
  } catch (error) {
    console.error("Get All Results Error:", error.message);
    res.status(500).json({ message: "Failed to fetch results" });
  }
};

/* ================================
   ALL INTERVIEWS
   GET /api/admin/interviews
   ================================ */
export const getAllInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find()
      .populate("userId", "name email department year")
      .sort({ createdAt: -1 })
      .select("-generatedQuestions");

    res.json(interviews);
  } catch (error) {
    console.error("Get All Interviews Error:", error.message);
    res.status(500).json({ message: "Failed to fetch interviews" });
  }
};

/* ================================
   CSV DOWNLOAD ENDPOINTS
   GET /api/admin/export/:type
   ================================ */
export const exportCSV = async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ["users", "interviews", "answers", "results"];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid export type" });
    }

    // Sync the requested CSV fresh from MongoDB
    if (type === "users") await exportUsersCSV();
    else if (type === "interviews") await exportInterviewsCSV();
    else if (type === "answers") await exportAnswersCSV();
    else if (type === "results") await exportResultsCSV();

    const filePath = path.join(__dirname, "..", "exports", `${type}.csv`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Export file not found" });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${type}_export_${Date.now()}.csv"`
    );
    res.sendFile(filePath);
  } catch (error) {
    console.error("CSV Export Error:", error.message);
    res.status(500).json({ message: "Failed to export CSV" });
  }
};

/* ================================
   FULL SYNC — rebuild all CSVs
   POST /api/admin/sync
   ================================ */
export const syncCSV = async (req, res) => {
  try {
    await syncAllExports();
    res.json({ message: "All CSV exports synced successfully" });
  } catch (error) {
    console.error("Sync CSV Error:", error.message);
    res.status(500).json({ message: "Failed to sync CSV exports" });
  }
};
