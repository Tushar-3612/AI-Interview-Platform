import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

// Technical vocabulary bias prompt to guide Whisper towards accurate tech spelling
const TECH_PROMPT =
  "React, React.js, Node, Node.js, Express, Express.js, MongoDB, MySQL, PostgreSQL, SQLite, JWT, JSON Web Token, Java, JavaScript, TypeScript, Python, C++, C#, Spring Boot, Django, Flask, Docker, Kubernetes, Git, GitHub, GitLab, REST API, GraphQL, SQL, NoSQL, Redis, Kafka, AWS, Azure, GCP, CI/CD, DevOps, Microservices, API Gateway, Linux, HTML, CSS, Redux, Tailwind CSS.";

/**
 * Helper to select the active Groq API key from environment variables.
 */
function getGroqKey() {
  return (
    process.env.AI_API_KEY ||
    process.env.MOCK_INTERVIEW_API_KEY ||
    process.env.MOCK_INTERVIEW_API_KEY2 ||
    process.env.TCS_MOCK_KEY ||
    process.env.ACCENTURE_MOCK_KEY ||
    ""
  ).trim();
}

/**
 * Conservative formatting: normalize technical term casing and spacing without altering user meaning.
 */
function conservativeFormat(text) {
  if (!text || typeof text !== "string") return "";
  let cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  // Normalize casing of clear technical keywords without altering surrounding text
  const safeReplacements = [
    { pattern: /\bnode\s*js\b/gi, replacement: "Node.js" },
    { pattern: /\breact\s*js\b/gi, replacement: "React" },
    { pattern: /\bnext\s*js\b/gi, replacement: "Next.js" },
    { pattern: /\bexpress\s*js\b/gi, replacement: "Express.js" },
    { pattern: /\bjavascript\b/gi, replacement: "JavaScript" },
    { pattern: /\btypescript\b/gi, replacement: "TypeScript" },
    { pattern: /\bmongodb\b/gi, replacement: "MongoDB" },
    { pattern: /\bpostgresql\b/gi, replacement: "PostgreSQL" },
    { pattern: /\bpostgres\b/gi, replacement: "PostgreSQL" },
    { pattern: /\bmysql\b/gi, replacement: "MySQL" },
    { pattern: /\bsqlite\b/gi, replacement: "SQLite" },
    { pattern: /\bjwt\b/gi, replacement: "JWT" },
    { pattern: /\brest\s*api\b/gi, replacement: "REST API" },
    { pattern: /\brest\s*apis\b/gi, replacement: "REST APIs" },
    { pattern: /\bgraphql\b/gi, replacement: "GraphQL" },
    { pattern: /\bdocker\b/gi, replacement: "Docker" },
    { pattern: /\bkubernetes\b/gi, replacement: "Kubernetes" },
    { pattern: /\bgithub\b/gi, replacement: "GitHub" },
    { pattern: /\bgitlab\b/gi, replacement: "GitLab" },
    { pattern: /\bci\/cd\b/gi, replacement: "CI/CD" },
    { pattern: /\bapi\b/gi, replacement: "API" },
    { pattern: /\bapis\b/gi, replacement: "APIs" },
    { pattern: /\bjson\b/gi, replacement: "JSON" },
  ];

  for (const { pattern, replacement } of safeReplacements) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Reject known Whisper hallucinations during silence / ambient noise
  const normalized = cleaned.toLowerCase().replace(/[.,!?;:"'\-]/g, "").trim();
  const hallucinations = [
    "thank you",
    "thank you so much",
    "thank you very much",
    "thanks for watching",
    "thank you for watching",
    "thanks",
    "bye",
    "goodbye",
    "you",
    "so",
    "subtitles by",
    "translated by",
    "subscribe",
    "like and subscribe",
    "mbc",
    "silence",
    "silence.",
    "okay thank you",
    "watching",
    "please subscribe",
  ];
  if (hallucinations.includes(normalized)) {
    return "";
  }

  return cleaned;
}

/**
 * POST /api/interview/stt
 * Transcribes an audio segment using Groq Whisper Large V3.
 */
router.post("/stt", authMiddleware, upload.single("audio"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length < 500) {
      return res.json({ success: true, transcript: "", message: "Audio chunk too small or empty" });
    }

    const apiKey = getGroqKey();
    if (!apiKey) {
      console.warn("[STT] No Groq API key configured for STT.");
      return res.status(503).json({
        success: false,
        error: "STT_NOT_CONFIGURED",
        message: "Speech-to-text service is not configured on the server.",
      });
    }

    // Determine mime-type and filename extension
    const mimeType = req.file.mimetype || "audio/webm";
    let ext = "webm";
    if (mimeType.includes("wav")) ext = "wav";
    else if (mimeType.includes("ogg")) ext = "ogg";
    else if (mimeType.includes("mp4") || mimeType.includes("m4a")) ext = "m4a";
    else if (mimeType.includes("mp3")) ext = "mp3";

    const fileName = `speech_${Date.now()}.${ext}`;

    // Construct FormData for Groq / OpenAI transcription endpoint
    const formData = new FormData();
    const audioBlob = new Blob([req.file.buffer], { type: mimeType });
    formData.append("file", audioBlob, fileName);
    formData.append("model", "whisper-large-v3");
    formData.append("temperature", "0.0");
    formData.append("language", "en");
    formData.append("prompt", TECH_PROMPT);
    formData.append("response_format", "json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const groqRes = await fetch(GROQ_STT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      console.error("[STT] Groq transcription error:", groqRes.status, errText);

      // Fallback to whisper-large-v3-turbo if whisper-large-v3 hit rate-limit or model error
      if (groqRes.status === 400 || groqRes.status === 404) {
        const fallbackFormData = new FormData();
        fallbackFormData.append("file", audioBlob, fileName);
        fallbackFormData.append("model", "whisper-large-v3-turbo");
        fallbackFormData.append("temperature", "0.0");
        fallbackFormData.append("language", "en");
        fallbackFormData.append("prompt", TECH_PROMPT);

        const fallbackRes = await fetch(GROQ_STT_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: fallbackFormData,
        });

        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const transcript = conservativeFormat(fallbackData?.text || "");
          return res.json({ success: true, transcript, raw: fallbackData?.text || "" });
        }
      }

      return res.status(502).json({
        success: false,
        error: "STT_PROVIDER_ERROR",
        message: "Speech recognition provider failed to process audio.",
      });
    }

    const data = await groqRes.json();
    const rawText = (data?.text || "").trim();
    const formattedTranscript = conservativeFormat(rawText);

    return res.json({
      success: true,
      transcript: formattedTranscript,
      raw: rawText,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("[STT] Request timed out.");
      return res.status(504).json({ success: false, error: "STT_TIMEOUT", message: "Speech recognition timed out." });
    }
    console.error("[STT] Unexpected error:", error.message);
    return res.status(500).json({ success: false, error: "STT_INTERNAL_ERROR", message: error.message });
  }
});

export default router;
