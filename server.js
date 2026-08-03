import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./backend/config/db.js";
import authRoutes from "./backend/routes/auth.js";
import interviewRoutes from "./backend/routes/interviewRoutes.js";
import adminRoutes from "./backend/routes/adminRoutes.js";
import { initializeCSVExports } from "./backend/utils/csvExporter.js";

// Load .env from root
dotenv.config();

// Debug - Check if .env loaded
console.log('📁 Current directory:', process.cwd());
console.log('🔑 MONGO_URI:', process.env.MONGO_URI ? '✅ Loaded' : '❌ Not Loaded');
console.log('🔑 GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Loaded' : '❌ Not Loaded');

/* ================================
   DATABASE CONNECTION
   ================================ */
connectDB();

/* ================================
   CSV EXPORT INITIALIZATION
   ================================ */
initializeCSVExports();

const app = express();

// CORS — allow both 5173 and 5174 in case port shifts
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

/* ================================
   ROUTES
   ================================ */
app.use("/api/auth", authRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/admin", adminRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.json({ message: "AI Interview Backend Running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});