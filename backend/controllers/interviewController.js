import Interview from "../models/Interview.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";
import { GoogleGenAI } from "@google/genai";
import { selectRandomQuestions, shuffleArray } from "../services/questionBank.js";
import {
  onAnswerSubmitted,
  onInterviewCompleted,
  onResultGenerated,
} from "../utils/csvExporter.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const DEFAULT_HR_QUESTIONS = [
  {
    id: "HR-01",
    question: "Tell me about yourself, your academic background, and why you are pursuing a career in software engineering.",
    topic: "Introduction & Background",
    difficulty: "Easy",
    category: "hr",
    aiSpeechText: "Welcome to the HR round! To start off, please tell me about yourself and why you're pursuing software engineering."
  },
  {
    id: "HR-02",
    question: "What are your key technical strengths, and what is one technical area or skill you are actively working to improve?",
    topic: "Strengths & Development",
    difficulty: "Easy",
    category: "hr",
    aiSpeechText: "What would you consider your key technical strengths, and what is one skill you're working to improve?"
  },
  {
    id: "HR-03",
    question: "Describe a situation where you faced a challenge or conflict during a team project and how you handled it.",
    topic: "Teamwork & Collaboration",
    difficulty: "Medium",
    category: "hr",
    aiSpeechText: "Can you describe a situation where you faced a challenge or conflict while working in a team, and how you resolved it?"
  },
  {
    id: "HR-04",
    question: "How do you manage your time and stay focused when dealing with multiple tasks or tight deadlines under pressure?",
    topic: "Time Management & Pressure",
    difficulty: "Medium",
    category: "hr",
    aiSpeechText: "How do you manage your time and handle pressure when working on multiple projects with tight deadlines?"
  },
  {
    id: "HR-05",
    question: "Where do you see yourself in 3 to 5 years, and how does your career goal align with this engineering position?",
    topic: "Career Goals & Alignment",
    difficulty: "Easy",
    category: "hr",
    aiSpeechText: "Where do you see yourself professionally in three to five years, and how does this role fit into your long-term goals?"
  }
];

/**
 * POST /api/interview/start
 * Creates a unique real interview session with locked 58-question blueprint:
 * 1-25: Technical + Resume / Project (25)
 * 26-30: HR (5)
 * 31-55: Aptitude (25)
 * 56-58: Coding (3)
 */
