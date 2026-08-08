/**
 * seedCleanup.js
 * One-time migration script: soft-deletes old FAANG companies that should
 * NOT appear in the placement platform. Run with:
 *   node backend/scripts/seedCleanup.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in .env");
  process.exit(1);
}

// Companies to deactivate (these should not appear for students)
const OLD_COMPANY_NAMES = [
  "google",
  "amazon",
  "adobe",
  "meta",
  "apple",
  "netflix",
  "microsoft",
  "persistent",
  "oracle",
  "ey",
  "ibm",
  "sanjivani",
];

// Companies to KEEP active
const VALID_COMPANIES = [
  { id: "tcs", name: "TCS", color: "#1a73e8" },
  { id: "infosys", name: "Infosys", color: "#007cc2" },
  { id: "wipro", name: "Wipro", color: "#741b47" },
  { id: "accenture", name: "Accenture", color: "#a100ff" },
  { id: "capgemini", name: "Capgemini", color: "#0070ad" },
  { id: "cognizant", name: "Cognizant", color: "#1a2e64" },
  { id: "deloitte", name: "Deloitte", color: "#86bc25" },
  { id: "benchmark", name: "Benchmark", color: "#e85d04" },
];

const companySchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String },
  color: { type: String, default: "#2563EB" },
  logo: { type: String, default: "" },
  description: { type: String, default: "" },
  status: { type: String, default: "active" },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  lastUpdated: { type: Date, default: null },
}, { timestamps: true });

const Company = mongoose.model("Company", companySchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Step 1: Soft-delete old companies
  let deactivated = 0;
  for (const companyId of OLD_COMPANY_NAMES) {
    const result = await Company.updateMany(
      {
        $or: [
          { id: companyId },
          { name: { $regex: new RegExp(`^${companyId}$`, "i") } },
        ],
        isDeleted: { $ne: true },
      },
      {
        $set: {
          isDeleted: true,
          status: "inactive",
          deletedAt: new Date(),
          lastUpdated: new Date(),
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`🗑️  Soft-deleted: ${companyId} (${result.modifiedCount} records)`);
      deactivated += result.modifiedCount;
    }
  }
  console.log(`\n✅ Deactivated ${deactivated} old company records`);

  // Step 2: Ensure valid companies exist
  let seeded = 0;
  for (const comp of VALID_COMPANIES) {
    const existing = await Company.findOne({ id: comp.id });
    if (!existing) {
      await Company.create({
        ...comp,
        status: "active",
        isDeleted: false,
        description: `${comp.name} placement preparation`,
        lastUpdated: new Date(),
      });
      console.log(`➕ Created company: ${comp.name}`);
      seeded++;
    } else {
      // Restore/activate whether or not it was previously deleted
      const result = await Company.updateOne(
        { id: comp.id },
        {
          $set: {
            name: comp.name,
            color: comp.color,
            status: "active",
            isDeleted: false,
            deletedAt: null,
            lastUpdated: new Date(),
          },
        }
      );
      console.log(result.modifiedCount > 0 ? `♻️  Restored/activated: ${comp.name}` : `✔️  Already active: ${comp.name}`);
      seeded++;
    }
  }
  console.log(`\n✅ Ensured ${VALID_COMPANIES.length} valid companies (${seeded} created/restored)`);

  await mongoose.disconnect();
  console.log("\n🎉 Cleanup complete! Disconnect from MongoDB.");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Cleanup failed:", err.message);
  process.exit(1);
});
