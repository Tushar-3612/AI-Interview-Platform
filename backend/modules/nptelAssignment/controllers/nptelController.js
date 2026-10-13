import { ALL_NPTEL_QUESTIONS, NPTEL_TEST_META } from "../data/nptelQuestionsData.js";
import NptelAttempt from "../models/NptelAttempt.js";
import NptelQuestion from "../models/NptelQuestion.js";
import User from "../../auth/models/User.js";
import { parseQuestions } from "../../testEngine/utils/questionParser.js";

/**
 * Normalizes an answer string or array into a sorted array of trimmed strings
 */
function normalizeAnswers(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((s) => String(s).trim()).filter(Boolean);
  }
  return [String(val).trim()];
}

/**
 * Calculates question score based on user selection vs correct answers
 */
function evaluateQuestion(q, userSelection) {
  const selected = normalizeAnswers(userSelection);
  const correct = normalizeAnswers(q.correctAnswers);

  if (selected.length === 0) {
    return {
      pointsEarned: 0,
      isCorrect: false,
      isPartiallyCorrect: false,
      status: "unanswered",
    };
  }

  const correctSet = new Set(correct);
  const hasWrongOption = selected.some((opt) => !correctSet.has(opt));

  if (hasWrongOption) {
    return {
      pointsEarned: 0,
      isCorrect: false,
      isPartiallyCorrect: false,
      status: "incorrect",
    };
  }

  if (selected.length === correct.length) {
    return {
      pointsEarned: q.points || 1,
      isCorrect: true,
      isPartiallyCorrect: false,
      status: "correct",
    };
  }

  const partialPoints = Number(((selected.length / correct.length) * (q.points || 1)).toFixed(2));
  return {
    pointsEarned: partialPoints,
    isCorrect: false,
    isPartiallyCorrect: true,
    status: "partially_correct",
  };
}

/**
 * Ensures initial NPTEL questions are seeded in MongoDB if empty,
 * then retrieves active questions sorted by questionNumber.
 */
async function getOrSeedQuestions() {
  try {
    const count = await NptelQuestion.countDocuments({ isActive: true });
    if (count === 0) {
      console.log("Seeding NPTEL questions into database...");
      const seedDocs = ALL_NPTEL_QUESTIONS.map((q) => ({
        questionNumber: q.questionNumber,
        questionId: q.id || `q${q.questionNumber}`,
        sectionTitle: q.sectionTitle || "Introduction to Research",
        sectionBadge: q.sectionBadge || "NPTEL",
        weekNumber: q.weekNumber || Math.ceil(q.questionNumber / 10),
        questionText: q.questionText,
        type: q.type || "single",
        options: q.options,
        correctAnswers: q.correctAnswers,
        explanation: q.explanation || "",
        passageTitle: q.passageTitle || "",
        passage: q.passage || "",
        points: q.points || 1,
        difficulty: q.difficulty || "medium",
        isActive: true,
      }));
      await NptelQuestion.insertMany(seedDocs);
    }

    const docs = await NptelQuestion.find({ isActive: true }).sort({ questionNumber: 1 }).lean();
    if (docs && docs.length > 0) {
      return docs.map((q) => ({
        ...q,
        id: q.questionId || String(q._id),
      }));
    }
    return ALL_NPTEL_QUESTIONS;
  } catch (err) {
    console.warn("DB question retrieval fallback to static raw data:", err.message);
    return ALL_NPTEL_QUESTIONS;
  }
}

/**
 * GET /api/nptel/test
 * Returns the entire unified NPTEL assessment
 */
