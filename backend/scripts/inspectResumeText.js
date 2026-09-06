import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import User from "../models/User.js";
import { extractPDFText } from "../services/resumeParser.js";

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/ai-interview-engine";
  await mongoose.connect(mongoUri);

  const student = await User.findOne({ resumeBase64: { $exists: true, $ne: "" } });
  if (!student) {
    console.log("No student with resumeBase64 found.");
    process.exit(0);
  }

  console.log(`Candidate Name: ${student.name}`);
  console.log(`Resume File Name: ${student.resumeFileName}`);
  const pdfBuffer = Buffer.from(student.resumeBase64, "base64");
  const rawText = await extractPDFText(pdfBuffer);

  console.log("\n=================== FULL RESUME TEXT ===================");
  console.log(rawText);
  console.log("========================================================\n");

  await mongoose.disconnect();
}

run();
