import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./backend/config/db.js";
import authRoutes from "./backend/routes/auth.js";
import adminRoutes from "./backend/routes/admin.js";
import studentRoutes from "./backend/routes/student.js";
import testRoutes from "./backend/routes/test.js";
import aiEvaluationRoutes from "./backend/routes/aiEvaluation.js";

import companyRoutes from "./backend/routes/company.js";
import auditLogRoutes from "./backend/routes/auditLog.js";
import systemConfigRoutes from "./backend/routes/systemConfig.js";
import aptitudeRoutes from "./backend/routes/aptitude.js";
import codingQuestionRoutes from "./backend/routes/codingQuestions.js";
import practiceRoutes from "./backend/routes/practice.js";
import codeExecutionRoutes from "./backend/routes/codeExecution.js";
import placementRoutes from "./backend/routes/placement.js";
import mockInterviewRoutes from "./backend/routes/mockInterviewRoutes.js";
import technicalQuestionRoutes from "./backend/routes/technicalQuestions.js";
import interviewRoutes from "./backend/routes/interviewRoutes.js";
import { initializeCSVExports } from "./backend/utils/csvExporter.js"; // ← Path sahi hai
import { apiLimiter } from "./backend/middleware/rateLimiter.js";
import { runSeeds } from "./backend/utils/seedDefaults.js";
import { cleanupExpiredTrash } from "./backend/controllers/aptitudeController.js";
import { cleanupExpiredCodingTrash } from "./backend/controllers/codingQuestionController.js";
import { cleanupExpiredCompanyTrash } from "./backend/controllers/companyEnhancedController.js";

// Load .env from root using absolute path (works regardless of cwd)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// Debug - Check if .env loaded
console.log('📁 Current directory:', process.cwd());
console.log('🔑 MONGO_URI:', process.env.MONGO_URI ? '✅ Loaded' : '❌ Not Loaded');
console.log('🤖 AI_PROVIDER:', process.env.AI_PROVIDER || 'groq');
console.log('🔑 AI_API_KEY:', process.env.AI_API_KEY ? '✅ Loaded' : '❌ Not Loaded');
console.log('🧠 AI_MODEL:', process.env.AI_MODEL ? 'configured' : '❌ Not Set');
console.log('📧 SMTP_USER:', process.env.SMTP_USER ? '✅ Loaded' : '❌ Not Loaded');

/* ================================
   DATABASE CONNECTION + SEED
   aptitude.json loaded once into memory; 30-day trash cleanup
   ================================ */
connectDB().then(() => {
  runSeeds()
    .then(async () => {
      await cleanupExpiredTrash();
      await cleanupExpiredCodingTrash();
      await cleanupExpiredCompanyTrash();
    })
    .catch((error) => console.error("Seed/cleanup error:", error.message));
});

/* ================================
   CSV EXPORT INITIALIZATION
   Admin backup files — MongoDB is primary
   ================================ */
initializeCSVExports();

const app = express();

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
app.use(compression());
app.use(mongoSanitize());

// CORS setup - Frontend URL ke saath
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: "10mb" }));

// Rate limiting (applied after CORS)
app.use("/api", apiLimiter);

/* ================================
   ROUTES
   ================================ */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/ai-evaluation", aiEvaluationRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/system-config", systemConfigRoutes);
app.use("/api/aptitude", aptitudeRoutes);
app.use("/api/coding-questions", codingQuestionRoutes);
app.use("/api/practice", practiceRoutes);
app.use("/api/code", codeExecutionRoutes);
app.use("/api/compiler", codeExecutionRoutes);
app.use("/api/placement", placementRoutes);
app.use("/api/mock-interview", mockInterviewRoutes);
app.use("/api/technical-questions", technicalQuestionRoutes);
app.use("/api/interview", interviewRoutes);

// Health Check Route (Add this for testing)
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