export async function getUnifiedTest(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const includeSolutions = req.query.includeSolutions === "true";

    let bestAttempt = null;
    if (userId) {
      try {
        const attempt = await NptelAttempt.findOne({ userId, weekId: "unified-test" })
          .sort({ score: -1 })
          .lean();
        if (attempt) {
          bestAttempt = {
            bestScore: attempt.score,
            maxScore: attempt.maxScore,
            percentage: attempt.percentage,
            lastAttemptAt: attempt.createdAt,
          };
        }
      } catch (err) {
        console.warn("DB lookup warning:", err.message);
      }
    }

    const activeQuestions = await getOrSeedQuestions();

    const questions = activeQuestions.map((q, idx) => ({
      id: q.id || q.questionId || `q${idx + 1}`,
      questionNumber: q.questionNumber || idx + 1,
      globalIndex: q.globalIndex || q.questionNumber || idx + 1,
      sectionTitle: q.sectionTitle || "Introduction to Research",
      sectionBadge: q.sectionBadge || "NPTEL",
      questionText: q.questionText,
      points: q.points || 1,
      type: q.type || (q.correctAnswers?.length > 1 ? "multiple" : "single"),
      options: q.options || [],
      passageTitle: q.passageTitle || null,
      passage: q.passage || null,
      ...(includeSolutions
        ? {
            correctAnswers: q.correctAnswers,
            explanation: q.explanation,
          }
        : {}),
    }));

    return res.status(200).json({
      success: true,
      test: {
        ...NPTEL_TEST_META,
        totalQuestions: questions.length,
        totalMarks: questions.reduce((sum, q) => sum + (q.points || 1), 0),
      },
      bestAttempt,
      totalQuestions: questions.length,
      questions,
    });
  } catch (error) {
    console.error("Error in getUnifiedTest:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve NPTEL test." });
  }
}

/**
 * POST /api/nptel/submit
 * Evaluates submitted answers for all questions
 */
export async function submitUnifiedTest(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { answers = {}, mode = "exam", timeSpentSeconds = 0 } = req.body;

    const activeQuestions = await getOrSeedQuestions();

    let totalScore = 0;
    let correctCount = 0;
    let partiallyCorrectCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const evaluatedQuestions = activeQuestions.map((q, idx) => {
      const qId = q.id || q.questionId || `q${idx + 1}`;
      const userSelection = answers[qId];
      const evaluation = evaluateQuestion(q, userSelection);

      totalScore += evaluation.pointsEarned;
      if (evaluation.isCorrect) {
        correctCount++;
      } else if (evaluation.isPartiallyCorrect) {
        partiallyCorrectCount++;
      } else if (evaluation.status === "unanswered") {
        unansweredCount++;
      } else {
        incorrectCount++;
      }

      return {
        id: qId,
        questionNumber: q.questionNumber || idx + 1,
        sectionTitle: q.sectionTitle || "Introduction to Research",
        sectionBadge: q.sectionBadge || "NPTEL",
        questionText: q.questionText,
        type: q.type || (q.correctAnswers?.length > 1 ? "multiple" : "single"),
        options: q.options,
        userSelection: userSelection || null,
        correctAnswers: q.correctAnswers,
        pointsEarned: evaluation.pointsEarned,
        maxPoints: q.points || 1,
        status: evaluation.status,
        explanation: q.explanation || "",
        passageTitle: q.passageTitle || null,
        passage: q.passage || null,
      };
    });

    totalScore = Number(totalScore.toFixed(2));
    const totalQuestions = activeQuestions.length;
    const answeredCount = totalQuestions - unansweredCount;
    const maxScore = activeQuestions.reduce((sum, q) => sum + (q.points || 1), 0);
    const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(1)) : 0;

    let attemptId = null;
    if (userId) {
      try {
        const attempt = await NptelAttempt.create({
          userId,
          weekId: "unified-test",
          weekNumber: 0,
          mode,
          totalQuestions: maxScore,
          correctCount,
          partiallyCorrectCount,
          incorrectCount,
          unansweredCount,
          answeredCount,
          score: totalScore,
          maxScore,
          percentage,
          timeSpentSeconds,
          userAnswers: answers,
        });
        attemptId = attempt._id;
      } catch (err) {
        console.warn("Could not save attempt to DB:", err.message);
      }
    }

    return res.status(200).json({
      success: true,
      title: NPTEL_TEST_META.title,
      score: totalScore,
      maxScore,
      totalQuestions,
      percentage,
      correctCount,
      partiallyCorrectCount,
      incorrectCount,
      unansweredCount,
      answeredCount,
      timeSpentSeconds,
      attemptId,
      results: evaluatedQuestions,
    });
  } catch (error) {
    console.error("Error in submitUnifiedTest:", error);
    return res.status(500).json({ success: false, message: "Failed to evaluate NPTEL test." });
  }
}

