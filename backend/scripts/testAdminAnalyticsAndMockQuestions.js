import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import TechnicalQuestion from "../models/TechnicalQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";
import CompanyMockAttempt from "../models/CompanyMockAttempt.js";
import User from "../models/User.js";
import {
  loadCompanyMockTechnicalAsync,
  loadCompanyMockCodingAsync,
  loadMergedCompanyQuestions,
  normalizeQuestionText,
} from "../services/companyMockBank.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_interview_engine";

async function runTests() {
  console.log("=== RUNNING ADMIN ANALYTICS & MOCK QUESTIONS INTEGRITY TESTS ===");
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB at:", MONGO_URI);

  try {
    // TEST 1: Load Merged Questions for Celebal
    console.log("\n[TEST 1] Loading merged Company Mock questions for Celebal...");
    const celebalQuestions = await loadMergedCompanyQuestions("celebal", "all");
    console.log(`- MCQ Count: ${celebalQuestions.mcq.length}`);
    console.log(`- Technical Count: ${celebalQuestions.technical.length}`);
    console.log(`- Coding Count: ${celebalQuestions.coding.length}`);
    if (celebalQuestions.technical.length === 0) {
      throw new Error("TEST 1 FAILED: Celebal technical questions empty!");
    }
    console.log("✓ TEST 1 PASSED: Static JSON questions loaded successfully into merged pool.");

    // TEST 2: Normalized Duplicate Detection
    console.log("\n[TEST 2] Testing normalized duplicate detection across JSON & DB...");
    const sampleJsonQuestion = celebalQuestions.technical[0].question;
    console.log(`- Target JSON question text: "${sampleJsonQuestion}"`);

    const paddedText = `   ${sampleJsonQuestion.toUpperCase()}   `;
    const normPadded = normalizeQuestionText(paddedText);
    const normSample = normalizeQuestionText(sampleJsonQuestion);

    if (normPadded !== normSample) {
      throw new Error("TEST 2 FAILED: Text normalization mismatch!");
    }

    const duplicateFound = celebalQuestions.technical.find(
      (q) => normalizeQuestionText(q.question) === normPadded
    );

    if (!duplicateFound) {
      throw new Error("TEST 2 FAILED: Duplicate text not identified in merged bank!");
    }
    console.log("✓ TEST 2 PASSED: Normalized duplicate detection correctly identified JSON question match.");

    // TEST 3: Add New Question in MongoDB
    console.log("\n[TEST 3] Testing Add Question in MongoDB for Celebal...");
    const testQText = `Test Admin Question ${Date.now()}`;
    const newDoc = await TechnicalQuestion.create({
      questionId: `MQ-CELEBAL-TEST-${Date.now()}`,
      companyId: "celebal",
      companyName: "Celebal",
      companyIds: ["celebal"],
      topic: "Software Engineering",
      question: testQText,
      expectedAnswer: "Test Expected Answer",
      difficulty: "Hard",
      marks: 5,
      isActive: true,
      isDeleted: false,
    });

    console.log(`- Inserted DB Question ID: ${newDoc.questionId}`);

    // Verify it appears in active pool
    const reloaded = await loadCompanyMockTechnicalAsync("celebal");
    const foundNew = reloaded.find((q) => q.questionId === newDoc.questionId);

    if (!foundNew) {
      throw new Error("TEST 3 FAILED: Newly inserted DB question did not appear in active pool!");
    }
    console.log("✓ TEST 3 PASSED: Dynamic MongoDB question seamlessly integrated into active pool.");

    // TEST 4: Edit Question (Shadow Override)
    console.log("\n[TEST 4] Testing Question Edit (Shadow Override)...");
    const jsonTarget = celebalQuestions.technical[1];
    console.log(`- Overriding JSON question ID: ${jsonTarget.questionId}`);

    const overrideDoc = await TechnicalQuestion.create({
      questionId: jsonTarget.questionId,
      companyId: "celebal",
      companyName: "Celebal",
      companyIds: ["celebal"],
      topic: "Software Engineering",
      question: `${jsonTarget.question} (ED-EDITED)`,
      expectedAnswer: "Edited expected answer",
      difficulty: "Easy",
      marks: 10,
      isActive: true,
      isDeleted: false,
    });

    const reloadedAfterEdit = await loadCompanyMockTechnicalAsync("celebal");
    const editedInPool = reloadedAfterEdit.find((q) => q.questionId === jsonTarget.questionId);

    if (!editedInPool || !editedInPool.question.includes("(ED-EDITED)")) {
      throw new Error("TEST 4 FAILED: Shadow override did not take precedence in active pool!");
    }
    console.log("✓ TEST 4 PASSED: Shadow override took precedence over static JSON base question.");

    // TEST 5: Question Delete (Suppression)
    console.log("\n[TEST 5] Testing Question Delete (Suppression)...");
    overrideDoc.isDeleted = true;
    overrideDoc.isActive = false;
    await overrideDoc.save();

    const reloadedAfterDelete = await loadCompanyMockTechnicalAsync("celebal");
    const suppressedInPool = reloadedAfterDelete.find((q) => q.questionId === jsonTarget.questionId);

    if (suppressedInPool) {
      throw new Error("TEST 5 FAILED: Suppressed question still appeared in active pool!");
    }
    console.log("✓ TEST 5 PASSED: Suppressed question successfully removed from future active pools.");

    // Clean up test documents
    console.log("\n[CLEANUP] Removing test artifacts from database...");
    await TechnicalQuestion.deleteOne({ _id: newDoc._id });
    await TechnicalQuestion.deleteOne({ _id: overrideDoc._id });
    console.log("✓ CLEANUP COMPLETE: Database left clean.");

    console.log("\n=======================================================");
    console.log("ALL 5 SYSTEM INTEGRITY & SAFETY TESTS PASSED 100%!");
    console.log("=======================================================");

  } catch (err) {
    console.error("\n❌ TEST REGRESSION DETECTED:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
