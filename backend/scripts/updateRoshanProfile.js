import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";
import { parseResumeComplete } from "../services/resumeParser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  const user = await User.findOne({ name: { $regex: /Roshan/i } });
  if (!user || !user.resumeBase64) {
    console.error("Roshan Langhi not found or has no resumeBase64");
    process.exit(1);
  }

  console.log(`Parsing stored resumeBase64 for ${user.name}...`);
  const fileBuffer = Buffer.from(user.resumeBase64, "base64");
  const parsed = await parseResumeComplete(fileBuffer, "application/pdf", user);

  console.log("Newly Extracted Projects:", parsed.projects);
  console.log("Newly Extracted Skills:", parsed.all_skills);

  user.projects = parsed.projects || [];
  user.skills = parsed.all_skills || [];
  user.categorizedSkills = parsed.categorizedSkills || {};
  user.experience = parsed.experience || [];
  user.education = parsed.education || [];
  user.certifications = parsed.certifications || [];

  await user.save();
  console.log("Updated User document in MongoDB successfully.");

  await mongoose.disconnect();
}

run();
