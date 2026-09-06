import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  const users = await User.find({}).lean();
  console.log(`Found ${users.length} users in database:\n`);

  users.forEach((u, i) => {
    console.log(`User #${i + 1}:`);
    console.log(`- ID: ${u._id}`);
    console.log(`- Name: ${u.name}`);
    console.log(`- Email: ${u.email}`);
    console.log(`- Has resumeBase64: ${Boolean(u.resumeBase64)}`);
    console.log(`- Stored Projects (${u.projects?.length || 0}):`, (u.projects || []).map(p => p.title || p.name));
    console.log(`- Stored Skills (${u.skills?.length || 0}):`, u.skills);
    console.log("----------------------------------------------");
  });

  await mongoose.disconnect();
}

run();