/**
 * GET /api/nptel/progress
 * Returns student's best score and history on the test
 */
export async function getUnifiedTestProgress(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(200).json({ success: true, progress: null });
    }

    const attempts = await NptelAttempt.find({ userId, weekId: "unified-test" })
      .sort({ createdAt: -1 })
      .lean();

    const bestScore = attempts.reduce((max, att) => Math.max(max, att.score || 0), 0);

    return res.status(200).json({
      success: true,
      totalAttempts: attempts.length,
      bestScore,
      maxScore: ALL_NPTEL_QUESTIONS.length,
      recentAttempts: attempts.slice(0, 5),
    });
  } catch (error) {
    console.error("Error in getUnifiedTestProgress:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch test progress." });
  }
}

/**
 * GET /api/nptel/leaderboard
 * Returns NPTEL candidates leaderboard and the current logged-in candidate's position
 */
export async function getNptelLeaderboard(req, res) {
  try {
    const currentUserId = req.user?._id || req.user?.id;

    // Aggregate attempts by user for unified-test (or general NPTEL attempts)
    const realAttempts = await NptelAttempt.find({
      $or: [{ weekId: "unified-test" }, { weekId: { $exists: false } }, { weekId: null }],
    })
      .populate("userId", "name email department avatar")
      .sort({ score: -1, timeSpentSeconds: 1, createdAt: -1 })
      .lean();

    // Group by user, keeping their best score and calculating total attempts
    const userBestMap = new Map();
    for (const att of realAttempts) {
      if (!att.userId) continue;
      const uId = String(att.userId._id || att.userId);
      const studentName = att.userId.name || att.userId.email?.split("@")[0] || "Student Candidate";
      const studentDept = att.userId.department || "Engineering";

      if (!userBestMap.has(uId)) {
        userBestMap.set(uId, {
          userId: uId,
          name: studentName,
          email: att.userId.email || "",
          department: studentDept,
          avatar: att.userId.avatar || null,
          score: att.score,
          maxScore: att.maxScore || 120,
          percentage: att.percentage,
          correctCount: att.correctCount,
          timeSpentSeconds: att.timeSpentSeconds || 0,
          attemptsCount: 1,
          createdAt: att.createdAt,
        });
      } else {
        const existing = userBestMap.get(uId);
        existing.attemptsCount += 1;
        // Keep highest score as best score
        if (
          att.score > existing.score ||
          (att.score === existing.score && (att.timeSpentSeconds || 0) < (existing.timeSpentSeconds || Infinity))
        ) {
          existing.score = att.score;
          existing.percentage = att.percentage;
          existing.correctCount = att.correctCount;
          existing.timeSpentSeconds = att.timeSpentSeconds;
          existing.createdAt = att.createdAt;
        }
      }
    }

    let leaderboard = Array.from(userBestMap.values());

    // Sort strictly by highest score descending, then by timeSpentSeconds ascending
    leaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.timeSpentSeconds || 0) - (b.timeSpentSeconds || 0);
    });

    // Assign ranks
    leaderboard = leaderboard.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    // Find current logged-in user position
    let currentUserRank = null;
    if (currentUserId) {
      const userEntry = leaderboard.find((item) => String(item.userId) === String(currentUserId));
      if (userEntry) {
        currentUserRank = {
          rank: userEntry.rank,
          ...userEntry,
        };
      }
    }

    return res.status(200).json({
      success: true,
      totalParticipants: leaderboard.length,
      leaderboard,
      currentUserRank,
    });
  } catch (error) {
    console.error("Error in getNptelLeaderboard:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch NPTEL leaderboard." });
  }
}

/* ============================================================
   ADMIN CONTROLLERS (MANAGE NPTEL QUESTIONS, UPLOAD PDF/JSON)
   ============================================================ */

