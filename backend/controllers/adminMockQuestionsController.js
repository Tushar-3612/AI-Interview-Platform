import AptitudeQuestion from "../models/AptitudeQuestion.js";
import TechnicalQuestion from "../models/TechnicalQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";
import {
  loadMergedCompanyQuestions,
  normalizeQuestionText,
  toFolderName,
} from "../services/companyMockBank.js";

/**
 * Helper to match company names/folders
 */
const SUPPORTED_COMPANIES = [
  { id: "celebal", name: "Celebal" },
  { id: "tcs", name: "TCS" },
  { id: "wipro", name: "Wipro" },
  { id: "accenture", name: "Accenture" },
  { id: "benchmark", name: "Benchmark IT Solutions" },
  { id: "capgemini", name: "Capgemini" },
  { id: "cognizant", name: "Cognizant" },
  { id: "deloitte", name: "Deloitte" },
  { id: "infosys", name: "Infosys" },
];

/**
 * 1. Get Questions for selected company & type with search, filter, and pagination
 */
export const getMockQuestions = async (req, res) => {
  try {
    const { companyId = "celebal", type = "mcq", search = "", difficulty = "", topic = "", page = 1, limit = 20 } = req.query;
    const folder = toFolderName(companyId);

    const merged = await loadMergedCompanyQuestions(folder, "all");

    const mcqList = merged.mcq || [];
    const techList = merged.technical || [];
    const codingList = merged.coding || [];

    const mcqCount = mcqList.length;
    const technicalCount = techList.length;
    const codingCount = codingList.length;
    const totalCount = mcqCount + technicalCount + codingCount;

    let targetPool = [];
    if (type === "mcq") targetPool = mcqList;
    else if (type === "technical") targetPool = techList;
    else if (type === "coding") targetPool = codingList;
    else targetPool = [...mcqList, ...techList, ...codingList];

    // Apply Search & Filters
    if (search) {
      const normSearch = normalizeQuestionText(search);
      targetPool = targetPool.filter((q) => {
        const normQ = normalizeQuestionText(q.question || q.title || "");
        const normTopic = normalizeQuestionText(q.topic || q.category || "");
        return normQ.includes(normSearch) || normTopic.includes(normSearch);
      });
    }

    if (difficulty) {
      targetPool = targetPool.filter((q) => (q.difficulty || "").toLowerCase() === difficulty.toLowerCase());
    }

    if (topic) {
      targetPool = targetPool.filter((q) => (q.topic || q.category || "").toLowerCase().includes(topic.toLowerCase()));
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const totalFiltered = targetPool.length;
    const skip = (pageNum - 1) * limitNum;
    const paginatedQuestions = targetPool.slice(skip, skip + limitNum);

    res.json({
      success: true,
      data: {
        companyId: folder,
        companyName: SUPPORTED_COMPANIES.find((c) => c.id === folder)?.name || companyId,
        type,
        counts: {
          mcqCount,
          technicalCount,
          codingCount,
          totalCount,
        },
        questions: paginatedQuestions,
        pagination: {
          total: totalFiltered,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalFiltered / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("[MOCK QUESTIONS] getMockQuestions error:", error);
    res.status(500).json({ message: "Failed to fetch mock questions" });
  }
};

/**
 * 2. Check for Question Duplicate (Normalized text check against JSON + MongoDB)
 */
export const checkMockQuestionDuplicate = async (req, res) => {
  try {
    const { companyId, type = "mcq", questionText, excludeId } = req.body;

    if (!companyId || !questionText) {
      return res.status(400).json({ message: "Company ID and question text are required" });
    }

    const folder = toFolderName(companyId);
    const normTarget = normalizeQuestionText(questionText);

    const merged = await loadMergedCompanyQuestions(folder, type);

    const existingMatch = merged.find((q) => {
      const qId = String(q.questionId || q._id);
      if (excludeId && String(excludeId) === qId) return false;
      const normQ = normalizeQuestionText(q.question || q.title || "");
      return normQ === normTarget;
    });

    if (existingMatch) {
      return res.json({
        isDuplicate: true,
        existingQuestion: {
          questionId: existingMatch.questionId || String(existingMatch._id),
          companyId: folder,
          companyName: SUPPORTED_COMPANIES.find((c) => c.id === folder)?.name || companyId,
          type: existingMatch.questionType || type,
          question: existingMatch.question || existingMatch.title,
          difficulty: existingMatch.difficulty,
          marks: existingMatch.marks,
          source: existingMatch.source || "question_bank",
        },
      });
    }

    res.json({ isDuplicate: false });
  } catch (error) {
    console.error("[MOCK QUESTIONS] checkMockQuestionDuplicate error:", error);
    res.status(500).json({ message: "Failed to check question duplicate" });
  }
};

const ALLOWED_TECHNICAL_TOPICS = [
  "Programming & OOP",
  "Data Structures & Algorithms",
  "DBMS & SQL",
  "Operating Systems",
  "Computer Networks",
  "Software Engineering",
  "Web Development",
  "Cloud Computing",
  "Cyber Security",
  "Git & Version Control",
  "Company-specific Technologies",
  "Other",
];

function sanitizeTechnicalTopic(topic) {
  if (!topic) return "Company-specific Technologies";
  const match = ALLOWED_TECHNICAL_TOPICS.find((t) => t.toLowerCase() === topic.toLowerCase());
  return match || "Company-specific Technologies";
}

/**
 * 3. Add Single Question (MCQ, Technical, or Coding)
 */
export const addMockQuestion = async (req, res) => {
  try {
    const { companyId, type = "mcq", question, title, options, correctAnswer, expectedAnswer, explanation, betterAnswer, difficulty = "Medium", marks = 3, topic = "General", problemStatement, constraints, examples, testCases } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const textToMatch = question || title || problemStatement;
    if (!textToMatch) {
      return res.status(400).json({ message: "Question text or title is required" });
    }

    const folder = toFolderName(companyId);
    const compObj = SUPPORTED_COMPANIES.find((c) => c.id === folder) || { id: folder, name: companyId };
    const normTarget = normalizeQuestionText(textToMatch);

    // Backend duplicate check across JSON + DB
    const merged = await loadMergedCompanyQuestions(folder, type);
    const duplicate = merged.find((q) => normalizeQuestionText(q.question || q.title || "") === normTarget);

    if (duplicate) {
      return res.status(409).json({
        message: "Question already exists in company bank.",
        isDuplicate: true,
        existingQuestion: {
          questionId: duplicate.questionId || String(duplicate._id),
          companyId: folder,
          companyName: compObj.name,
          type: duplicate.questionType || type,
          question: duplicate.question || duplicate.title,
          difficulty: duplicate.difficulty,
          marks: duplicate.marks,
        },
      });
    }

    const generatedId = `MQ-${folder.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    let createdDoc = null;

    if (type === "mcq") {
      createdDoc = await AptitudeQuestion.create({
        questionId: generatedId,
        question: textToMatch,
        options: Array.isArray(options) ? options : [],
        correctAnswer: correctAnswer || "",
        explanation: explanation || "",
        difficulty: (difficulty || "medium").toLowerCase(),
        marks: Number(marks) || 1,
        category: topic || "Aptitude",
        companyId: folder,
        companyName: compObj.name,
        isActive: true,
        isDeleted: false,
      });
    } else if (type === "technical") {
      createdDoc = await TechnicalQuestion.create({
        questionId: generatedId,
        companyId: folder,
        companyName: compObj.name,
        companyIds: [folder],
        topic: sanitizeTechnicalTopic(topic),
        question: textToMatch,
        expectedAnswer: expectedAnswer || correctAnswer || "",
        explanation: explanation || "",
        betterAnswer: betterAnswer || "",
        difficulty: difficulty || "Medium",
        marks: Number(marks) || 3,
        isActive: true,
        isDeleted: false,
      });
    } else if (type === "coding") {
      createdDoc = await CodingQuestion.create({
        questionId: generatedId,
        title: title || textToMatch,
        problemStatement: problemStatement || textToMatch,
        difficulty: difficulty || "Medium",
        category: topic || "Algorithms",
        companyId: folder,
        constraints: constraints || "",
        examples: Array.isArray(examples) ? examples : [],
        testCases: Array.isArray(testCases) ? testCases : [],
        isActive: true,
        isDeleted: false,
      });
    } else {
      return res.status(400).json({ message: "Invalid question type" });
    }

    res.status(201).json({
      success: true,
      message: "Question added successfully",
      data: createdDoc,
    });
  } catch (error) {
    console.error("[MOCK QUESTIONS] addMockQuestion error:", error);
    res.status(500).json({ message: "Failed to add question" });
  }
};

/**
 * 4. Edit Question (Shadow Override Layer for JSON questions, Direct update for DB questions)
 */
export const editMockQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, type = "mcq", question, title, options, correctAnswer, expectedAnswer, explanation, betterAnswer, difficulty = "Medium", marks = 3, topic = "General", problemStatement, constraints, examples, testCases } = req.body;

    if (!companyId || !id) {
      return res.status(400).json({ message: "Company ID and question ID are required" });
    }

    const textToMatch = question || title || problemStatement;
    if (!textToMatch) {
      return res.status(400).json({ message: "Question text is required" });
    }

    const folder = toFolderName(companyId);
    const compObj = SUPPORTED_COMPANIES.find((c) => c.id === folder) || { id: folder, name: companyId };
    const normTarget = normalizeQuestionText(textToMatch);

    // Duplicate check excluding self
    const merged = await loadMergedCompanyQuestions(folder, type);
    const duplicate = merged.find((q) => {
      const qId = String(q.questionId || q._id);
      if (qId === String(id)) return false;
      return normalizeQuestionText(q.question || q.title || "") === normTarget;
    });

    if (duplicate) {
      return res.status(409).json({
        message: "Another question with identical text already exists.",
        isDuplicate: true,
        existingQuestion: {
          questionId: duplicate.questionId || String(duplicate._id),
          companyId: folder,
          companyName: compObj.name,
          type: duplicate.questionType || type,
          question: duplicate.question || duplicate.title,
          difficulty: duplicate.difficulty,
          marks: duplicate.marks,
        },
      });
    }

    let updatedDoc = null;

    if (type === "mcq") {
      let doc = await AptitudeQuestion.findOne({ $or: [{ questionId: id }, { _id: id }] });
      if (doc) {
        doc.question = textToMatch;
        if (options) doc.options = options;
        if (correctAnswer) doc.correctAnswer = correctAnswer;
        if (explanation) doc.explanation = explanation;
        if (difficulty) doc.difficulty = difficulty.toLowerCase();
        if (marks) doc.marks = Number(marks);
        if (topic) doc.category = topic;
        doc.isDeleted = false;
        doc.isActive = true;
        await doc.save();
        updatedDoc = doc;
      } else {
        // Shadow Override for JSON question
        updatedDoc = await AptitudeQuestion.create({
          questionId: String(id),
          question: textToMatch,
          options: Array.isArray(options) ? options : [],
          correctAnswer: correctAnswer || "",
          explanation: explanation || "",
          difficulty: (difficulty || "medium").toLowerCase(),
          marks: Number(marks) || 1,
          category: topic || "Aptitude",
          companyId: folder,
          companyName: compObj.name,
          isActive: true,
          isDeleted: false,
        });
      }
    } else if (type === "technical") {
      let doc = await TechnicalQuestion.findOne({ $or: [{ questionId: id }, { _id: id }] });
      if (doc) {
        doc.question = textToMatch;
        if (expectedAnswer) doc.expectedAnswer = expectedAnswer;
        if (explanation) doc.explanation = explanation;
        if (betterAnswer) doc.betterAnswer = betterAnswer;
        if (difficulty) doc.difficulty = difficulty;
        if (marks) doc.marks = Number(marks);
        if (topic) doc.topic = sanitizeTechnicalTopic(topic);
        doc.isDeleted = false;
        doc.isActive = true;
        await doc.save();
        updatedDoc = doc;
      } else {
        // Shadow Override for JSON question
        updatedDoc = await TechnicalQuestion.create({
          questionId: String(id),
          companyId: folder,
          companyName: compObj.name,
          companyIds: [folder],
          topic: sanitizeTechnicalTopic(topic),
          question: textToMatch,
          expectedAnswer: expectedAnswer || correctAnswer || "",
          explanation: explanation || "",
          betterAnswer: betterAnswer || "",
          difficulty: difficulty || "Medium",
          marks: Number(marks) || 3,
          isActive: true,
          isDeleted: false,
        });
      }
    } else if (type === "coding") {
      let doc = await CodingQuestion.findOne({ $or: [{ questionId: id }, { _id: id }] });
      if (doc) {
        doc.title = title || textToMatch;
        doc.problemStatement = problemStatement || textToMatch;
        if (difficulty) doc.difficulty = difficulty;
        if (topic) doc.category = topic;
        if (constraints) doc.constraints = constraints;
        if (examples) doc.examples = examples;
        if (testCases) doc.testCases = testCases;
        doc.isDeleted = false;
        doc.isActive = true;
        await doc.save();
        updatedDoc = doc;
      } else {
        // Shadow Override for JSON coding question
        updatedDoc = await CodingQuestion.create({
          questionId: String(id),
          title: title || textToMatch,
          problemStatement: problemStatement || textToMatch,
          difficulty: difficulty || "Medium",
          category: topic || "Algorithms",
          companyId: folder,
          constraints: constraints || "",
          examples: Array.isArray(examples) ? examples : [],
          testCases: Array.isArray(testCases) ? testCases : [],
          isActive: true,
          isDeleted: false,
        });
      }
    }

    res.json({
      success: true,
      message: "Question updated successfully",
      data: updatedDoc,
    });
  } catch (error) {
    console.error("[MOCK QUESTIONS] editMockQuestion error:", error);
    res.status(500).json({ message: "Failed to edit question" });
  }
};

/**
 * 5. Delete Question (Suppression Layer for JSON questions, Soft-delete for DB questions)
 */
export const deleteMockQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, type = "mcq" } = req.query;

    if (!id || !companyId) {
      return res.status(400).json({ message: "Question ID and company ID are required" });
    }

    const folder = toFolderName(companyId);
    const compObj = SUPPORTED_COMPANIES.find((c) => c.id === folder) || { id: folder, name: companyId };

    if (type === "mcq") {
      let doc = await AptitudeQuestion.findOne({ $or: [{ questionId: id }, { _id: id }] });
      if (doc) {
        doc.isDeleted = true;
        doc.isActive = false;
        doc.deletedAt = new Date();
        await doc.save();
      } else {
        // Create Suppression record for JSON question
        await AptitudeQuestion.create({
          questionId: String(id),
          question: `[Suppressed Question ${id}]`,
          options: ["N/A"],
          correctAnswer: "N/A",
          difficulty: "easy",
          companyId: folder,
          companyName: compObj.name,
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
        });
      }
    } else if (type === "technical") {
      let doc = await TechnicalQuestion.findOne({ $or: [{ questionId: id }, { _id: id }] });
      if (doc) {
        doc.isDeleted = true;
        doc.isActive = false;
        doc.deletedAt = new Date();
        await doc.save();
      } else {
        // Create Suppression record for JSON question
        await TechnicalQuestion.create({
          questionId: String(id),
          companyId: folder,
          companyName: compObj.name,
          topic: "Other",
          question: `[Suppressed Question ${id}]`,
          difficulty: "Medium",
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
        });
      }
    } else if (type === "coding") {
      let doc = await CodingQuestion.findOne({ $or: [{ questionId: id }, { _id: id }] });
      if (doc) {
        doc.isDeleted = true;
        doc.isActive = false;
        doc.deletedAt = new Date();
        await doc.save();
      } else {
        // Create Suppression record for JSON coding question
        await CodingQuestion.create({
          questionId: String(id),
          title: `[Suppressed Coding ${id}]`,
          problemStatement: `[Suppressed Coding ${id}]`,
          difficulty: "Medium",
          companyId: folder,
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
        });
      }
    }

    res.json({
      success: true,
      message: "Question deleted successfully",
      deletedId: id,
    });
  } catch (error) {
    console.error("[MOCK QUESTIONS] deleteMockQuestion error:", error);
    res.status(500).json({ message: "Failed to delete question" });
  }
};

/**
 * 6. Bulk Import Questions with preview validation & normalized duplicate protection
 */
export const importMockQuestions = async (req, res) => {
  try {
    const { companyId, type = "mcq", questions = [] } = req.body;

    if (!companyId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Company ID and questions array are required" });
    }

    const folder = toFolderName(companyId);
    const compObj = SUPPORTED_COMPANIES.find((c) => c.id === folder) || { id: folder, name: companyId };

    const mergedPool = await loadMergedCompanyQuestions(folder, type);
    const existingNormSet = new Set(mergedPool.map((q) => normalizeQuestionText(q.question || q.title || "")));

    let successCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;
    const duplicates = [];
    const errors = [];
    const batchNormSet = new Set();

    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];
      const text = q.question || q.title || q.problemStatement;

      if (!text) {
        rejectedCount++;
        errors.push({ index, message: "Missing question text/title" });
        continue;
      }

      const norm = normalizeQuestionText(text);

      if (existingNormSet.has(norm) || batchNormSet.has(norm)) {
        duplicateCount++;
        duplicates.push({
          index,
          question: text,
          company: compObj.name,
          type,
          status: "Not imported (Duplicate found)",
        });
        continue;
      }

      batchNormSet.add(norm);
      const generatedId = q.questionId || `MQ-${folder.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${index}`;

      try {
        if (type === "mcq") {
          await AptitudeQuestion.create({
            questionId: generatedId,
            question: text,
            options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: q.correctAnswer || "",
            explanation: q.explanation || "",
            difficulty: (q.difficulty || "medium").toLowerCase(),
            marks: Number(q.marks) || 1,
            category: q.topic || q.category || "Aptitude",
            companyId: folder,
            companyName: compObj.name,
            isActive: true,
            isDeleted: false,
          });
        } else if (type === "technical") {
          await TechnicalQuestion.create({
            questionId: generatedId,
            companyId: folder,
            companyName: compObj.name,
            companyIds: [folder],
            topic: sanitizeTechnicalTopic(q.topic),
            question: text,
            expectedAnswer: q.expectedAnswer || q.correctAnswer || "",
            explanation: q.explanation || "",
            betterAnswer: q.betterAnswer || "",
            difficulty: q.difficulty || "Medium",
            marks: Number(q.marks) || 3,
            isActive: true,
            isDeleted: false,
          });
        } else if (type === "coding") {
          await CodingQuestion.create({
            questionId: generatedId,
            title: q.title || text,
            problemStatement: q.problemStatement || text,
            difficulty: q.difficulty || "Medium",
            category: q.topic || q.category || "Algorithms",
            companyId: folder,
            constraints: q.constraints || "",
            examples: Array.isArray(q.examples) ? q.examples : [],
            testCases: Array.isArray(q.testCases) ? q.testCases : [],
            isActive: true,
            isDeleted: false,
          });
        }
        successCount++;
      } catch (err) {
        rejectedCount++;
        errors.push({ index, message: err.message });
      }
    }

    res.json({
      success: true,
      message: `Import processed: ${successCount} imported, ${duplicateCount} duplicates skipped, ${rejectedCount} errors.`,
      report: {
        successCount,
        duplicateCount,
        rejectedCount,
        duplicates,
        errors,
      },
    });
  } catch (error) {
    console.error("[MOCK QUESTIONS] importMockQuestions error:", error);
    res.status(500).json({ message: "Failed to import questions" });
  }
};