export const startInterview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { interviewType = "actual", candidateName = "", resumeFileName = "" } = req.body;

    const student = await User.findById(userId).select("-password");

    // ─── 1. SECTION 1: Technical + Resume/Project (25 Questions) ───
    const techQuestionCount = 25;
    let geminiContents = [];

    const promptText = `You are a senior technical interviewer and resume analyzer.
Generate EXACTLY ${techQuestionCount} personalized, non-duplicate technical and project-focused interview questions derived strictly from the candidate's background, technical skills, projects, and work experience.

Candidate Name: ${student?.name || candidateName || "Candidate"}
Candidate Skills: ${student?.skills?.length ? student.skills.join(", ") : "Full-Stack Development, Data Structures, System Design"}
Department: ${student?.department || "Computer Science"}

CRITICAL RULES:
- ONLY ask about technologies, projects, or concepts present in or directly relevant to the candidate's background/skills.
- Do NOT generate questions for technologies not present in the candidate's profile.
- Balance the 25 questions across project architecture, technical concepts, implementation details, debugging, and practical problem solving.
- Avoid duplicate wording or repeating the same concept.

For each question provide:
- id (e.g. "TECH-01" to "TECH-25")
- question (Clear, professional technical question)
- topic (e.g. "System Architecture", "React & Frontend", "Node.js & Backend", "Database Optimization")
- difficulty ("Easy", "Medium", or "Hard")
- category ("resume" or "technical")
- aiSpeechText (Conversational phrasing for AI interviewer Alex)

Return ONLY valid JSON in exactly this structure:
{
  "questions": [
    {
      "id": "TECH-01",
      "question": "In your project, how did you handle state isolation and API authentication across microservices?",
      "topic": "System Architecture",
      "difficulty": "Medium",
      "category": "resume",
      "aiSpeechText": "Welcome! Looking at your resume, you built a distributed web application. Could you explain how you handled state isolation and API authentication?"
    }
  ]
}`;

    if (student?.resumeBase64) {
      geminiContents = [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: student.resumeBase64,
          },
        },
        { text: promptText },
      ];
    } else {
      geminiContents = [{ text: promptText }];
    }

    let techResumeQuestions = [];
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: geminiContents,
        config: { responseMimeType: "application/json" },
      });

      const parsed = JSON.parse(response.text);
      techResumeQuestions = (parsed.questions || []).slice(0, 25);
    } catch (aiErr) {
      console.warn("Gemini 25-question generation fallback:", aiErr.message);
    }

    // Top up to 25 if fewer returned or fallback needed
    if (techResumeQuestions.length < 25) {
      const skillsStr = student?.skills?.slice(0, 3).join(", ") || "Software Engineering";
      const defaultTopics = [
        "Project Architecture", "API Design", "Database Management", "State Management",
        "Performance Optimization", "Asynchronous Processing", "Security & Authentication",
        "Error Handling", "Testing & QA", "Caching Strategies", "System Scalability",
        "Code Maintainability", "Version Control & CI/CD", "Data Structures", "Object-Oriented Design",
        "Frontend Rendering", "Backend Microservices", "RESTful API Best Practices",
        "Database Indexing", "Concurrency & Threading", "Deployment & Cloud",
        "System Monitoring", "Algorithmic Efficiency", "Design Patterns", "Refactoring"
      ];

      for (let i = techResumeQuestions.length; i < 25; i++) {
        const topic = defaultTopics[i] || `Technical Topic ${i + 1}`;
        techResumeQuestions.push({
          id: `TECH-${String(i + 1).padStart(2, "0")}`,
          question: `Regarding ${topic} in your project work (${skillsStr}), how did you implement and test this capability?`,
          topic: topic,
          difficulty: i % 3 === 0 ? "Hard" : "Medium",
          category: i < 10 ? "resume" : "technical",
          aiSpeechText: `Let's discuss ${topic}. In your technical work involving ${skillsStr}, how did you approach this?`
        });
      }
    }

    // ─── 2. SECTION 2: HR (5 Questions) ───
    const hrQuestions = DEFAULT_HR_QUESTIONS;

    // ─── 3. SECTION 3: Aptitude (25 Questions) ───
    let aptDbQuestions = await AptitudeQuestion.find({ isActive: true, isDeleted: false }).lean();
    let selectedAptitude = [];

    if (aptDbQuestions && aptDbQuestions.length >= 25) {
      selectedAptitude = shuffleArray(aptDbQuestions).slice(0, 25);
    } else {
      const bankPicked = selectRandomQuestions({ count: 25 });
      if (bankPicked && bankPicked.length > 0) {
        selectedAptitude = bankPicked.slice(0, 25);
      } else {
        // Emergency fallback if bank empty
        selectedAptitude = (aptDbQuestions || []).concat(
          Array.from({ length: 25 }).map((_, idx) => ({
            questionId: `APT-${idx + 1}`,
            question: `Aptitude sample question ${idx + 1}: If speed is 60 km/h, distance in 2 hours is?`,
            options: ["60 km", "120 km", "180 km", "240 km"],
            correctAnswer: "120 km",
            difficulty: "easy",
            category: "Quantitative"
          }))
        ).slice(0, 25);
      }
    }

    // ─── 4. SECTION 4: Coding (3 Questions) ───
    let codingDbQuestions = await CodingQuestion.find({ isActive: true, isDeleted: false }).lean();
    let selectedCoding = [];

    if (codingDbQuestions && codingDbQuestions.length >= 3) {
      selectedCoding = codingDbQuestions.slice(0, 3);
    } else {
      selectedCoding = [
        {
          questionId: "CODE-01",
          title: "Palindrome Check",
          problemStatement: "Write a function to check whether a given string is a palindrome. Return true if it is a palindrome, false otherwise.",
          inputFormat: "A single string input",
          outputFormat: "Boolean (true or false)",
          constraints: "String length <= 1000",
          sampleInput: "\"racecar\"",
          sampleOutput: "true",
          starterCode: "function solution(str) {\n  // Write your solution here\n}",
          difficulty: "Easy",
          testCases: [{ input: "racecar", expected: "true" }]
        },
        {
          questionId: "CODE-02",
          title: "Two Sum Problem",
          problemStatement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
          inputFormat: "Array of integers and target number",
          outputFormat: "Array of two indices [i, j]",
          constraints: "2 <= nums.length <= 10^4",
          sampleInput: "[2, 7, 11, 15], target = 9",
          sampleOutput: "[0, 1]",
          starterCode: "function solution(nums, target) {\n  // Write your solution here\n}",
          difficulty: "Medium",
          testCases: [{ input: "[2,7,11,15], 9", expected: "[0,1]" }]
        },
        {
          questionId: "CODE-03",
          title: "Longest Substring Without Repeating Characters",
          problemStatement: "Given a string s, find the length of the longest substring without repeating characters.",
          inputFormat: "A single string s",
          outputFormat: "An integer representing max length",
          constraints: "0 <= s.length <= 5 * 10^4",
          sampleInput: "\"abcabcbb\"",
          sampleOutput: "3",
          starterCode: "function solution(s) {\n  // Write your solution here\n}",
          difficulty: "Hard",
          testCases: [{ input: "abcabcbb", expected: "3" }]
        }
      ];
    }

    // ─── COMBINE ALL INTO LOCKED 58-QUESTION BLUEPRINT ───
    // Preferred Default Order: Aptitude (25) -> Technical (25) -> Coding (3) -> HR (5)
    const generatedQuestions = [];

    // Questions 1..25: APTITUDE (25)
    selectedAptitude.forEach((aptQ, i) => {
      generatedQuestions.push({
        id: `APT-${String(i + 1).padStart(2, "0")}`,
        questionId: aptQ.questionId || `APT-${String(i + 1).padStart(2, "0")}`,
        order: i + 1,
        section: "APTITUDE",
        type: "aptitude",
        category: "aptitude",
        source: "APTITUDE_BANK",
        question: aptQ.question,
        options: aptQ.options || [],
        correctAnswer: aptQ.correctAnswer || "",
        explanation: aptQ.explanation || "",
        topic: aptQ.category || "General Aptitude",
        difficulty: aptQ.difficulty || "Medium"
      });
    });

    // Questions 26..50: TECHNICAL + RESUME / PROJECT (25)
    techResumeQuestions.forEach((q, i) => {
      generatedQuestions.push({
        id: `TECH-${String(i + 1).padStart(2, "0")}`,
        questionId: `TECH-${String(i + 1).padStart(2, "0")}`,
        order: 25 + i + 1,
        section: "TECHNICAL",
        type: "technical",
        category: q.category || (i < 10 ? "resume" : "technical"),
        source: student?.resumeBase64 ? "RESUME" : "AI_GENERATED",
        question: q.question,
        topic: q.topic || "Technical Engineering",
        difficulty: q.difficulty || "Medium",
        aiSpeechText: q.aiSpeechText || q.question,
        resumeContext: student?.resumeFileName || "Uploaded Resume"
      });
    });

    // Questions 51..53: CODING (3)
    selectedCoding.forEach((codeQ, i) => {
      generatedQuestions.push({
        id: `CODE-${String(i + 1).padStart(2, "0")}`,
        questionId: codeQ.questionId || `CODE-${String(i + 1).padStart(2, "0")}`,
        order: 50 + i + 1,
        section: "CODING",
        type: "coding",
        category: "coding",
        source: "CODING_BANK",
        title: codeQ.title || `Coding Problem ${i + 1}`,
        question: codeQ.problemStatement || codeQ.description || codeQ.title,
        problemStatement: codeQ.problemStatement || codeQ.description || codeQ.title,
        inputFormat: codeQ.inputFormat || "",
        outputFormat: codeQ.outputFormat || "",
        constraints: codeQ.constraints || "",
        sampleInput: codeQ.sampleInput || "",
        sampleOutput: codeQ.sampleOutput || "",
        starterCode: codeQ.starterCode || "function solution() {\n  // Write your code here\n}",
        testCases: codeQ.testCases || [],
        difficulty: codeQ.difficulty || "Medium",
        topic: codeQ.category || "Algorithms"
      });
    });

    // Questions 54..58: HR (5)
    hrQuestions.forEach((hrQ, i) => {
      generatedQuestions.push({
        id: `HR-${String(i + 1).padStart(2, "0")}`,
        questionId: `HR-${String(i + 1).padStart(2, "0")}`,
        order: 53 + i + 1,
        section: "HR",
        type: "hr",
        category: "hr",
        source: "HR_BANK",
        question: hrQ.question,
        topic: hrQ.topic,
        difficulty: hrQ.difficulty,
        aiSpeechText: hrQ.aiSpeechText
      });
    });

    // Create session in MongoDB with snapshot
    const interview = await Interview.create({
      userId,
      status: "IN_PROGRESS",
      interviewType: "actual",
      startedAt: new Date(),
      resumeFileName: student?.resumeFileName || resumeFileName || "Uploaded_Resume.pdf",
      resumeSnapshot: {
        resumeFileName: student?.resumeFileName || "",
        skills: student?.skills || [],
        atsScore: student?.atsScore || 0,
        snapshotAt: new Date()
      },
      totalQuestions: generatedQuestions.length,
      currentQuestionIndex: 1,
      questionsAnswered: 0,
      candidateProfile: {
        candidateName: student?.name || candidateName || "Candidate",
        skills: student?.skills || [],
        department: student?.department || ""
      },
      generatedQuestions,
    });

    res.json({
      message: "Real Interview session created successfully",
      sessionId: interview._id,
      interviewId: interview._id,
      totalQuestions: generatedQuestions.length,
      generatedQuestions,
    });
  } catch (error) {
    console.error("Start Interview Error:", error.message);
    res.status(500).json({ message: "Failed to start interview session", error: error.message });
  }
};

export const uploadResumeAndGenerateQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }
    
    const userId = req.user.id;
    const resumeBase64 = req.file.buffer.toString("base64");

    // Persist resume to student's User profile
    const student = await User.findById(userId);
    if (student) {
      student.resumeFileName = req.file.originalname;
      student.resumeUploadedAt = new Date();
      student.resumeBase64 = resumeBase64;
      await student.save();
    }
    
    const prompt = `You are an AI resume analyzer and professional technical interviewer.
Analyze the uploaded candidate resume carefully.
Extract only information explicitly present in the resume.
After analyzing the resume, create a personalized technical interview question set.

Generate exactly:
1. 5 Resume / Project Questions
2. 5 Technical Questions

Return ONLY valid JSON.
Use exactly this JSON structure:
{
  "candidateProfile": {
    "candidateName": "",
    "skills": [],
    "projects": [{"name": "", "description": "", "technologies": []}]
  },
  "resumeQuestions": [{"id": "RESUME-01", "question": "", "topic": "", "difficulty": "medium", "aiSpeechText": "..."}],
  "technicalQuestions": [{"id": "TECH-01", "question": "", "topic": "", "difficulty": "medium", "aiSpeechText": "..."}]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { inlineData: { mimeType: req.file.mimetype, data: resumeBase64 } },
        { text: prompt },
      ],
      config: { responseMimeType: "application/json" },
    });

    const interviewData = JSON.parse(response.text);
    
    if (student && interviewData.candidateProfile?.skills?.length) {
      student.skills = [...new Set([...student.skills, ...interviewData.candidateProfile.skills])];
      await student.save();
    }

    // Map questions to a single array with category field
    const generatedQuestions = [
      ...(interviewData.resumeQuestions || []).map(q => ({ ...q, category: "resume" })),
      ...(interviewData.technicalQuestions || []).map(q => ({ ...q, category: "technical" })),
      ...(interviewData.codingQuestions || []).map(q => ({ ...q, category: "coding" }))
    ];
    
    // Save to DB
    const interview = await Interview.create({
      userId,
      status: "in_progress",
      interviewType: "mock",
      resumeFileName: req.file.originalname,
      totalQuestions: generatedQuestions.length,
      candidateProfile: interviewData.candidateProfile,
      generatedQuestions: generatedQuestions
    });

    res.json({
      message: "Resume analyzed and interview generated successfully",
      interviewId: interview._id,
      candidateProfile: interviewData.candidateProfile,
      questions: generatedQuestions,
      generatedQuestions: generatedQuestions
    });
  } catch (error) {
    console.error("Interview Generation Error:", error.message);
    res.status(500).json({ message: "Resume analysis failed", error: error.message });
  }
};

export const getInterviewDetails = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) {
      return res.status(404).json({ message: "Interview session not found" });
    }
    
    // Ensure the user owns this interview
    if (interview.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Fetch all saved answers for session state recovery
    const answers = await Answer.find({ interviewId: interview._id }).sort({ createdAt: 1 });

    res.json({
      ...interview.toObject(),
      sessionId: interview._id.toString(),
      answers,
    });
  } catch (error) {
    console.error("Fetch Interview Error:", error.message);
    res.status(500).json({ message: "Failed to fetch interview session details" });
  }
};

export const saveAnswer = async (req, res) => {
  try {
    const {
      questionId,
      question,
      category,
      section,
      answer,
      transcript,
      inputMethod = "TEXT",
      mode = "text",
      duration = 0,
      currentQuestionIndex
    } = req.body;

    const interviewId = req.params.id;
    const userId = req.user.id;

    // Verify interview exists and belongs to user
    const interview = await Interview.findById(interviewId);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(404).json({ message: "Interview not found or not authorized" });
    }

    const officialAnswer = answer || transcript || "";
    const officialTranscript = transcript || answer || "";

    let score = 0;
    let feedback = "";
    
    if (officialAnswer && officialAnswer.trim().length > 0) {
      if (category === "aptitude" || category === "coding") {
        score = 85;
        feedback = "Response recorded successfully.";
      } else {
        try {
          const prompt = `You are a technical interviewer evaluating a candidate's answer.
          Question: ${question}
          Category: ${category}
          Candidate's Answer: ${officialAnswer}
          
          Rate this answer out of 100 for technical accuracy, clarity, and completeness.
          Provide a brief feedback sentence.
          
          Return exactly this JSON format:
          { "score": 85, "feedback": "Good understanding of the concept." }`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ text: prompt }],
            config: { responseMimeType: "application/json" }
          });
          
          const evalData = JSON.parse(response.text);
          score = evalData.score || 0;
          feedback = evalData.feedback || "";
        } catch (aiErr) {
          console.error("AI Evaluation failed:", aiErr);
          score = officialAnswer.length > 20 ? 75 : 40;
          feedback = "Answer recorded.";
        }
      }
    } else {
      feedback = "Question skipped or answer empty.";
    }

    const formattedInputMethod = inputMethod === "VOICE" || mode === "voice" ? "VOICE" : "TEXT";
    const formattedSection = section || (category ? category.toUpperCase() : "TECHNICAL");

    // Upsert answer to prevent duplicate records for the same question
    let existingAnswer = await Answer.findOne({ interviewId, questionId });
    let newAnswer;
    if (existingAnswer) {
      existingAnswer.answer = officialAnswer;
      existingAnswer.transcript = officialTranscript;
      existingAnswer.inputMethod = formattedInputMethod;
      existingAnswer.mode = formattedInputMethod === "VOICE" ? "voice" : "text";
      existingAnswer.section = formattedSection;
      existingAnswer.duration = Math.max(0, Number(duration) || 0);
      existingAnswer.score = score;
      existingAnswer.feedback = feedback;
      existingAnswer.timestamp = new Date();
      newAnswer = await existingAnswer.save();
    } else {
      newAnswer = await Answer.create({
        interviewId,
        userId,
        questionId,
        questionType: category || "technical",
        section: formattedSection,
        question,
        answer: officialAnswer,
        transcript: officialTranscript,
        inputMethod: formattedInputMethod,
        mode: formattedInputMethod === "VOICE" ? "voice" : "text",
        duration: Math.max(0, Number(duration) || 0),
        evaluation: { score, feedback },
        score,
        feedback,
        timestamp: new Date()
      });
      interview.questionsAnswered += 1;
    }
    
    if (currentQuestionIndex) {
      interview.currentQuestionIndex = Number(currentQuestionIndex);
    }
    await interview.save();

    // Update CSV export (non-blocking)
    onAnswerSubmitted().catch((err) =>
      console.error("CSV export error (answers):", err.message)
    );

    res.json({ message: "Answer saved", answer: newAnswer });
  } catch (error) {
    console.error("Save Answer Error:", error.message);
    res.status(500).json({ message: "Failed to save answer" });
  }
};

/**
 * POST /api/interview/tts
 * Provider-agnostic Audio Text-to-Speech synthesis controller endpoint.
 */
export const generateTTS = async (req, res) => {
  try {
    const { text, persona = "technical" } = req.body;
    if (!text) {
      return res.status(400).json({ message: "Text is required for TTS synthesis" });
    }

    // ElevenLabs Integration if configured
    if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID) {
      const voiceId = process.env.ELEVENLABS_VOICE_ID;
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.75, similarity_boost: 0.75 }
        })
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString("base64");
        return res.json({
          provider: "elevenlabs",
          audioBase64: `data:audio/mpeg;base64,${base64Audio}`
        });
      }
    }

    // Provider abstraction fallback to tuned browser speech engine
    return res.json({
      provider: "browser",
      fallback: true,
      text,
      profile: {
        pitch: persona === "hr" ? 0.92 : 0.86,
        rate: persona === "hr" ? 0.94 : 0.90,
        volume: 1.0,
        genderPreference: "male",
        style: "Deep, calm, corporate, mature senior interviewer"
      }
    });
  } catch (error) {
    console.error("TTS controller error:", error);
    res.status(500).json({ message: "TTS synthesis failed", fallback: true, text: req.body?.text || "" });
  }
};

export const completeInterview = async (req, res) => {
  try {
    const interviewId = req.params.id;
    const userId = req.user.id;

    // Verify interview exists and belongs to user
    const interview = await Interview.findById(interviewId);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(404).json({ message: "Interview not found or not authorized" });
    }

    interview.status = "completed";
    interview.completedAt = new Date();
    await interview.save();

    // Fetch all answers for this interview
    const answers = await Answer.find({ interviewId });
    
    let resumeScoreTotal = 0;
    let techScoreTotal = 0;
    let codeScoreTotal = 0;
    let resumeCount = 0;
    let techCount = 0;
    let codeCount = 0;

    answers.forEach(a => {
      if (a.questionType === "resume") {
        resumeScoreTotal += a.score;
        resumeCount++;
      } else if (a.questionType === "technical") {
        techScoreTotal += a.score;
        techCount++;
      } else if (a.questionType === "coding") {
        codeScoreTotal += a.score;
        codeCount++;
      }
    });

    const resumeScore = resumeCount > 0 ? Math.round(resumeScoreTotal / resumeCount) : 0;
    const technicalScore = techCount > 0 ? Math.round(techScoreTotal / techCount) : 0;
    const codingScore = codeCount > 0 ? Math.round(codeScoreTotal / codeCount) : 0;
    
    // Overall score weighted average (tech 40%, code 40%, resume 20%)
    const overallScore = Math.round((resumeScore * 0.2) + (technicalScore * 0.4) + (codingScore * 0.4));

    const strengths = ["Good understanding of concepts"];
    if (technicalScore > 75) strengths.push("Strong technical knowledge");
    if (codingScore > 75) strengths.push("Excellent problem-solving skills");
    if (resumeScore > 75) strengths.push("Clear communication of past projects");

    const weaknesses = [];
    if (technicalScore < 50) weaknesses.push("Needs improvement in technical depth");
    if (codingScore < 50) weaknesses.push("Needs to practice coding problems");
    if (resumeScore < 50) weaknesses.push("Need better explanation of resume projects");

    const result = await Result.create({
      interviewId,
      userId,
      overallScore,
      resumeScore,
      technicalScore,
      codingScore,
      strengths,
      weaknesses: weaknesses.length > 0 ? weaknesses : ["No major weaknesses identified"],
      recommendation: overallScore > 70 ? "Highly Recommended" : "Needs Practice"
    });

    // Update CSV exports (non-blocking)
    onInterviewCompleted().catch((err) =>
      console.error("CSV export error (interviews):", err.message)
    );
    onResultGenerated().catch((err) =>
      console.error("CSV export error (results):", err.message)
    );

    res.json({ message: "Interview completed successfully", result });
  } catch (error) {
    console.error("Complete Interview Error:", error.message);
    res.status(500).json({ message: "Failed to complete interview" });
  }
};

export const getUserResults = async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(results);
  } catch (error) {
    console.error("Get User Results Error:", error.message);
    res.status(500).json({ message: "Failed to fetch user results" });
  }
};

/**
 * GET /api/interview/user/history
 * Returns all past interview sessions for the logged-in user.
 */
export const getUserInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select("-generatedQuestions"); // Exclude large questions array for listing

    // Fetch results for each interview to include scores
    const interviewIds = interviews.map((i) => i._id);
    const results = await Result.find({ interviewId: { $in: interviewIds } })
      .select("interviewId overallScore recommendation");

    const resultMap = {};
    results.forEach((r) => {
      resultMap[r.interviewId.toString()] = r;
    });

    const history = interviews.map((interview) => {
      const result = resultMap[interview._id.toString()];
      return {
        id: interview._id,
        interviewType: interview.interviewType || "mock",
        status: interview.status,
        resumeFileName: interview.resumeFileName || "",
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
        totalQuestions: interview.totalQuestions,
        questionsAnswered: interview.questionsAnswered,
        candidateName: interview.candidateProfile?.candidateName || "Candidate",
        createdAt: interview.createdAt,
        overallScore: result?.overallScore ?? null,
        recommendation: result?.recommendation || null,
      };
    });

    res.json(history);
  } catch (error) {
    console.error("Get User Interviews Error:", error.message);
    res.status(500).json({ message: "Failed to fetch interview history" });
  }
};

/**
 * POST /api/interview/:id/integrity-event
 * Logs structured security integrity events (FULLSCREEN_EXIT, TAB_SWITCH, VISIBILITY_CHANGE, COPY_ATTEMPT, PASTE_ATTEMPT, CONTEXT_MENU_ATTEMPT)
 */
export const logIntegrityEvent = async (req, res) => {
  try {
    const interviewId = req.params.id;
    const userId = req.user.id;
    const { eventType, questionId = "", questionIndex = 1, section = "TECHNICAL", details = "" } = req.body;

    if (!eventType) {
      return res.status(400).json({ message: "eventType is required" });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview || interview.userId.toString() !== userId.toString()) {
      return res.status(404).json({ message: "Interview session not found or unauthorized" });
    }

    interview.integrityEvents.push({
      eventType,
      timestamp: new Date(),
      questionId,
      questionIndex: Number(questionIndex) || 1,
      section,
      details
    });

    await interview.save();

    res.json({
      message: "Integrity event recorded successfully",
      totalEvents: interview.integrityEvents.length
    });
  } catch (error) {
    console.error("Log integrity event error:", error.message);
    res.status(500).json({ message: "Failed to record integrity event" });
  }
};