/**
 * GET /api/nptel/admin/questions
 * Returns all NPTEL questions with search, filters, pagination
 */
export async function getAdminQuestions(req, res) {
  try {
    await getOrSeedQuestions();

    const { search = "", type = "", week = "", difficulty = "", page = 1, limit = 50 } = req.query;

    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { questionText: { $regex: search, $options: "i" } },
        { sectionTitle: { $regex: search, $options: "i" } },
        { explanation: { $regex: search, $options: "i" } },
      ];
    }
    if (type) {
      filter.type = type;
    }
    if (week) {
      filter.weekNumber = Number(week);
    }
    if (difficulty) {
      filter.difficulty = difficulty;
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [questions, totalCount, singleCount, multiCount] = await Promise.all([
      NptelQuestion.find(filter).sort({ questionNumber: 1 }).skip(skip).limit(Number(limit)).lean(),
      NptelQuestion.countDocuments(filter),
      NptelQuestion.countDocuments({ isActive: true, type: "single" }),
      NptelQuestion.countDocuments({ isActive: true, type: "multiple" }),
    ]);

    return res.status(200).json({
      success: true,
      count: questions.length,
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / Number(limit)),
      stats: {
        total: singleCount + multiCount,
        single: singleCount,
        multiple: multiCount,
      },
      questions,
    });
  } catch (error) {
    console.error("Error in getAdminQuestions:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch questions." });
  }
}

/**
 * POST /api/nptel/admin/questions
 * Creates a new NPTEL question
 */
export async function createAdminQuestion(req, res) {
  try {
    const {
      questionText,
      options = [],
      correctAnswers = [],
      type = "single",
      explanation = "",
      passageTitle = "",
      passage = "",
      sectionTitle = "Introduction to Research",
      weekNumber = 1,
      points = 1,
      difficulty = "medium",
    } = req.body;

    if (!questionText || !questionText.trim()) {
      return res.status(400).json({ success: false, message: "Question text is required." });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, message: "At least 2 options are required." });
    }
    if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) {
      return res.status(400).json({ success: false, message: "At least one correct answer is required." });
    }

    const highest = await NptelQuestion.findOne().sort({ questionNumber: -1 }).select("questionNumber").lean();
    const nextNum = (highest?.questionNumber || 0) + 1;

    const newQuestion = await NptelQuestion.create({
      questionNumber: nextNum,
      questionId: `q${nextNum}`,
      sectionTitle: sectionTitle || "Introduction to Research",
      sectionBadge: "NPTEL",
      weekNumber: Number(weekNumber) || Math.ceil(nextNum / 10),
      questionText: questionText.trim(),
      type: type === "multiple" || correctAnswers.length > 1 ? "multiple" : "single",
      options: options.map((o) => String(o).trim()).filter(Boolean),
      correctAnswers: correctAnswers.map((a) => String(a).trim()).filter(Boolean),
      explanation: explanation || "",
      passageTitle: passageTitle || "",
      passage: passage || "",
      points: Number(points) || 1,
      difficulty: difficulty || "medium",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Question created successfully.",
      question: newQuestion,
    });
  } catch (error) {
    console.error("Error in createAdminQuestion:", error);
    return res.status(500).json({ success: false, message: "Failed to create question." });
  }
}

/**
 * PUT /api/nptel/admin/questions/:id
 * Updates an existing NPTEL question
 */
export async function updateAdminQuestion(req, res) {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.options && Array.isArray(updateData.options)) {
      updateData.options = updateData.options.map((o) => String(o).trim()).filter(Boolean);
    }
    if (updateData.correctAnswers && Array.isArray(updateData.correctAnswers)) {
      updateData.correctAnswers = updateData.correctAnswers.map((a) => String(a).trim()).filter(Boolean);
      if (updateData.correctAnswers.length > 1) {
        updateData.type = "multiple";
      }
    }

    const updated = await NptelQuestion.findOneAndUpdate(
      { $or: [{ _id: id }, { questionId: id }] },
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Question updated successfully.",
      question: updated,
    });
  } catch (error) {
    console.error("Error in updateAdminQuestion:", error);
    return res.status(500).json({ success: false, message: "Failed to update question." });
  }
}

