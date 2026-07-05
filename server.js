import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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

            console.log("\n===== RESUME RECEIVED =====");
            console.log("File Name:", req.file.originalname);

            const resumeBase64 =
                req.file.buffer.toString("base64");

            const prompt = `
You are an AI resume analyzer for a technical interview platform.

Analyze the candidate resume.

Extract only information explicitly present in the resume.

Do not invent skills, projects, experience, education, or certifications.

Return a structured candidate profile.

Use exactly this JSON structure:

{
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
}
`;

            const response =
                await ai.models.generateContent({
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

            const candidateProfile =
                JSON.parse(response.text);
            const questionPrompt = `
You are a professional technical interviewer.

Generate ONE interview question based strictly on the candidate's resume profile.

Candidate Profile:
${JSON.stringify(candidateProfile)}

Rules:
- Ask only one question.
- Question must be based on a skill or project explicitly present in the resume.
- Prefer technical skills and projects.
- Do not ask generic HR questions.
- Do not invent technologies.
- Start with medium difficulty.
- Return only JSON.

Use exactly this format:

{
  "question": "",
  "topic": "",
  "source": "skill | project",
  "difficulty": "medium"
}
`;

            const questionResponse =
                await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: questionPrompt,
                    config: {
                        responseMimeType: "application/json",
                    },
                });

            const firstQuestion =
                JSON.parse(questionResponse.text);

            console.log(
                "\n===== FIRST RESUME BASED QUESTION =====\n"
            );

            console.log(
                JSON.stringify(firstQuestion, null, 2)
            );
            console.log(
                "\n===== STRUCTURED CANDIDATE PROFILE =====\n"
            );

            console.log(
                JSON.stringify(candidateProfile, null, 2)
            );

            res.json({
                message: "Resume analyzed successfully",
                candidateProfile,
                firstQuestion,
            });

        } catch (error) {
            console.error(
                "\nResume Analysis Error:",
                error.message
            );

            res.status(500).json({
                message: "Resume analysis failed",
                error: error.message,
            });
        }
    }
);

const PORT = 5000;

app.listen(PORT, () => {
    console.log(
        `Backend server running on port ${PORT}`
    );
});