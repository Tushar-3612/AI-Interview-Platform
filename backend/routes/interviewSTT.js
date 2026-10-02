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
const BASE_TECH_PROMPT =
  "SQL, NoSQL, MySQL, PostgreSQL, MongoDB, SQLite, JavaScript, TypeScript, React, React.js, Node, Node.js, Express, Express.js, REST API, JSON, JWT, Python, Java, C++, OOP, API, Docker, Kubernetes, AWS, Machine Learning, Deep Learning, Neural Network, Random Forest, XGBoost, Linear Regression, Logistic Regression, Null Hypothesis, Alternative Hypothesis, Primary Key, Foreign Key.";

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
    { pattern: /\bpython\b/gi, replacement: "Python" },
    { pattern: /\bmongodb\b/gi, replacement: "MongoDB" },
    { pattern: /\bpostgresql\b/gi, replacement: "PostgreSQL" },
    { pattern: /\bpostgres\b/gi, replacement: "PostgreSQL" },
    { pattern: /\bmysql\b/gi, replacement: "MySQL" },
    { pattern: /\bsqlite\b/gi, replacement: "SQLite" },
    { pattern: /\bsql\b/gi, replacement: "SQL" },
    { pattern: /\bnosql\b/gi, replacement: "NoSQL" },
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
    { pattern: /\boops\b/gi, replacement: "OOP" },
    { pattern: /\bnull\s*hypothesis\b/gi, replacement: "null hypothesis" },
    { pattern: /\balternative\s*hypothesis\b/gi, replacement: "alternative hypothesis" },
    { pattern: /\bprimary\s*key\b/gi, replacement: "primary key" },
    { pattern: /\bforeign\s*key\b/gi, replacement: "foreign key" },
    { pattern: /\bmachine\s*learning\b/gi, replacement: "machine learning" },
    { pattern: /\bdeep\s*learning\b/gi, replacement: "deep learning" },
    { pattern: /\bneural\s*network(s)?\b/gi, replacement: "neural network$1" },
    { pattern: /\brandom\s*forest\b/gi, replacement: "random forest" },
    { pattern: /\blinear\s*regression\b/gi, replacement: "linear regression" },
    { pattern: /\blogistic\s*regression\b/gi, replacement: "logistic regression" },
    { pattern: /\bxgboost\b/gi, replacement: "XGBoost" },
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
 * Transcribes an audio segment using Groq Whisper Large V3 with VAD and confidence evaluation.
 */
router.post("/stt", authMiddleware, upload.single("audio"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length < 500) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[VAD] Rejected empty or sub-500 byte audio buffer.");
      }
      return res.json({ success: true, transcript: "", confidence: 0, message: "Audio chunk too small or empty" });
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

    // Extract contextual prompts from request body if available
    const questionContext = req.body?.questionContext ? String(req.body.questionContext).slice(0, 150) : "";
    const topic = req.body?.topic ? String(req.body.topic).slice(0, 50) : "";
    const contextPrompt = [BASE_TECH_PROMPT, topic, questionContext].filter(Boolean).join(". ");
    const language = req.body?.language || "en";

    if (process.env.NODE_ENV !== "production") {
      console.log(`[STT] Processing audio buffer (${req.file.buffer.length} bytes, format: ${mimeType}, lang: ${language})`);
      if (questionContext) {
        console.log(`[CONTEXT CORRECTION] Question context provided: "${questionContext.slice(0, 60)}..."`);
      }
    }

    // Construct FormData for Groq / OpenAI transcription endpoint
    const formData = new FormData();
    const audioBlob = new Blob([req.file.buffer], { type: mimeType });
    formData.append("file", audioBlob, fileName);
    formData.append("model", "whisper-large-v3");
    formData.append("temperature", "0.0");
    formData.append("language", language);
    formData.append("prompt", contextPrompt);
    formData.append("response_format", "verbose_json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

    let groqRes = await fetch(GROQ_STT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Fallback to whisper-large-v3-turbo if rate limited or model error
    if (!groqRes.ok && (groqRes.status === 400 || groqRes.status === 404)) {
      console.warn(`[STT] whisper-large-v3 returned ${groqRes.status}. Retrying with whisper-large-v3-turbo...`);
      const fallbackFormData = new FormData();
      fallbackFormData.append("file", audioBlob, fileName);
      fallbackFormData.append("model", "whisper-large-v3-turbo");
      fallbackFormData.append("temperature", "0.0");
      fallbackFormData.append("language", language);
      fallbackFormData.append("prompt", contextPrompt);
      fallbackFormData.append("response_format", "verbose_json");

      groqRes = await fetch(GROQ_STT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fallbackFormData,
      });
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      console.error("[STT] Groq transcription error:", groqRes.status, errText);
      return res.status(502).json({
        success: false,
        error: "STT_PROVIDER_ERROR",
        message: "Speech recognition provider failed to process audio.",
      });
    }

    const data = await groqRes.json();
    const rawText = (data?.text || "").trim();

    // VAD silence detection via Whisper verbose_json segments
    if (data?.segments && Array.isArray(data.segments) && data.segments.length > 0) {
      const allSilence = data.segments.every((s) => (s.no_speech_prob || 0) > 0.75);
      if (allSilence) {
        if (process.env.NODE_ENV !== "production") {
          console.log("[VAD] Whisper silence detected (high no_speech_prob). Discarding chunk.");
        }
        return res.json({
          success: true,
          transcript: "",
          confidence: 0,
          language: data.language || language,
          raw: "",
        });
      }
    }

    // Confidence calculation from average log probabilities
    let confidence = 0.92;
    if (data?.segments && Array.isArray(data.segments) && data.segments.length > 0) {
      const sumLogProbs = data.segments.reduce((acc, seg) => acc + (seg.avg_logprob || 0), 0);
      const meanLogProb = sumLogProbs / data.segments.length;
      confidence = Math.min(1.0, Math.max(0.1, Math.round(Math.exp(meanLogProb) * 100) / 100));
    }

    const formattedTranscript = conservativeFormat(rawText);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[CONFIDENCE] Estimated transcript confidence: ${confidence}`);
      console.log(`[FINAL TRANSCRIPT] Result: "${formattedTranscript}"`);
    }

    return res.json({
      success: true,
      transcript: formattedTranscript,
      confidence,
      language: data?.language || language,
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