/**
 * DELETE /api/nptel/admin/questions/:id
 * Deletes or deactivates a question
 */
export async function deleteAdminQuestion(req, res) {
  try {
    const { id } = req.params;
    const deleted = await NptelQuestion.findOneAndDelete({ $or: [{ _id: id }, { questionId: id }] });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }
    return res.status(200).json({
      success: true,
      message: "Question deleted successfully.",
    });
  } catch (error) {
    console.error("Error in deleteAdminQuestion:", error);
    return res.status(500).json({ success: false, message: "Failed to delete question." });
  }
}

/**
 * POST /api/nptel/admin/upload
 * Bulk uploads questions via PDF, JSON file, or JSON payload
 */
export async function uploadAdminQuestions(req, res) {
  try {
    let rawQuestions = [];

    // 1. Direct JSON body
    if (req.body?.questions && Array.isArray(req.body.questions)) {
      rawQuestions = req.body.questions;
    } else if (req.body?.jsonText) {
      try {
        const parsed = JSON.parse(req.body.jsonText);
        rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions || [];
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid JSON format in text payload." });
      }
    }
    // 2. Uploaded file (PDF or JSON or CSV)
    else if (req.file) {
      const fileName = (req.file.originalname || "").toLowerCase();
      const mime = req.file.mimetype || "";

      if (fileName.endsWith(".json") || mime.includes("json")) {
        try {
          const parsed = JSON.parse(req.file.buffer.toString("utf8"));
          rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions || [];
        } catch (err) {
          return res.status(400).json({ success: false, message: "Could not parse JSON file." });
        }
      } else if (fileName.endsWith(".pdf") || mime.includes("pdf")) {
        try {
          const parsed = await parseQuestions(req.file.buffer, "pdf");
          rawQuestions = (parsed || []).map((p) => {
            const opts = p.options
              ? Array.isArray(p.options)
                ? p.options
                : Object.values(p.options).filter(Boolean)
              : [p.option_a, p.option_b, p.option_c, p.option_d].filter(Boolean);

            // Map letter answer (A, B, C, D) to actual option text if needed
            let ans = p.correctAnswer || p.correct_answer || [];
            if (!Array.isArray(ans)) {
              const letter = String(ans).trim().toUpperCase();
              if (["A", "B", "C", "D"].includes(letter)) {
                const idx = letter.charCodeAt(0) - 65;
                ans = opts[idx] ? [opts[idx]] : [letter];
              } else {
                ans = [String(ans)];
              }
            }

            return {
              questionText: p.question || p.questionText,
              options: opts,
              correctAnswers: ans,
              explanation: p.explanation || "",
              type: ans.length > 1 ? "multiple" : "single",
              difficulty: p.difficulty || "medium",
            };
          });
        } catch (pdfErr) {
          return res.status(400).json({ success: false, message: `PDF parsing error: ${pdfErr.message}` });
        }
      } else if (fileName.endsWith(".csv") || mime.includes("csv")) {
        try {
          const parsed = await parseQuestions(req.file.buffer, "csv");
          rawQuestions = (parsed || []).map((p) => ({
            questionText: p.question || p.questionText,
            options: [p.option_a, p.option_b, p.option_c, p.option_d].filter(Boolean),
            correctAnswers: [p.correctAnswer || p.correct_answer].filter(Boolean),
            explanation: p.explanation || "",
          }));
        } catch (csvErr) {
          return res.status(400).json({ success: false, message: `CSV parsing error: ${csvErr.message}` });
        }
      }
    }

    if (!rawQuestions || rawQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No questions could be extracted. Please upload a valid JSON or PDF file.",
      });
    }

    // Process and insert questions
    const highest = await NptelQuestion.findOne().sort({ questionNumber: -1 }).select("questionNumber").lean();
    let currentNum = (highest?.questionNumber || 0) + 1;

    const toInsert = [];
    for (const q of rawQuestions) {
      const qText = q.questionText || q.question || "";
      if (!qText.trim()) continue;

      let opts = q.options || [];
      if (!Array.isArray(opts)) {
        opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
      }
      opts = opts.map((o) => String(o).trim()).filter(Boolean);
      if (opts.length < 2) continue;

      let cAns = q.correctAnswers || q.correct_answers || q.correctAnswer || q.correct_answer || [];
      if (!Array.isArray(cAns)) cAns = [cAns];
      cAns = cAns.map((a) => String(a).trim()).filter(Boolean);
      if (cAns.length === 0) continue;

      const isMulti = q.type === "multiple" || cAns.length > 1;

      toInsert.push({
        questionNumber: currentNum,
        questionId: `q${currentNum}`,
        sectionTitle: q.sectionTitle || q.topic || "Introduction to Research",
        sectionBadge: "NPTEL",
        weekNumber: q.weekNumber || Math.ceil(currentNum / 10),
        questionText: qText.trim(),
        type: isMulti ? "multiple" : "single",
        options: opts,
        correctAnswers: cAns,
        explanation: q.explanation || "",
        passageTitle: q.passageTitle || "",
        passage: q.passage || "",
        points: q.points || q.marks || 1,
        difficulty: q.difficulty || "medium",
        isActive: true,
      });

      currentNum++;
    }

    if (toInsert.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid questions passed validation. Ensure each question has text, options, and answers.",
      });
    }

    await NptelQuestion.insertMany(toInsert);

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${toInsert.length} questions into NPTEL Assignment!`,
      count: toInsert.length,
      sample: toInsert.slice(0, 3),
    });
  } catch (error) {
    console.error("Error in uploadAdminQuestions:", error);
    return res.status(500).json({ success: false, message: `Upload failed: ${error.message}` });
  }
}

/**
 * GET /api/nptel/admin/templates/:format
 * Downloads sample template for NPTEL question import
 */
export async function downloadAdminTemplate(req, res) {
  try {
    const format = (req.params.format || "json").toLowerCase();

    if (format === "json") {
      const sampleJson = [
        {
          questionText: "Which of the following are primary attributes of rigorous scientific research?",
          type: "multiple",
          options: [
            "Empirical evidence and reproducibility",
            "Systematic and transparent methodology",
            "Anecdotal conclusions without peer review",
            "Falsifiable hypothesis and critical inquiry"
          ],
          correctAnswers: [
            "Empirical evidence and reproducibility",
            "Systematic and transparent methodology",
            "Falsifiable hypothesis and critical inquiry"
          ],
          explanation: "Rigorous scientific research requires empirical data, systematic methods, and falsifiable hypotheses.",
          sectionTitle: "Week 1: Scientific Method",
          difficulty: "medium",
          points: 1
        },
        {
          questionText: "What is the primary function of a literature review in research?",
          type: "single",
          options: [
            "To substitute empirical data collection",
            "To identify gaps in existing knowledge and position the current study",
            "To guarantee that research will receive public funding",
            "To prove that no other scholar has ever worked on the topic"
          ],
          correctAnswers: [
            "To identify gaps in existing knowledge and position the current study"
          ],
          explanation: "Literature reviews synthesize prior work to uncover unresolved gaps.",
          sectionTitle: "Week 2: Literature Review",
          difficulty: "easy",
          points: 1
        }
      ];

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", 'attachment; filename="nptel_questions_template.json"');
      return res.send(JSON.stringify(sampleJson, null, 2));
    }

    if (format === "csv") {
      const csvContent =
        "questionText,type,option_a,option_b,option_c,option_d,correctAnswer,explanation,sectionTitle\n" +
        '"What is research?","single","Systematic investigation","Random thoughts","Speculation","Unchecked claims","Systematic investigation","Research is a systematic study","Research Basics"';

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="nptel_questions_template.csv"');
      return res.send(csvContent);
    }

    return res.status(400).json({ success: false, message: "Unsupported format. Use 'json' or 'csv'." });
  } catch (error) {
    console.error("Error in downloadAdminTemplate:", error);
    return res.status(500).json({ success: false, message: "Failed to download template." });
  }
}
