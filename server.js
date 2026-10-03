import express from "express";
import mongoose from "mongoose";
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
import realInterviewRoutes from "./backend/routes/realInterviewRoutes.js";
import individualTechnicalRoutes from "./backend/routes/individualRound/technical/individualTechnicalRoutes.js";
import individualProjectRoutes from "./backend/routes/individualRound/project/individualProjectRoutes.js";

import interviewSTTRoutes from "./backend/routes/interviewSTT.js";

import adminCodingAssessmentRoutes from "./backend/routes/adminCodingAssessmentRoutes.js";
import candidateCodingAssessmentRoutes from "./backend/routes/candidateCodingAssessmentRoutes.js";


import { initializeCSVExports } from "./backend/utils/csvExporter.js"; // ← Path sahi hai
import { apiLimiter } from "./backend/middleware/rateLimiter.js";
import { runSeeds } from "./backend/utils/seedDefaults.js";
import { cleanupExpiredTrash } from "./backend/controllers/aptitudeController.js";
import { cleanupExpiredCodingTrash } from "./backend/controllers/codingQuestionController.js";
import { cleanupExpiredCompanyTrash } from "./backend/controllers/companyEnhancedController.js";
import { initRedis, closeRedis, isRedisReady } from "./backend/services/redisService.js";

// Load .env from root using absolute path (works regardless of cwd)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// Initialize optional Redis distributed layer
initRedis();

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

// Enable trust proxy for Load Balancer IP & Protocol preservation
app.set("trust proxy", 1);

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
app.use(compression());
app.use(mongoSanitize());

// CORS setup - Support FRONTEND_URL / CORS_ORIGIN in production & localhost in development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000"
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, "");
    const isAllowed = allowedOrigins.some((o) => o.replace(/\/$/, "") === normalized);
    if (isAllowed || process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from origin: ${origin}`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
app.use("/api/real-interview", realInterviewRoutes);
app.use("/api/individual/technical", individualTechnicalRoutes);
app.use("/api/individual/project", individualProjectRoutes);

app.use("/api/interview", interviewSTTRoutes);

app.use("/api/admin/coding", adminCodingAssessmentRoutes);
app.use("/api/coding", candidateCodingAssessmentRoutes);

/* ================================
   LOAD BALANCER HEALTH & READINESS PROBES
   ================================ */
let isShuttingDown = false;

// 1. Lightweight Liveness Probe
const livenessHandler = (req, res) => {
  res.status(200).json({ status: "alive", uptimeSeconds: Math.floor(process.uptime()) });
};
app.get("/live", livenessHandler);
app.get("/api/live", livenessHandler);

// 2. Deep Readiness Probe (Used by Load Balancers for traffic routing)
const readinessHandler = (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ ready: false, message: "Instance is shutting down and draining traffic." });
  }

  const isDbConnected = mongoose.connection.readyState === 1;
  if (!isDbConnected) {
    return res.status(503).json({ ready: false, message: "Database connection not ready." });
  }

  return res.status(200).json({
    ready: true,
    database: "connected",
    redis: isRedisReady() ? "connected" : "standalone-mongodb",
    timestamp: new Date().toISOString(),
  });
};
app.get("/ready", readinessHandler);
app.get("/api/ready", readinessHandler);

// 3. Comprehensive Diagnostics Health Check
const healthCheckHandler = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const mem = process.memoryUsage();

  const healthData = {
    status: isDbConnected && !isShuttingDown ? "healthy" : "degraded",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: isDbConnected ? "connected" : "disconnected",
      readyState: mongoose.connection.readyState,
    },
    redis: {
      status: isRedisReady() ? "connected" : "standalone-mongodb",
    },
    system: {
      memoryRssMb: Math.round(mem.rss / (1024 * 1024)),
      memoryHeapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      memoryHeapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
      nodeVersion: process.version,
    },
  };

  const statusCode = isDbConnected && !isShuttingDown ? 200 : 503;
  res.status(statusCode).json(healthData);
};

app.get("/health", healthCheckHandler);
app.get("/api/health", healthCheckHandler);

// Centralized Production Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  console.error(`[UnhandledError] ${req.method} ${req.originalUrl}:`, err.message || err);

  if (res.headersSent) {
    return next(err);
  }

  const isProd = process.env.NODE_ENV === "production";
  const message = isProd && statusCode === 500
    ? "An unexpected internal server error occurred. Please try again later."
    : err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message,
    code: err.code || "SERVER_ERROR",
  });
});

// 404 Catch-all for API endpoints
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

/* ================================
   GRACEFUL SHUTDOWN & CRASH PROTECTION
   ================================ */
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}. Draining active connections and shutting down...`);

  server.close(async () => {
    console.log("🔒 HTTP server closed to new connections.");
    try {
      await closeRedis();
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close(false);
        console.log("🔒 MongoDB connection pool closed cleanly.");
      }
      process.exit(0);
    } catch (e) {
      console.error("❌ Error during graceful shutdown cleanup:", e.message);
      process.exit(1);
    }
  });

  // Force close after 10s timeout if active requests take too long
  setTimeout(() => {
    console.error("⚠️ Graceful shutdown timed out (10s). Forcing process exit.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Promise Rejection:", reason?.message || reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error.message || error);
});

