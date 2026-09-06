import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

import User from "../models/User.js";
import { extractPDFText } from "../services/resumeParser.js";

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log("Connecting to Mongo URI...");
  await mongoose.connect(mongoUri);

  const users = await User.find({}).lean();
  console.log(`Total Users in DB: ${users.length}`);
  for (const u of users) {
    console.log(`\n=================== USER: ${u.name} (${u.email}) ===================`);
    console.log(`- resumeFileName: ${u.resumeFileName || "None"}`);
    console.log(`- resumeBase64: ${u.resumeBase64 ? "YES (" + u.resumeBase64.length + " chars)" : "NO"}`);
    console.log(`- skills: ${JSON.stringify(u.skills || [])}`);
    console.log(`- categorizedSkills: ${JSON.stringify(u.categorizedSkills || {})}`);
    console.log(`- projects: ${JSON.stringify(u.projects || [])}`);

    if (u.resumeBase64) {
      const pdfBuffer = Buffer.from(u.resumeBase64, "base64");
      const rawText = await extractPDFText(pdfBuffer);
      console.log("\n--- RAW RESUME TEXT EXTRACTED ---");
      console.log(rawText);
    }
  }

  await mongoose.disconnect();
}

run();
