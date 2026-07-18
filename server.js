import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import connectDB from "./backend/config/db.js";  // ← Path sahi hai
import authRoutes from "./backend/routes/auth.js"; // ← Path sahi hai
import { initializeCSVExports } from "./backend/utils/csvExporter.js"; // ← Path sahi hai

// Load .env from root
dotenv.config(); // ← Ye root mein .env file dhoondhega

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
   Admin backup files — MongoDB is primary
   ================================ */
initializeCSVExports();

const app = express();

// CORS setup - Frontend URL ke saath
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

/* ================================
   AUTH ROUTES
   ================================ */
app.use("/api/auth", authRoutes);

// Health Check Route (Add this for testing)
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const upload = multer({
  storage: multer.memoryStorage(),
});

app.get("/", (req, res) => {
  res.json({
    message: "AI Interview Backend Running",
  });
});

app.post(
  "/api/resume/upload",
  upload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Resume file is required",
        });
      }

      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({
          message: "Only PDF resumes are allowed",
        });
      }

      console.log("\n===== RESUME RECEIVED =====");
      console.log("File Name:", req.file.originalname);

      const resumeBase64 = req.file.buffer.toString("base64");

      const prompt = `
You are an AI resume analyzer and professional technical interviewer.

Analyze the uploaded candidate resume carefully.

Extract only information explicitly present in the resume.

Do not invent:
- Skills
- Technologies
- Projects
- Experience
- Education
- Certifications

After analyzing the resume, create a personalized technical interview question set.

Generate exactly:

1. 10 Resume / Project Questions
2. 20 Technical Questions
3. 3 Coding Questions

QUESTION GENERATION RULES:

RESUME / PROJECT QUESTIONS:
- Generate exactly 10 questions.
- Questions must be based on projects explicitly present in the resume.
- Ask about project architecture.
- Ask about implementation decisions.
- Ask why a particular technology was used.
- Ask about challenges.
- Ask about security if relevant.
- Ask about deployment if relevant.
- Ask about project results or performance claims if present.
- Do not invent project details.

TECHNICAL QUESTIONS:
- Generate exactly 20 questions.
- Questions must be based on technical skills explicitly present in the resume.
- Cover multiple technical skills.
- Do not generate all questions from only one skill.
- Include easy, medium, and hard difficulty questions.
- Prefer interview-oriented conceptual and practical questions.
- Do not ask HR questions.
- Do not ask aptitude questions.

CODING QUESTIONS:
- Generate exactly 3 coding questions.
- Base programming language preference on languages explicitly present in the resume.
- Questions must be suitable for a technical interview.
- Include problem-solving questions.
- Do not provide solutions.
- Do not provide hints.
- Do not provide expected code.

Return ONLY valid JSON.

Use exactly this JSON structure:

{
  "candidateProfile": {
    "candidateName": "",
    "education": [
      {
        "degree": "",
        "institution": "",
        "year": ""
      }
    ],
    "skills": [],
    "projects": [
      {
        "name": "",
        "description": "",
        "technologies": []
      }
    ],
    "experience": [
      {
        "role": "",
        "organization": "",
        "description": ""
      }
    ],
    "certifications": []
  },

  "resumeQuestions": [
    {
      "id": "RESUME-01",
      "question": "",
      "topic": "",
      "difficulty": "easy | medium | hard"
    }
  ],

  "technicalQuestions": [
    {
      "id": "TECH-01",
      "question": "",
      "topic": "",
      "difficulty": "easy | medium | hard"
    }
  ],

  "codingQuestions": [
    {
      "id": "CODE-01",
      "question": "",
      "language": "",
      "difficulty": "easy | medium | hard"
    }
  ]
}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: req.file.mimetype,
              data: resumeBase64,
            },
          },
          {
            text: prompt,
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const interviewData = JSON.parse(response.text);

      const {
        candidateProfile,
        resumeQuestions,
        technicalQuestions,
        codingQuestions,
      } = interviewData;

      if (
        !candidateProfile ||
        !Array.isArray(resumeQuestions) ||
        !Array.isArray(technicalQuestions) ||
        !Array.isArray(codingQuestions)
      ) {
        throw new Error("Invalid interview data returned by AI");
      }

      console.log("\n===== CANDIDATE PROFILE =====\n");
      console.log(JSON.stringify(candidateProfile, null, 2));

      console.log("\n===== QUESTION COUNT =====\n");
      console.log("Resume Questions:", resumeQuestions.length);
      console.log("Technical Questions:", technicalQuestions.length);
      console.log("Coding Questions:", codingQuestions.length);

      console.log("\n===== RESUME QUESTIONS =====\n");
      console.log(JSON.stringify(resumeQuestions, null, 2));

      console.log("\n===== TECHNICAL QUESTIONS =====\n");
      console.log(JSON.stringify(technicalQuestions, null, 2));

      console.log("\n===== CODING QUESTIONS =====\n");
      console.log(JSON.stringify(codingQuestions, null, 2));

      res.json({
        message: "Resume analyzed and interview generated successfully",
        candidateProfile,
        resumeQuestions,
        technicalQuestions,
        codingQuestions,
        questionCount: {
          resume: resumeQuestions.length,
          technical: technicalQuestions.length,
          coding: codingQuestions.length,
          total: resumeQuestions.length + technicalQuestions.length + codingQuestions.length,
        },
      });
    } catch (error) {
      console.error("\nInterview Generation Error:", error.message);
      res.status(500).json({
        message: "Resume analysis or interview generation failed",
        error: error.message,
      });
    }
  }
);

app.post("/api/interview/evaluate-technical", async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ message: "Question and answer are required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not defined, using mock fallback evaluator");
      let score = 5;
      let feedback = "Your answer was received. Set GEMINI_API_KEY for AI feedback.";
      if (answer.trim().length > 100) {
        score = 8;
        feedback = "Good explanation. The answer is descriptive, details core properties, and demonstrates understanding.";
      } else if (answer.trim().length > 40) {
        score = 6;
        feedback = "Fair answer. Try to elaborate on technical details, syntax, and use cases.";
      } else {
        score = 4;
        feedback = "The answer is too brief. Please explain the concepts in more depth and detail.";
      }
      return res.json({ score, feedback });
    }

    const prompt = `
You are an expert technical interviewer. Evaluate the candidate's answer to the following technical question:

Question: ${question}
Candidate's Answer: ${answer}

Provide your evaluation in a JSON structure containing:
1. "score": a number from 0 to 10 (representing how correct and complete the answer is)
2. "feedback": a brief 2-3 sentence explanation of the score, pointing out correctness, missing details, and how to improve.

Return ONLY valid JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text);
    res.json({
      score: result.score ?? 5,
      feedback: result.feedback ?? "Unable to generate specific feedback."
    });
  } catch (error) {
    console.error("AI evaluation failed:", error.message);
    res.status(500).json({ message: "AI evaluation failed", error: error.message });
  }
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});