/**
 * Migration: normalize legacy academic-year values to the canonical "B.Tech".
 *
 * Legacy values such as "Last Year", "Final Year", "4th Year" are migrated to
 * "B.Tech" everywhere they are stored. Department values are trimmed/collapsed.
 *
 * Run with:  node backend/scripts/migrateAcademicYear.js
 * (uses MONGO_URI from the root .env)
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import TestAssignment from "../models/TestAssignment.js";
import TestResult from "../models/TestResult.js";
import Result from "../models/Result.js";
import ReportHistory from "../models/ReportHistory.js";
import { normalizeYear, normalizeDepartment, LEGACY_YEARS } from "../utils/academicConfig.js";

const __filename = fileURLToPath(import.meta.url);
dotenv.config({ path: path.resolve(__filename, "../../../.env") });

const LEGACY_SET = new Set(LEGACY_YEARS.map((y) => y.toLowerCase()));

async function migrateCollection(model, collectionLabel) {
  const docs = await model.find({}).lean();
  let yearUpdated = 0;
  let deptUpdated = 0;

  for (const doc of docs) {
    const updates = {};

    if (doc.year !== undefined && doc.year !== null) {
      const normalized = normalizeYear(doc.year);
      if (normalized !== doc.year) {
        updates.year = normalized;
        yearUpdated += 1;
      }
    }

    if (doc.department !== undefined && doc.department !== null) {
      const normalized = normalizeDepartment(doc.department);
      if (normalized !== doc.department) {
        updates.department = normalized;
        deptUpdated += 1;
      }
    }

    if (Object.keys(updates).length > 0) {
      await model.updateOne({ _id: doc._id }, { $set: updates });
    }
  }

  console.log(`• ${collectionLabel}: scanned ${docs.length}, year updates=${yearUpdated}, department updates=${deptUpdated}`);
  return yearUpdated + deptUpdated;
}

async function main() {
  await connectDB();

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not defined. Aborting migration.");
    process.exit(1);
  }

  console.log("Starting academic-year migration...");
  console.log(`Legacy year values that will be normalized to "B.Tech": ${LEGACY_YEARS.join(", ")}`);

  let total = 0;
  total += await migrateCollection(User, "Users");
  total += await migrateCollection(TestAssignment, "TestAssignments");
  total += await migrateCollection(TestResult, "TestResults");
  total += await migrateCollection(Result, "Results");
  total += await migrateCollection(ReportHistory, "ReportHistory");

  console.log(`Migration complete. Total fields updated: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
