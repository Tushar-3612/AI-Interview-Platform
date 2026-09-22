import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import dotenv from "dotenv";
import crypto from "crypto";
import { AIGateway } from "./aiReliability/aiGateway.js";
import { AIJsonRepair } from "./aiReliability/aiJsonRepair.js";

dotenv.config();

/**
 * ── PHASE 1: RAW RESUME TEXT CLEANING & DE-DUPLICATION ──
 */

export function computeTextHash(text) {
  if (!text || typeof text !== "string") return "";
  return crypto.createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

export function normalizeTextWhitespace(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Targeted cleaning of known PDF icon font corruption patterns without deleting legitimate characters/symbols
 */
export function cleanPDFEncodingArtifacts(text) {
  if (!text || typeof text !== "string") return "";

  // 1. CRLF to LF, strip null bytes and non-printable control characters
  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\uFFFD/g, "");

  // 2. Normalize Unicode NFC
  try {
    cleaned = cleaned.normalize("NFC");
  } catch (_) {}

  // 3. Targeted icon font artifact cleaning at line starts / delimiter boundaries
  cleaned = cleaned
    .replace(/(?:^|[\s|])ƒ\s*(?=\+?\d)/g, " ")
    .replace(/(?:^|[\s|])ï\s*(?=[A-Z])/g, " ")
    .replace(/(?:^|[\s|])§\s*(?=[A-Z0-9])/gi, " ")
    .replace(/(?:^|[\s|])€\s*(?=[a-z0-9.-]+\.[a-z]{2,})/gi, " ");

  return cleaned;
}

/**
 * Generic section header detector matching any common resume section title format
 */
export function isGenericSectionHeader(line) {
  if (!line || typeof line !== "string") return false;
  const l = line.trim();
  if (l.length === 0 || l.length > 55) return false;
  if (/^[•\-*–▪►\d]/i.test(l)) return false; // Bullet or numbered list item
  if (/@|\.com|\+?\d{8,}/i.test(l)) return false; // Contact info

  const sectionKeywords = /^(?:projects|personal projects|key projects|academic projects|technical projects|featured projects|project details|projects & experience|experience|work experience|employment|professional experience|work history|career history|skills|technical skills|core competencies|expertise|technical expertise|skills & tools|education|academic background|qualifications|certifications|certificates|licenses|achievements|honors|awards|summary|profile|career objective|professional summary|executive summary|publications|relevant coursework|leadership|activities|declaration|languages|interests)\b/i;

  if (sectionKeywords.test(l)) return true;
  if (l.endsWith(":") && l.length < 40 && !l.includes("http")) return true;
  if (/^[A-Z\s&/\-]{3,40}$/.test(l) && !/\d/.test(l)) return true;

  return false;
}

/**
 * Remove duplicate lines, repeated page header/footers, standalone page numbers conservatively.
 * Returns { text, duplicateLinesRemoved, repeatedBlocksRemoved, cleaningConfidence }
 */
export function cleanPDFTextArtifacts(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return {
      text: "",
      duplicateLinesRemoved: 0,
      repeatedBlocksRemoved: 0,
      cleaningConfidence: "high",
    };
  }

  const sanitizedText = cleanPDFEncodingArtifacts(rawText);
  const lines = sanitizedText.split("\n").map((l) => l.trim());

  let duplicateLinesRemoved = 0;
  let repeatedBlocksRemoved = 0;
  let cleaningConfidence = "high";

  // First pass: identify standalone page numbers and count line occurrences across pages
  const lineCounts = new Map();
  const pageNumRegex = /^\s*(?:Page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+)\s*$/i;
  const headerWithPageNumRegex = /.*[-|]\s*Page\s+\d+(\s+of\s+\d+)?\s*$/i;

  for (const line of lines) {
    if (!line) continue;
    const isSectionHeader = isGenericSectionHeader(line);
    const isBullet = /^[•\-*–▪►\d]/i.test(line);

    if (line.length >= 4 && line.length < 90 && !isSectionHeader && !isBullet) {
      const lower = line.toLowerCase();
      lineCounts.set(lower, (lineCounts.get(lower) || 0) + 1);
    }
  }

  const cleanedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== "") {
        cleanedLines.push("");
      }
      continue;
    }

    // 1. Standalone Page Number or Header ending with Page X of Y removal
    if (pageNumRegex.test(line) || headerWithPageNumRegex.test(line)) {
      repeatedBlocksRemoved++;
      continue;
    }

    // 2. Repeated Header/Footer removal (>= 2 occurrences across multi-page document for non-bullet, non-section header lines)
    const lower = line.toLowerCase();
    const isSectionHeader = isGenericSectionHeader(line);
    const isBullet = /^[•\-*–▪►]/i.test(line);
    const isContactLine = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(line);

    if (!isSectionHeader && !isBullet && !isContactLine && (lineCounts.get(lower) || 0) >= 2) {
      repeatedBlocksRemoved++;
      continue;
    }

    // 3. Exact consecutive duplicate line removal
    if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === line) {
      duplicateLinesRemoved++;
      continue;
    }

    cleanedLines.push(line);
  }

  const normalizedResult = normalizeTextWhitespace(cleanedLines.join("\n"));

  return {
    text: normalizedResult,
    duplicateLinesRemoved,
    repeatedBlocksRemoved,
    cleaningConfidence,
  };
}

export async function extractResumeText(buffer, mimeType = "application/pdf", fileName = "resume") {
  const warnings = [];
  let rawText = "";
  let sourceType = "pdf";
  let layoutConfidence = "high";

  if (!buffer || !(buffer instanceof Buffer || buffer instanceof Uint8Array)) {
    return {
      text: "",
      rawText: "",
      metadata: {
        sourceType: "unknown",
        extractionSuccess: false,
        characterCount: 0,
        wordCount: 0,
        lineCount: 0,
        normalizedCharacterCount: 0,
        normalizedWordCount: 0,
        normalizedLineCount: 0,
        duplicateLinesRemoved: 0,
        repeatedBlocksRemoved: 0,
        layoutConfidence: "low",
        textCleaningConfidence: "low",
        detectedWarnings: ["Invalid or empty file buffer provided."],
        extractionWarnings: ["Invalid or empty file buffer provided."],
        normalizedTextHash: "",
      },
    };
  }

  const headerHex = buffer.slice(0, 4).toString("ascii");
  const isPdf = headerHex.includes("%PDF") || (mimeType && mimeType.includes("pdf"));
  const isDocx = headerHex.startsWith("PK") || (mimeType && (mimeType.includes("wordprocessingml") || mimeType.includes("docx")));

  if (isPdf) {
    sourceType = "pdf";
    try {
      const uint8 = new Uint8Array(buffer);

      // PDF text extraction with timeout protection (10000ms)
      const pdfPromise = (async () => {
        const loadingTask = pdfjsLib.getDocument({ data: uint8 });
        const pdf = await loadingTask.promise;
        let pdfText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();

          if (!content.items || content.items.length === 0) continue;

          // Process items with X/Y positioning
          const items = content.items
            .filter((item) => item.str && item.str.trim())
            .map((item) => ({
              str: item.str,
              x: item.transform ? item.transform[4] : 0,
              y: item.transform ? item.transform[5] : 0,
              width: item.width || 0,
              height: item.height || 0,
            }));

          if (items.length === 0) continue;

          // Detect potential 2-column layout by examining X coordinate distribution
          const xCoords = items.map((it) => it.x);
          const minX = Math.min(...xCoords);
          const maxX = Math.max(...xCoords);
          const pageWidth = maxX - minX;

          const col1Items = items.filter((it) => it.x < minX + pageWidth * 0.45);
          const col2Items = items.filter((it) => it.x >= minX + pageWidth * 0.55);

          const isTwoColumn =
            pageWidth > 200 &&
            col1Items.length > 5 &&
            col2Items.length > 5 &&
            col1Items.length + col2Items.length >= items.length * 0.8;

          let pageLines = [];

          if (isTwoColumn) {
            layoutConfidence = "medium";
            const sortItems = (arr) => {
              arr.sort((a, b) => b.y - a.y || a.x - b.x);
              let lineStr = "";
              let lastY = null;
              const res = [];
              for (const item of arr) {
                if (lastY !== null && Math.abs(item.y - lastY) > 5) {
                  if (lineStr.trim()) res.push(lineStr.trim());
                  lineStr = "";
                }
                lineStr += item.str + " ";
                lastY = item.y;
              }
              if (lineStr.trim()) res.push(lineStr.trim());
              return res;
            };

            pageLines = [...sortItems(col1Items), "", ...sortItems(col2Items)];
          } else {
            // Standard layout: Sort top-to-bottom (y descending), left-to-right (x ascending)
            items.sort((a, b) => b.y - a.y || a.x - b.x);
            let lineStr = "";
            let lastY = null;

            for (const item of items) {
              if (lastY !== null && Math.abs(item.y - lastY) > 5) {
                if (lineStr.trim()) pageLines.push(lineStr.trim());
                lineStr = "";
              }
              lineStr += item.str + " ";
              lastY = item.y;
            }
            if (lineStr.trim()) pageLines.push(lineStr.trim());
          }

          pdfText += pageLines.join("\n") + "\n\n";
        }
        return pdfText;
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("PDF extraction timed out after 10000ms")), 10000)
      );

      rawText = await Promise.race([pdfPromise, timeoutPromise]);
    } catch (err) {
      warnings.push(`PDF text extraction warning: ${err.message}`);
      layoutConfidence = "low";
    }
  } else if (isDocx) {
    sourceType = "docx";
    try {
      const docxPromise = (async () => {
        const result = await mammoth.extractRawText({ buffer });
        if (result.messages && result.messages.length > 0) {
          result.messages.forEach((m) => warnings.push(`DOCX warning: ${m.message}`));
        }
        return result.value || "";
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("DOCX extraction timed out after 10000ms")), 10000)
      );

      rawText = await Promise.race([docxPromise, timeoutPromise]);
    } catch (err) {
      warnings.push(`DOCX text extraction error: ${err.message}`);
      layoutConfidence = "low";
    }
  } else {
    warnings.push("Unsupported file format. Only PDF and DOCX files are supported.");
    layoutConfidence = "low";
  }

  const rawCharacterCount = rawText.length;
  const rawWordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  const rawLineCount = rawText.split("\n").filter(Boolean).length;

  const artifactResult = cleanPDFTextArtifacts(rawText);
  const cleanedText = artifactResult.text;

  const normalizedCharacterCount = cleanedText.length;
  const normalizedWordCount = cleanedText.trim() ? cleanedText.trim().split(/\s+/).length : 0;
  const normalizedLineCount = cleanedText.split("\n").filter(Boolean).length;
  const normalizedTextHash = computeTextHash(cleanedText);

  let extractionSuccess = true;

  if (rawCharacterCount === 0 || normalizedCharacterCount === 0) {
    extractionSuccess = false;
    warnings.push("Extracted text is empty. The document may be scanned, image-only, password-protected, or corrupted.");
  } else if (normalizedCharacterCount < 80) {
    const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(cleanedText);
    const hasPhone = /\+?\d[\d\s\-]{8,}\d/.test(cleanedText);
    const hasKeywords = /skills|projects|education|experience|summary|objective/i.test(cleanedText);

    if (!hasEmail && !hasPhone && !hasKeywords) {
      extractionSuccess = false;
      warnings.push("Extracted text is very short (< 80 characters) and lacks recognizable resume signals.");
    } else {
      warnings.push("Extracted text is short (< 80 characters) but contains valid resume signals.");
    }
  }

  if (process.env.NODE_ENV === "production") {
    console.log(`[RESUME EXTRACT] File: ${fileName}, Type: ${sourceType}, Raw Chars/Lines: ${rawCharacterCount}/${rawLineCount}, Normalized Chars/Lines: ${normalizedCharacterCount}/${normalizedLineCount}, Duplicates Removed: ${artifactResult.duplicateLinesRemoved}, Blocks Removed: ${artifactResult.repeatedBlocksRemoved}, Layout Conf: ${layoutConfidence}`);
  } else {
    console.log(`\n[RESUME EXTRACT DEV] File: ${fileName} | Type: ${sourceType}`);
    console.log(`[RESUME EXTRACT DEV] Raw Stats: ${rawCharacterCount} chars, ${rawWordCount} words, ${rawLineCount} lines`);
    console.log(`[RESUME EXTRACT DEV] Normalized Stats: ${normalizedCharacterCount} chars, ${normalizedWordCount} words, ${normalizedLineCount} lines`);
    console.log(`[RESUME EXTRACT DEV] Deduplication: ${artifactResult.duplicateLinesRemoved} duplicate lines, ${artifactResult.repeatedBlocksRemoved} repeated blocks removed`);
    console.log(`[RESUME EXTRACT DEV] Confidence: Layout: ${layoutConfidence}, Cleaning: ${artifactResult.cleaningConfidence}`);
    console.log(`[RESUME EXTRACT DEV] Preview (first 300 chars):\n"""\n${cleanedText.slice(0, 300)}\n"""\n`);
  }

  return {
    text: cleanedText,
    rawText,
    metadata: {
      sourceType,
      extractionSuccess,
      characterCount: rawCharacterCount,
      wordCount: rawWordCount,
      lineCount: rawLineCount,
      normalizedCharacterCount,
      normalizedWordCount,
      normalizedLineCount,
      duplicateLinesRemoved: artifactResult.duplicateLinesRemoved,
      repeatedBlocksRemoved: artifactResult.repeatedBlocksRemoved,
      layoutConfidence,
      textCleaningConfidence: artifactResult.cleaningConfidence,
      detectedWarnings: warnings,
      extractionWarnings: warnings,
      normalizedTextHash,
    },
  };
}

export async function extractPDFText(buffer) {
  const result = await extractResumeText(buffer, "application/pdf");
  return result.text;
}

/**
 * ── CANONICAL SKILL MAP & ALIASES ──
 */
const CANONICAL_SKILL_MAP = {
  react: "React.js",
  "react.js": "React.js",
  reactjs: "React.js",
  node: "Node.js",
  "node.js": "Node.js",
  nodejs: "Node.js",
  express: "Express.js",
  "express.js": "Express.js",
  expressjs: "Express.js",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  py: "Python",
  python: "Python",
  cpp: "C++",
  "c++": "C++",
  c: "C",
  "c#": "C#",
  csharp: "C#",
  golang: "Go",
  go: "Go",
  "scikit-learn": "Scikit-learn",
  scikitlearn: "Scikit-learn",
  sklearn: "Scikit-learn",
  tensorflow: "TensorFlow",
  tf: "TensorFlow",
  keras: "Keras",
  pytorch: "PyTorch",
  torch: "PyTorch",
  powerbi: "Power BI",
  "power bi": "Power BI",
  tableau: "Tableau",
  xgboost: "XGBoost",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  mongo: "MongoDB",
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  spring: "Spring Boot",
  springboot: "Spring Boot",
  "spring boot": "Spring Boot",
  docker: "Docker",
  kubernetes: "Kubernetes",
  k8s: "Kubernetes",
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  git: "Git",
  github: "GitHub",
  vscode: "VS Code",
  "vs code": "VS Code",
  pandas: "Pandas",
  numpy: "NumPy",
  matplotlib: "Matplotlib",
  seaborn: "Seaborn",
  html: "HTML",
  html5: "HTML",
  css: "CSS",
  css3: "CSS",
  tailwind: "Tailwind CSS",
  tailwindcss: "Tailwind CSS",
  bootstrap: "Bootstrap",
  sql: "SQL",
  nosql: "NoSQL",
  redis: "Redis",
  graphql: "GraphQL",
  "rest api": "REST APIs",
  "restful api": "REST APIs",
  "rest apis": "REST APIs",
};

export function normalizeSkill(skill) {
  if (!skill || typeof skill !== "string") return "";
  const trimmed = skill.trim();
  const lower = trimmed.toLowerCase();
  if (CANONICAL_SKILL_MAP[lower]) {
    return CANONICAL_SKILL_MAP[lower];
  }
  return trimmed;
}

export function normalizeSkills(skillsList) {
  if (!Array.isArray(skillsList)) return [];
  const seen = new Set();
  const result = [];

  for (const s of skillsList) {
    const norm = normalizeSkill(s);
    if (norm && !seen.has(norm.toLowerCase())) {
      seen.add(norm.toLowerCase());
      result.push(norm);
    }
  }
  return result;
}

/**
 * ── PHASE 2: CANONICAL SECTION DETECTION & CONTACT INFO ──
 */
export function extractContactInfo(text) {
  if (!text) return { fullName: "", email: "", phone: "", linkedin: "", github: "", portfolio: "", location: "" };

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0].toLowerCase().trim() : "";

  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : "";

  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  const linkedin = linkedinMatch ? (linkedinMatch[0].startsWith("http") ? linkedinMatch[0] : `https://${linkedinMatch[0]}`) : "";

  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);
  const github = githubMatch ? (githubMatch[0].startsWith("http") ? githubMatch[0] : `https://${githubMatch[0]}`) : "";

  const portfolioMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:vercels?\.app|netlify\.app|github\.io|dev|me|io|com)/i);
  const portfolio = portfolioMatch && !portfolioMatch[0].includes("github.com") && !portfolioMatch[0].includes("linkedin.com")
    ? (portfolioMatch[0].startsWith("http") ? portfolioMatch[0] : `https://${portfolioMatch[0]}`)
    : "";

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let fullName = "";
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (
      line.length > 2 &&
      line.length < 50 &&
      !/@/.test(line) &&
      !/\d/.test(line) &&
      !/resume|curriculum|cv|profile|contact|phone|email/i.test(line)
    ) {
      fullName = line;
      break;
    }
  }

  return { fullName, email, phone, linkedin, github, portfolio, location: "" };
}

/**
 * ── PHASE 2: STRICT PROJECT SECTION ISOLATION ENGINE ──
 */

export function isolateProjectSection(text) {
  if (!text || typeof text !== "string") {
    return {
      projectSectionStart: -1,
      projectSectionEnd: -1,
      projectSectionText: "",
      sectionDetectionConfidence: "none",
    };
  }

  const normalized = normalizeTextWhitespace(text);
  const lines = normalized.split("\n");

  const startKeywords = /^(?:projects|personal projects|key projects|major projects|academic projects|technical projects|featured projects|project details|projects & experience|project experience|projects worked on|selected projects|project work)\b[:\-]*$/i;
  const startKeywordsInline = /(?:^|\n)\s*(?:projects|personal projects|key projects|major projects|academic projects|technical projects|featured projects|project details|projects & experience|project experience|projects worked on|selected projects|project work)\b[:\-]*\s*/i;

  const stopKeywords = /^(?:skills|technical skills|core competencies|expertise|technical expertise|skills & tools|experience|work experience|employment|professional experience|work history|career history|internships|education|academic background|qualifications|certifications|certificates|licenses|achievements|honors|awards|summary|profile|career objective|professional summary|executive summary|publications|positions of responsibility|extracurricular activities|declaration|languages|interests)\b[:\-]*$/i;

  let startLineIdx = -1;
  let endLineIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (startLineIdx === -1) {
      if (startKeywords.test(line)) {
        startLineIdx = i + 1;
      }
    } else {
      if (stopKeywords.test(line) || isGenericSectionHeader(line)) {
        endLineIdx = i;
        break;
      }
    }
  }

  // Fallback: search using inline match if line-by-line heading search didn't fire
  if (startLineIdx === -1) {
    const match = normalized.match(startKeywordsInline);
    if (match) {
      const matchPos = match.index + match[0].length;
      const textAfter = normalized.slice(matchPos);
      const stopMatch = textAfter.match(/(?:\n|^)\s*(?:skills|technical skills|experience|work experience|education|certifications|achievements|summary|career objective|publications|declaration)\b[:\-]*\s*/i);

      const sectionText = stopMatch ? textAfter.slice(0, stopMatch.index).trim() : textAfter.trim();
      return {
        projectSectionStart: matchPos,
        projectSectionEnd: matchPos + (stopMatch ? stopMatch.index : textAfter.length),
        projectSectionText: sectionText,
        sectionDetectionConfidence: sectionText ? "high" : "none",
      };
    }
  }

  if (startLineIdx === -1 || startLineIdx >= lines.length) {
    return {
      projectSectionStart: -1,
      projectSectionEnd: -1,
      projectSectionText: "",
      sectionDetectionConfidence: "none",
    };
  }

  const sectionLines = lines.slice(startLineIdx, endLineIdx);
  const sectionText = sectionLines.join("\n").trim();

  return {
    projectSectionStart: startLineIdx,
    projectSectionEnd: endLineIdx,
    projectSectionText: sectionText,
    sectionDetectionConfidence: sectionText ? "high" : "none",
  };
}

export function extractSummaryFromText(text) {
  if (!text || typeof text !== "string") return "";
  const match = text.match(/(?:^|\n)\s*(?:Career Objective|Professional Summary|Executive Summary|Profile Summary|Summary|Objective|About Me|Profile)\b[:\-]*([\s\S]*?)(?=(?:\n\s*(?:Technical Skills|Skills|Core Competencies|Education|Academic Background|Projects|Personal Projects|Experience|Work Experience|Certifications|Achievements|Publications|Declaration|Languages|Interests)\b[:\-]*)|$)/i);
  if (match && match[1]) {
    const summary = match[1].trim().replace(/\n+/g, " ");
    if (summary.length >= 20) return summary;
  }
  return "";
}

/**
 * Helper to test whether a term is a recognized programming language, framework, tool, or database
 */
export function isKnownSkill(term) {
  if (!term || typeof term !== "string") return false;
  const lower = term.trim().toLowerCase();
  if (CANONICAL_SKILL_MAP[lower]) return true;

  const commonTechRegex = /^(?:react|react\.js|reactjs|next|next\.js|nextjs|vue|vue\.js|angular|svelte|node|node\.js|nodejs|express|express\.js|javascript|js|typescript|ts|python|py|java|c\+\+|cpp|c#|golang|go|rust|kotlin|swift|php|ruby|r|scala|dart|html|html5|css|css3|sql|nosql|mongodb|mongo|mysql|postgresql|postgres|sqlite|redis|cassandra|oracle|dynamodb|firebase|supabase|aws|azure|gcp|docker|kubernetes|k8s|git|github|gitlab|postman|figma|jira|linux|nginx|apache|kafka|flink|spark|hadoop|tableau|powerbi|power bi|pandas|numpy|matplotlib|seaborn|scipy|scikit-learn|sklearn|tensorflow|tf|keras|pytorch|torch|opencv|nltk|spacy|transformers|bert|llm|hugging face|openai|openai api|fastapi|django|flask|spring|spring boot|tailwind|tailwindcss|bootstrap|redux|axios|prisma|mongoose|graphql|rest apis?|gemini api|jwt|stripe|vault|terraform|ansible|jenkins|ebpf|ros|webrtc|whisper api|elasticsearch|kibana|envoy|grpc|timescaledb|raft|raft consensus|fix protocol|kernel tuning|csv|phpmailer)$/i;

  return commonTechRegex.test(lower);
}

function wordsCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Checks whether a line is purely a tech stack listing (e.g. 'React.js', 'React.js | Node.js | Express.js', 'MongoDB JWT Tailwind CSS')
 */
export function isTechnologyOnlyLine(line) {
  if (!line || typeof line !== "string") return false;
  const l = line.trim();
  if (!l) return false;

  // Prefix check (e.g. "Tech Stack: ...", "Technologies used: ...")
  if (/^(?:tech stack|technologies|stack|technologies used|tools used|built with|built using)\s*[:\-]/i.test(l)) {
    return true;
  }

  // Single technology check (e.g. "React.js", "Node.js", "MongoDB", "Tailwind CSS", "JWT", "REST APIs", "Python")
  if (isKnownSkill(l)) {
    return true;
  }

  // Multi-technology list separated by standard delimiters (|, ,, /, -, ;, •)
  const delimiterPattern = /[|,;/•–—]/;
  if (delimiterPattern.test(l)) {
    const segments = l.split(/[|,;/•–—]/).map((s) => s.trim()).filter(Boolean);
    if (segments.length >= 2) {
      let knownCount = 0;
      for (const seg of segments) {
        if (isKnownSkill(seg)) {
          knownCount++;
        }
      }
      if (knownCount / segments.length >= 0.5) {
        return true;
      }
    }
  }

  // Space-separated technologies check (e.g. "MongoDB JWT Tailwind CSS" or "React Node Express MongoDB")
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 8) {
    let knownWords = 0;
    for (const w of words) {
      if (isKnownSkill(w)) knownWords++;
    }
    if (knownWords / words.length >= 0.6) {
      return true;
    }
  }

  return false;
}

export const isTechStackOnlyLine = isTechnologyOnlyLine;

/**
 * Identifies sentence fragments, continuation phrases, and generic single words that are NOT project titles
 */
export function isGenericContentFragment(line) {
  if (!line || typeof line !== "string") return false;
  const l = line.trim();
  if (l.length === 0) return true;

  // Check 1: Starts with a lowercase letter
  if (/^[a-z]/.test(l)) return true;

  // Check 2: Single generic words
  const singleWord = l.toLowerCase();
  const genericSingleWords = new Set([
    "components", "workflows", "features", "usage", "dashboards", "dashboard",
    "management", "evaluation", "details", "overview", "architecture", "technologies",
    "skills", "experience", "responsibilities", "system", "portal", "application",
    "service", "services", "backend", "frontend", "api", "apis", "project", "projects",
    "implementation", "analytics", "tracking", "records", "database", "interface",
    "website", "platform", "development", "solution", "solutions"
  ]);

  if (wordsCount(l) === 1 && genericSingleWords.has(singleWord)) {
    return true;
  }

  // Check 3: Truncated word fragment (e.g., "formance evaluation", "ment system", "ing platform")
  if (/^(?:formance|ment|tion|sion|ance|ence|able|ible|ing)\b/i.test(l)) {
    return true;
  }

  // Check 4: Fragment starting with continuation preposition / conjunction / description phrase
  if (/^(?:based on|using|with|for|and|in|on|at|by|to|from|as|into|including|serving|usage|components|workflows|features|details|overview|architecture|technologies|skills|experience|responsibilities|evaluation|dashboards|performance)\b/i.test(l)) {
    return true;
  }

  // Check 5: Ends with sentence continuation (e.g. trailing comma or hyphen)
  if (/[,–\-]$/.test(l) && !/^[A-Z0-9\s]+$/.test(l)) {
    return true;
  }

  return false;
}

/**
 * Validates whether a line is a genuine project title candidate
 */
export function isValidProjectTitle(line, isFirstLineInSection = false) {
  if (!line || typeof line !== "string") return false;
  const l = line.trim();

  // Minimum length 4 chars, max 95 chars
  if (l.length < 4 || l.length > 95) return false;

  // Negative 1: Cannot start with bullet character (unless '1. Project Title' format)
  if (/^[•\-*–▪►]/i.test(l)) return false;

  // Negative 2: Cannot be a technology-only line
  if (isTechnologyOnlyLine(l)) return false;

  // Negative 3: Cannot be a generic content fragment or sentence continuation
  if (isGenericContentFragment(l)) return false;

  // Negative 4: Cannot be an action-verb implementation sentence (e.g. 'Built an end-to-end dashboard', 'Implemented OAuth2')
  const actionVerbSentenceRegex = /^(?:developed|built|implemented|integrated|created|designed|deployed|added|engineered|architected|scaled|led|constructed|maintained|configured|optimized|retrieved|analyzed|evaluated|managed|refactored|migrated|spearheaded|trained|fine-tuned|tested)\b\s+(?:an?|the|a|with|on|for|in|using|by|to|new|custom|scalable|real-time|end-to-end|all|several|various|multiple)\b/i;
  if (actionVerbSentenceRegex.test(l)) return false;

  // Negative 5: Cannot be a URL or link line
  if (/^(?:https?:\/\/|live:\s*https?:|github:\s*https?:|demo:\s*https?:)/i.test(l)) return false;

  // Negative 6: Cannot be a pure date range
  if (/^\d{4}\s*[-–]\s*(?:\d{4}|present)/i.test(l)) return false;

  // Negative 7: Cannot be a pure metric line
  if (/^\d+[\d,%\s+]*\s*(?:users|visitors|requests|uptime|transactions|downloads|stars)\b/i.test(l)) return false;

  // Negative 8: Cannot be a section header
  if (isGenericSectionHeader(l)) return false;

  // Negative 9: Cannot end with sentence punctuation (. ! ;) unless it's a domain name (e.g. balvirt.com)
  if (/[.!;]$/.test(l) && !/\.(com|io|net|app|org|edu)\b/i.test(l)) return false;

  // Negative 10: Must contain at least one uppercase letter (valid project names are capitalized/titled)
  if (!/[A-Z]/.test(l)) return false;

  // Negative 11: Single generic word check
  if (wordsCount(l) === 1 && l.length < 8) return false;

  // Positive 1: Numbered title (e.g., '1. Smart Health Portal')
  if (/^\d+[\.\)]\s+[A-Z0-9]/.test(l)) return true;

  // Positive 2: Title with delimiter (e.g. "Corporate Business Website – Balvirt IT Solution" or "Smart Health Portal | React")
  if (/^[^|:–—()]+?\s*(?:[|:]|\s+[–—\-]\s+|\()\s*.+$/i.test(l)) {
    const titlePart = l.split(/[|:–—()]/)[0].trim();
    if (titlePart.length >= 4 && !isTechnologyOnlyLine(titlePart) && !isGenericContentFragment(titlePart)) {
      return true;
    }
  }

  // Positive 3: Multi-word clean title line (< 85 chars, no commas indicating lists)
  if (wordsCount(l) >= 2 && l.length < 85 && !/,/.test(l)) return true;

  return isFirstLineInSection && wordsCount(l) >= 2;
}

/**
 * ── STATE MACHINE PROJECT BLOCK EXTRACTION & DEDUPLICATION ENGINE ──
 */
export function extractProjectsFromText(text) {
  if (!text || typeof text !== "string") {
    return {
      confirmedProjects: [],
      rejectedProjectCandidates: [],
      duplicateProjectsRemoved: [],
      possibleProjects: [],
      projectWarnings: ["Empty text provided."],
    };
  }

  const isolation = isolateProjectSection(text);
  const sectionText = isolation.projectSectionText;

  if (!sectionText) {
    return {
      confirmedProjects: [],
      rejectedProjectCandidates: [],
      duplicateProjectsRemoved: [],
      possibleProjects: [],
      projectWarnings: ["No explicit Project section detected."],
    };
  }

  const lines = sectionText.split("\n").map((l) => l.trim()).filter(Boolean);
  const rawProjectBlocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBulletPoint = /^[•\-*–▪►]/i.test(line);
    const isTechLine = isTechnologyOnlyLine(line);
    const isLinkLine = /(?:https?:\/\/|live:\s*https?:|github:\s*https?:|demo:\s*https?:)/i.test(line);

    const isTitleCandidate = isValidProjectTitle(line, i === 0 && !isBulletPoint && !isTechLine);

    if (isTitleCandidate) {
      if (currentBlock) {
        rawProjectBlocks.push(currentBlock);
      }

      let projTitle = line.replace(/^\d+[\.\)]\s*/, "").trim();
      let inlineTechs = [];

      const delimiterMatch = line.match(/^([^|:–—()]+?)\s*(?:[|:]|\s+[–—\-]\s+|\()\s*(.+)$/i);
      if (delimiterMatch) {
        const candidateTitle = delimiterMatch[1].replace(/^\d+[\.\)]\s*/, "").trim();
        if (candidateTitle.length >= 4 && !isTechnologyOnlyLine(candidateTitle) && !isGenericContentFragment(candidateTitle)) {
          projTitle = candidateTitle;
        }
        const techPart = delimiterMatch[2].replace(/\)$/, "").trim();
        inlineTechs = techPart
          .split(/[,|;•/]/)
          .map((t) => normalizeSkill(t.trim()))
          .filter((t) => isKnownSkill(t));
      }

      projTitle = projTitle.replace(/^[^a-zA-Z0-9]+/, "").replace(/[^a-zA-Z0-9)]+$/, "").trim();

      currentBlock = {
        title: projTitle || "Project",
        name: projTitle || "Project",
        descriptionLines: [],
        technologies: inlineTechs,
        links: [],
        duration: null,
        role: null,
        sourceLines: [line],
      };

      const urlMatches = line.match(/https?:\/\/[^\s)]+/g);
      if (urlMatches) {
        currentBlock.links.push(...urlMatches);
      }
    } else if (currentBlock) {
      currentBlock.sourceLines.push(line);

      if (isLinkLine) {
        const urlMatches = line.match(/https?:\/\/[^\s)]+/g);
        if (urlMatches) {
          urlMatches.forEach((u) => {
            if (!currentBlock.links.includes(u)) currentBlock.links.push(u);
          });
        }
      }

      if (isTechLine) {
        const techStr = line.replace(/^(?:tech stack|technologies|technologies used|stack|tools used|built with|built using)\s*[:\-]/i, "").trim();
        const techList = techStr
          .split(/[,|;•/]/)
          .map((t) => normalizeSkill(t.trim()))
          .filter((t) => isKnownSkill(t));
        techList.forEach((t) => {
          if (!currentBlock.technologies.includes(t)) currentBlock.technologies.push(t);
        });
      } else {
        const lineClean = line.replace(/^[•\-*–▪►\s\d\.\)]+/, "").trim();
        if (lineClean) {
          currentBlock.descriptionLines.push(lineClean);
        }

        const extractedTechs = extractSkillsFromTextRegex(lineClean);
        Object.values(extractedTechs).forEach((arr) => {
          if (Array.isArray(arr)) {
            arr.forEach((t) => {
              if (!currentBlock.technologies.includes(t)) currentBlock.technologies.push(t);
            });
          }
        });
      }
    }
  }

  if (currentBlock) {
    rawProjectBlocks.push(currentBlock);
  }

  const confirmedProjects = [];
  const rejectedProjectCandidates = [];
  const duplicateProjectsRemoved = [];
  const projectWarnings = [];
  const seenFingerprints = new Set();

  for (const block of rawProjectBlocks) {
    const description = block.descriptionLines.join(" ").trim();
    const titleNorm = block.title.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (
      !block.title ||
      block.title.length < 3 ||
      isTechnologyOnlyLine(block.title) ||
      isGenericContentFragment(block.title) ||
      ["dashboard", "project", "details", "projects", "key projects", "tech stack", "technologies", "overview", "components", "workflows", "features", "implementation"].includes(titleNorm)
    ) {
      rejectedProjectCandidates.push({
        ...block,
        rejectionReason: `Title '${block.title}' is technology-only, generic fragment, or invalid.`,
      });
      continue;
    }

    if (description.length < 15 && block.technologies.length === 0 && block.links.length === 0) {
      rejectedProjectCandidates.push({
        ...block,
        rejectionReason: `Project block '${block.title}' lacks description or technology evidence.`,
      });
      continue;
    }

    const fingerprint = `${titleNorm}:${computeTextHash(description.slice(0, 100))}`;

    if (seenFingerprints.has(fingerprint) || seenFingerprints.has(titleNorm)) {
      duplicateProjectsRemoved.push({
        title: block.title,
        reason: "Identical title or description fingerprint duplicate.",
      });
      projectWarnings.push(`Duplicate project block '${block.title}' removed.`);
      continue;
    }

    seenFingerprints.add(fingerprint);
    seenFingerprints.add(titleNorm);

    let confidence = 0.95;
    if (description.length < 25 && block.technologies.length === 0) {
      confidence = 0.50;
    } else if (description.length < 25) {
      confidence = 0.75;
    }

    const projectObj = {
      title: block.title,
      name: block.title,
      description: description || block.title,
      technologies: normalizeSkills(block.technologies),
      links: block.links || [],
      duration: block.duration || null,
      role: block.role || null,
      sourceText: block.sourceLines.join("\n"),
      confidence,
      extractionMethod: "STATE_MACHINE_STRICT",
      warnings: [],
    };

    if (confidence >= 0.65) {
      confirmedProjects.push(projectObj);
    } else {
      rejectedProjectCandidates.push({
        ...projectObj,
        rejectionReason: "Low confidence score (< 0.65) or insufficient description/technology evidence.",
      });
    }
  }

  return {
    confirmedProjects,
    rejectedProjectCandidates,
    duplicateProjectsRemoved,
    possibleProjects: confirmedProjects,
    projectWarnings,
  };
}

/**
 * ── PHASE 3: CENTRAL SKILL TAXONOMY & CATEGORIES ──
 */
export const SKILL_TAXONOMY = {
  "Programming Languages": ["Python", "Java", "C++", "C#", "C", "JavaScript", "TypeScript", "SQL", "Go", "Rust", "Kotlin", "Swift", "PHP", "Ruby", "R", "Scala", "Dart"],
  "Frontend": ["React.js", "HTML", "CSS", "Tailwind CSS", "Bootstrap", "Responsive Web Design", "Vue.js", "Angular", "Svelte", "Next.js", "Redux"],
  "Backend": ["Node.js", "Express.js", "PHP", "REST APIs", "PHPMailer", "FastAPI", "Django", "Flask", "Spring Boot", "gRPC", "GraphQL", "WebSockets"],
  "Databases": ["MongoDB", "MySQL", "PostgreSQL", "SQLite", "Redis", "Cassandra", "Oracle", "DynamoDB", "Firebase", "Supabase", "TimescaleDB", "SQL/NoSQL"],
  "Cloud": ["AWS", "Azure", "GCP", "Heroku", "Vercel", "Netlify", "Railway"],
  "DevOps": ["Docker", "Kubernetes", "CI/CD", "GitHub Actions", "Jenkins", "Terraform", "Ansible", "Linux", "Nginx"],
  "Testing": ["Jest", "Cypress", "Selenium", "JUnit", "PyTest"],
  "Data Science": ["Pandas", "NumPy", "Matplotlib", "Seaborn", "SciPy", "Statsmodels", "Plotly", "Data Analysis", "EDA", "Data Visualization", "Power BI", "Tableau", "Excel"],
  "Machine Learning": ["Scikit-learn", "XGBoost", "LightGBM", "CatBoost", "Random Forest", "Decision Trees", "SVM", "KNN", "Linear Regression", "Logistic Regression", "K-Means", "PCA", "Gradient Boosting"],
  "AI / Generative AI": ["Generative AI", "Gemini API", "Prompt Engineering", "OpenAI", "OpenAI API", "LLM", "Transformers", "BERT", "Hugging Face", "AI-based Question Generation", "AI-Assisted Development"],
  "Cybersecurity": ["Cryptography", "OAuth2", "JWT", "Bcrypt", "OWASP", "Penetration Testing"],
  "Networking": ["TCP/IP", "DNS", "HTTP/HTTPS", "WebSockets", "gRPC", "Microservices Concepts"],
  "Mobile Development": ["React Native", "Flutter", "Android", "iOS"],
  "Frameworks": ["React.js", "Next.js", "Node.js", "Express.js", "FastAPI", "Django", "Flask", "Spring Boot", "Angular", "Vue.js"],
  "Libraries": ["Redux", "Axios", "Prisma", "Mongoose", "Lodash", "jQuery"],
  "Tools": ["Git", "GitHub", "GitLab", "VS Code", "Postman", "Figma", "Jira", "Jupyter", "Colab"],
  "Platforms": ["Railway", "Netlify", "Vercel", "AWS Academy", "L&T EduTech", "Udemy", "NPTEL"],
  "Architecture": ["Microservices", "System Design", "REST APIs", "Role-Based Access Control", "Role-Based Authorization", "OAuth2", "Multi-Tenant SaaS"],
  "Other Technical Skills": ["Data Structures & Algorithms", "OOP", "DBMS", "Software Engineering", "CRUD Operations"],
};

export function getSkillCategory(canonicalSkill) {
  if (!canonicalSkill || typeof canonicalSkill !== "string") return "Other Technical Skills";
  const skillLower = canonicalSkill.toLowerCase();

  for (const [category, skillsList] of Object.entries(SKILL_TAXONOMY)) {
    if (skillsList.some((s) => s.toLowerCase() === skillLower)) {
      return category;
    }
  }
  return "Other Technical Skills";
}

/**
 * ── PHASE 3: MULTI-SOURCE SKILL INTELLIGENCE & EVIDENCE MAPPING ENGINE ──
 */
export function extractSkillIntelligence(text = "", confirmedProjects = [], experience = [], certifications = [], education = []) {
  const skillEvidenceMap = new Map();
  const warnings = [];

  const addEvidence = (rawTerm, sourceType, evidenceText, projectTitle = null, experienceCompany = null) => {
    if (!rawTerm || typeof rawTerm !== "string") return;
    const canonical = normalizeSkill(rawTerm);
    if (!canonical || canonical.length < 2) return;

    // Guard against ambiguous non-tech common dictionary words
    const lower = canonical.toLowerCase();
    if (!isKnownSkill(lower) && !CANONICAL_SKILL_MAP[lower] && lower.length < 3) return;

    const normKey = lower;

    if (!skillEvidenceMap.has(normKey)) {
      skillEvidenceMap.set(normKey, {
        skill: canonical,
        normalizedSkill: normKey,
        category: getSkillCategory(canonical),
        sources: new Set(),
        evidenceCount: 0,
        evidence: [],
        relatedProjects: new Set(),
        relatedExperience: new Set(),
        confidence: 0,
        depth: "unknown",
        warnings: [],
      });
    }

    const item = skillEvidenceMap.get(normKey);
    item.sources.add(sourceType);
    item.evidenceCount++;

    const isDuplicate = item.evidence.some((e) => e.text === evidenceText && e.sourceType === sourceType && e.projectTitle === projectTitle);
    if (!isDuplicate) {
      item.evidence.push({
        text: evidenceText.trim().slice(0, 300),
        sourceType,
        projectTitle: projectTitle || null,
        experienceCompany: experienceCompany || null,
      });
    }

    if (projectTitle && !item.relatedProjects.has(projectTitle)) {
      item.relatedProjects.add(projectTitle);
    }
    if (experienceCompany && !item.relatedExperience.has(experienceCompany)) {
      item.relatedExperience.add(experienceCompany);
    }
  };

  // Source A: Explicit Skills Section
  const skillsMatch = text.match(/(?:^|\n)\s*(?:Technical Skills|Skills|Core Competencies|Technical Expertise|Programming Skills)\b[:\-]*([\s\S]*?)(?=(?:\n\s*(?:Projects|Personal Projects|Experience|Work Experience|Education|Certifications|Achievements|Summary|Career Objective|Publications)\b[:\-]*)|$)/i);
  if (skillsMatch && skillsMatch[1]) {
    const skillsText = skillsMatch[1].trim();
    const lines = skillsText.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/[:|,\-•;]/).map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        const norm = normalizeSkill(part);
        if (norm && isKnownSkill(part)) {
          addEvidence(norm, "skills_section", line);
        }
      }
    }
  }

  // Source B & C: Projects (Technologies & Descriptions)
  for (const proj of confirmedProjects) {
    const projTitle = proj.title || "Project";
    if (Array.isArray(proj.technologies)) {
      for (const tech of proj.technologies) {
        addEvidence(tech, "project_technology", `${projTitle}: ${proj.technologies.join(" | ")}`, projTitle);
      }
    }

    if (proj.description) {
      const descText = proj.description;
      const words = descText.split(/[\s,;:.()|]+/).map((w) => w.trim()).filter(Boolean);
      for (const word of words) {
        if (isKnownSkill(word)) {
          addEvidence(word, "project_description", descText.slice(0, 150), projTitle);
        }
      }
    }
  }

  // Source D: Experience Descriptions
  for (const exp of experience) {
    const company = exp.company || exp.role || "Work Experience";
    const descText = exp.description || exp.role || "";
    const words = descText.split(/[\s,;:.()|]+/).map((w) => w.trim()).filter(Boolean);
    for (const word of words) {
      if (isKnownSkill(word)) {
        addEvidence(word, "experience_description", descText.slice(0, 150), null, company);
      }
    }
  }

  // Source E: Certifications (from Section or Array)
  const certMatch = text.match(/(?:^|\n)\s*(?:Certifications|Licenses & Certifications|Certificates)\b[:\-]*([\s\S]*?)(?=(?:\n\s*(?:Projects|Personal Projects|Experience|Work Experience|Education|Skills|Achievements|Summary|Career Objective|Publications)\b[:\-]*)|$)/i);
  if (certMatch && certMatch[1]) {
    const certText = certMatch[1].trim();
    const certLines = certText.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of certLines) {
      for (const [cat, keywords] of Object.entries(SKILL_TAXONOMY)) {
        for (const kw of keywords) {
          let regex;
          if (kw === "C++") regex = /(?:^|[\s,;:(/])C\+\+(?:$|[\s,;:)/])/i;
          else if (kw === "C#") regex = /(?:^|[\s,;:(/])C#(?:$|[\s,;:)/])/i;
          else if (kw === "C") regex = /(?:^|[\s,;:(/])C(?:$|[\s,;:)/])/;
          else regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

          if (regex.test(line)) {
            addEvidence(kw, "certification", line);
          }
        }
      }
    }
  }

  if (Array.isArray(certifications)) {
    for (const cert of certifications) {
      const certStr = typeof cert === "string" ? cert : cert.name || cert.title || "";
      for (const [cat, keywords] of Object.entries(SKILL_TAXONOMY)) {
        for (const kw of keywords) {
          let regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          if (regex.test(certStr)) {
            addEvidence(kw, "certification", certStr);
          }
        }
      }
    }
  }

  // Source F: Full Text Scan Fallback for Dictionary Terms
  for (const [cat, keywords] of Object.entries(SKILL_TAXONOMY)) {
    for (const kw of keywords) {
      let regex;
      if (kw === "C++") regex = /(?:^|[\s,;:(/])C\+\+(?:$|[\s,;:)/])/i;
      else if (kw === "C#") regex = /(?:^|[\s,;:(/])C#(?:$|[\s,;:)/])/i;
      else if (kw === "C") regex = /(?:^|[\s,;:(/])C(?:$|[\s,;:)/])/;
      else regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

      if (regex.test(text)) {
        addEvidence(kw, "full_text_dictionary", kw);
      }
    }
  }

  // Compute Confidence & Depth for each skill
  const confirmedSkills = [];
  const uncertainSkills = [];
  const skillEvidenceObject = {};
  const categorizedOutput = {};

  const actionVerbRegex = /\b(?:built|developed|implemented|integrated|designed|deployed|optimized|automated|created|configured|scaled|architected|auth|jwt|microservices|pipeline)\b/i;

  for (const [normKey, record] of skillEvidenceMap.entries()) {
    const sourcesArray = Array.from(record.sources);
    const relatedProjArray = Array.from(record.relatedProjects);
    const relatedExpArray = Array.from(record.relatedExperience);

    let confidence = 0;
    if (sourcesArray.includes("skills_section")) confidence += 0.40;
    if (sourcesArray.includes("project_technology")) confidence += 0.30;
    if (sourcesArray.includes("project_description")) confidence += 0.15;
    if (sourcesArray.includes("experience_description")) confidence += 0.20;
    if (sourcesArray.includes("certification")) confidence += 0.15;
    if (sourcesArray.includes("coursework")) confidence += 0.10;
    if (record.evidenceCount > 2) confidence += 0.10;

    confidence = Math.min(1.0, Math.max(0.10, Math.round(confidence * 100) / 100));

    // Depth Estimation Logic
    let depth = "basic";
    const hasProjectTech = sourcesArray.includes("project_technology") || relatedProjArray.length > 0;
    const hasExpTech = sourcesArray.includes("experience_description") || relatedExpArray.length > 0;

    const hasActionInDesc = record.evidence.some((e) => actionVerbRegex.test(e.text));

    if (hasExpTech && (relatedProjArray.length >= 2 || hasActionInDesc)) {
      depth = "advanced";
    } else if (hasProjectTech || hasExpTech || hasActionInDesc) {
      depth = "intermediate";
    } else if (sourcesArray.includes("skills_section") && record.evidenceCount === 1) {
      depth = "basic";
    } else {
      depth = "unknown";
    }

    const finalRecord = {
      skill: record.skill,
      normalizedSkill: record.normalizedSkill,
      category: record.category,
      confidence,
      depth,
      sources: sourcesArray,
      evidenceCount: record.evidenceCount,
      evidence: record.evidence,
      relatedProjects: relatedProjArray,
      relatedExperience: relatedExpArray,
      warnings: record.warnings,
    };

    skillEvidenceObject[record.skill] = finalRecord;

    if (!categorizedOutput[record.category]) {
      categorizedOutput[record.category] = [];
    }
    if (!categorizedOutput[record.category].includes(record.skill)) {
      categorizedOutput[record.category].push(record.skill);
    }

    if (confidence >= 0.45) {
      confirmedSkills.push(finalRecord);
    } else {
      uncertainSkills.push(finalRecord);
    }
  }

  return {
    skills: Object.keys(skillEvidenceObject),
    categorizedSkills: categorizedOutput,
    skillInsights: {
      totalSkills: Object.keys(skillEvidenceObject).length,
      categorizedSkills: categorizedOutput,
      confirmedSkills,
      uncertainSkills,
      skillEvidenceMap: skillEvidenceObject,
      warnings,
    },
  };
}

export function extractSkillsFromTextRegex(text) {
  const result = extractSkillIntelligence(text, [], [], [], []);
  const oldCategories = {
    programming_languages: result.categorizedSkills["Programming Languages"] || [],
    data_science: result.categorizedSkills["Data Science"] || [],
    machine_learning: result.categorizedSkills["Machine Learning"] || [],
    deep_learning: result.categorizedSkills["AI / Generative AI"] || [],
    web_technologies: [...(result.categorizedSkills["Frontend"] || []), ...(result.categorizedSkills["Backend"] || [])],
    frameworks: result.categorizedSkills["Frameworks"] || [],
    libraries: result.categorizedSkills["Libraries"] || [],
    databases: result.categorizedSkills["Databases"] || [],
    cloud: result.categorizedSkills["Cloud"] || [],
    devops: result.categorizedSkills["DevOps"] || [],
    tools: result.categorizedSkills["Tools"] || [],
    other: result.categorizedSkills["Other Technical Skills"] || [],
  };
  return oldCategories;
}

/**
 * ── PHASE 5: EXPERIENCE / INTERNSHIP EXTRACTION ENGINE ──
 */
export function isolateExperienceSection(text) {
  if (!text || typeof text !== "string") {
    return {
      experienceSectionText: "",
      sectionDetectionConfidence: "none",
      warnings: ["No text provided"],
    };
  }

  // Put longer section titles first in alternation so "Employment History" matches as a unit
  const match = text.match(/(?:^|\n)\s*(?:Professional Experience|Employment History|Internship Experience|Industrial Training|Training Experience|Freelance Experience|Professional Engagements|Work Experience|Work History|Internships|Apprenticeship|Employment|Experience|Trainee)\b[:\-]*([\s\S]*?)(?=(?:\n\s*(?:Projects|Personal Projects|Academic Projects|Mini Projects|Major Projects|Final Year Project|Capstone Projects|College Projects|Technical Skills|Skills|Education|Certifications|Certificates|Achievements|Accomplishments|Publications|Research|Volunteering|Leadership|Declaration|Languages|Interests)\b[:\-]*)|$)/i);

  if (!match || !match[1] || !match[1].trim()) {
    return {
      experienceSectionText: "",
      sectionDetectionConfidence: "none",
      warnings: ["No experience section detected"],
    };
  }

  return {
    experienceSectionText: match[1].trim(),
    sectionDetectionConfidence: "high",
    warnings: [],
  };
}

function parseMonthYearToISO(str) {
  if (!str) return null;
  const monthMap = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };

  const monthMatch = str.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
  const yearMatch = str.match(/\b(20\d{2}|19\d{2})\b/);

  if (yearMatch && monthMatch) {
    const monthKey = monthMatch[1].toLowerCase().slice(0, 3);
    const monthNum = monthMap[monthKey] || "01";
    return `${yearMatch[1]}-${monthNum}`;
  } else if (yearMatch) {
    return yearMatch[1];
  }
  return null;
}

export function extractExperienceFromText(text) {
  if (!text || typeof text !== "string") return [];

  const isolation = isolateExperienceSection(text);
  const sectionText = isolation.experienceSectionText;
  const isSectionMissing = isolation.sectionDetectionConfidence === "none";

  const lines = isSectionMissing
    ? text.split("\n").map((l) => l.trim()).filter(Boolean)
    : sectionText.split("\n").map((l) => l.trim()).filter(Boolean);

  const rawBlocks = [];
  let currentBlockLines = [];

  const isExperienceHeaderLine = (line) => {
    if (/(?:projects|academic projects|personal projects|mini projects|major projects|final year project|capstone projects|college projects)/i.test(line)) {
      return false;
    }
    const hasRoleKey = /\b(?:software engineer|developer|intern|internship|analyst|associate|consultant|executive|manager|devops|full stack|frontend|backend|trainee|apprentice|freelance|engineer)\b/i.test(line);
    const hasCompanyKey = /\b(?:pvt|ltd|inc|corp|solutions|technologies|systems|labs|services|studio|infotech|tech)\b/i.test(line);
    const hasDateKey = /\b(?:20\d{2}|19\d{2})\b/;
    return (hasRoleKey || hasCompanyKey) && (hasDateKey || line.includes("|") || line.includes("-") || line.includes("–") || line.length < 60);
  };

  if (isSectionMissing) {
    let candidateBlock = [];
    let foundHeader = false;
    for (const line of lines) {
      if (isExperienceHeaderLine(line)) {
        if (candidateBlock.length > 0) rawBlocks.push(candidateBlock);
        candidateBlock = [line];
        foundHeader = true;
      } else if (foundHeader) {
        candidateBlock.push(line);
      }
    }
    if (candidateBlock.length > 0) rawBlocks.push(candidateBlock);
  } else {
    for (const line of lines) {
      const isBullet = /^[•\-*\s▪○]/.test(line);
      const blockTextSoFar = currentBlockLines.join(" ");
      const hasBulletInBlock = currentBlockLines.some((l) => /^[•\-*\s▪○]/.test(l));
      const hasDateInBlock = /\b(?:20\d{2}|19\d{2})\b/.test(blockTextSoFar);
      const hasRoleAndCompany = /\b(?:developer|engineer|intern|analyst|associate|consultant|manager|trainee|apprentice)\b/i.test(blockTextSoFar) && /\b(?:pvt|ltd|inc|corp|solutions|technologies|systems|labs|services|studio|infotech|tech|co)\b/i.test(blockTextSoFar);

      if (!isBullet && line.length < 120 && isExperienceHeaderLine(line) && (hasBulletInBlock || hasDateInBlock || hasRoleAndCompany)) {
        if (currentBlockLines.length > 0) {
          rawBlocks.push(currentBlockLines);
        }
        currentBlockLines = [line];
      } else {
        currentBlockLines.push(line);
      }
    }
    if (currentBlockLines.length > 0) {
      rawBlocks.push(currentBlockLines);
    }
  }

  const experienceRecords = [];
  let expCounter = 1;

  for (const blockLines of rawBlocks) {
    const blockText = blockLines.join(" ");

    // Strict Project -> Experience Isolation Guard
    if (/(?:academic project|personal project|mini project|major project|final year project|capstone project|college project)/i.test(blockText)) {
      continue;
    }

    let role = null;
    let company = null;

    const headerLine = blockLines[0] || "";
    const pipeParts = headerLine.split(/[\-|–—|]/).map((p) => p.trim()).filter(Boolean);

    if (pipeParts.length >= 2) {
      for (const part of pipeParts) {
        if (/\b(?:developer|engineer|intern|analyst|associate|consultant|executive|manager|lead|architect|trainee|apprentice|specialist)\b/i.test(part)) {
          if (!role) role = part;
        } else if (/\b(?:pvt|ltd|inc|corp|solutions|technologies|systems|labs|services|studio|infotech|tech|co)\b/i.test(part) || !company) {
          if (!company && !/\b(?:20\d{2}|present|current)\b/i.test(part)) {
            company = part;
          }
        }
      }
    }

    if (!role) {
      for (const line of blockLines) {
        const roleMatch = line.match(/\b(Software Engineer|Full Stack Developer|Frontend Developer|Backend Developer|Software Developer|Data Analyst|Cybersecurity Analyst|DevOps Engineer|Technical Intern|Software Engineering Intern|Intern|Apprentice|Trainee|Freelancer|Consultant)\b/i);
        if (roleMatch) {
          role = roleMatch[1];
          break;
        }
      }
    }

    if (!company) {
      for (const line of blockLines) {
        if (/\b(?:Technologies|Solutions|Systems|Pvt Ltd|Inc|Corp|IT Solution|Software|Labs|Services|Studio|Infotech)\b/i.test(line)) {
          company = line.replace(/^(?:at|from)\s+/i, "").replace(/\s*[-–—|].*$/, "").trim();
          break;
        }
      }
    }

    if (!role && !company) {
      if (isSectionMissing) continue;
      role = headerLine.slice(0, 50);
    }

    let expType = "work_experience";
    if (/\b(?:intern|internship|summer intern|technical intern)\b/i.test(blockText)) {
      expType = "internship";
    } else if (/\b(?:freelance|freelancer|contractor)\b/i.test(blockText)) {
      expType = "freelance";
    } else if (/\b(?:apprentice|apprenticeship)\b/i.test(blockText)) {
      expType = "apprenticeship";
    } else if (/\b(?:industrial training|vocational training|trainee)\b/i.test(blockText)) {
      expType = "training";
    }

    let location = null;
    const locMatch = blockText.match(/\b(Pune|Mumbai|Bangalore|Bengaluru|Hyderabad|Delhi|Noida|Gurgaon|Chennai|Kolkata|USA|India|Remote|Hybrid)\b/i);
    if (locMatch) location = locMatch[1];

    let employmentMode = "unknown";
    if (/\bremote\b/i.test(blockText)) employmentMode = "remote";
    else if (/\bhybrid\b/i.test(blockText)) employmentMode = "hybrid";
    else if (/\bcontract\b/i.test(blockText)) employmentMode = "contract";
    else if (/\bpart[-\s]?time\b/i.test(blockText)) employmentMode = "part_time";
    else if (/\bfull[-\s]?time\b/i.test(blockText)) employmentMode = "full_time";

    let startDate = null;
    let endDate = null;
    let isCurrent = false;
    let dateText = null;
    let durationText = null;
    let durationMonths = null;

    const dateMatch = blockText.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}|\d{4})\s*(?:[-–—]|to)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}|\d{4}|Present|Current|Till Date|Ongoing)\b/i);
    if (dateMatch) {
      dateText = dateMatch[0];
      const startStr = dateMatch[1];
      const endStr = dateMatch[2];

      startDate = parseMonthYearToISO(startStr);

      if (/present|current|till date|ongoing/i.test(endStr)) {
        isCurrent = true;
        endDate = null;
      } else {
        endDate = parseMonthYearToISO(endStr);
      }

      if (startDate && (endDate || isCurrent)) {
        const sY = parseInt(startDate.slice(0, 4), 10);
        const sM = startDate.includes("-") ? parseInt(startDate.slice(5, 7), 10) : 1;
        
        const now = new Date();
        const eY = isCurrent ? now.getFullYear() : parseInt((endDate || "").slice(0, 4), 10);
        const eM = isCurrent ? (now.getMonth() + 1) : (endDate && endDate.includes("-") ? parseInt(endDate.slice(5, 7), 10) : 12);

        if (!isNaN(sY) && !isNaN(eY) && eY >= sY) {
          durationMonths = (eY - sY) * 12 + (eM - sM + 1);
          if (durationMonths < 1) durationMonths = 1;
        }
      }
    }

    // Preserve original explicit duration text if present in resume (Fix 3)
    const durTextMatch = blockText.match(/\b(\d+\s*(?:months|mos|years|yrs))\b/i);
    if (durTextMatch) {
      durationText = durTextMatch[1];
    }

    // Responsibilities vs Achievements Separation (Rule 3)
    const responsibilities = [];
    const achievements = [];
    const bulletLines = blockLines.slice(1);

    for (const bLine of bulletLines) {
      const cleanLine = bLine.replace(/^[•\-*\s▪○]+/, "").trim();
      if (!cleanLine) continue;

      // Filter out pure date lines from responsibilities
      const isPureDateLine = /^\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}|\d{4})\s*(?:[-–—]|to)\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}|\d{4}|Present|Current|Till Date|Ongoing)\s*$/i.test(cleanLine);
      if (isPureDateLine) continue;

      const hasMetric = /\b\d+%\b|\b\d+\+\s*(?:users|clients|requests|projects|records)\b|\$\d+/.test(cleanLine);
      const hasAwardRank = /\b(?:winner|1st place|1st rank|top \d+|best project|awarded|recognized|honored)\b/i.test(cleanLine);

      if (hasMetric || hasAwardRank) {
        achievements.push(cleanLine);
      } else {
        responsibilities.push(cleanLine);
      }
    }

    // Technology Local Matching
    const localTechs = [];
    if (typeof SKILL_TAXONOMY === "object") {
      for (const [cat, keywords] of Object.entries(SKILL_TAXONOMY)) {
        for (const kw of keywords) {
          const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          if (regex.test(blockText) && !localTechs.includes(kw)) {
            localTechs.push(kw);
          }
        }
      }
    }

    let confidence = 0.30;
    if (company) confidence += 0.25;
    if (role) confidence += 0.25;
    if (dateText) confidence += 0.10;
    if (responsibilities.length > 0) confidence += 0.10;

    confidence = Math.min(1.0, Math.round(confidence * 100) / 100);

    // Missing Heading Rule: demand all 4 elements if section is missing
    if (isSectionMissing && (!company || !role || !dateText || responsibilities.length === 0)) {
      continue;
    }

    experienceRecords.push({
      id: `exp_${expCounter++}`,
      type: expType,
      company: company || null,
      organization: company || null,
      role: role || null,
      designation: role || null,
      location: location || null,
      startDate: startDate || null,
      endDate: endDate || null,
      isCurrent,
      dateText: dateText || null,
      durationText: durationText || null,
      durationMonths: durationMonths || null,
      responsibilities,
      achievements,
      technologies: localTechs,
      domain: null,
      employmentMode,
      evidence: blockLines.slice(0, 3),
      confidence,
      source: "resume_text",
      section: isSectionMissing ? "Implicit_Experience" : "Experience",
    });
  }

  const uniqueExp = [];
  const seenExpKeys = new Set();

  for (const exp of experienceRecords) {
    const key = `${(exp.company || "").toLowerCase()}:${(exp.role || "").toLowerCase()}`;
    if (!seenExpKeys.has(key)) {
      seenExpKeys.add(key);
      uniqueExp.push(exp);
    }
  }

  return uniqueExp;
}

/**
 * ── PHASE 6: CERTIFICATIONS, ACHIEVEMENTS & EXTRA SECTIONS ENGINE ──
 */
const IGNORABLE_CERT_SKILLS = new Set([
  "aws", "aws academy", "udemy", "coursera", "nptel", "l&t edutech", "l&t", 
  "edutech", "google", "microsoft", "cisco", "sap", "german academy", "oracle", 
  "ibm", "linkedin", "railway", "netlify", "vercel", "pluralsight", "edx", "academy"
]);

export function extractCertificationsFromText(text) {
  if (!text || typeof text !== "string") return [];

  const certMatch = text.match(/(?:^|\n)\s*(?:Certifications|Certificates|Professional Certifications|Courses & Certifications|Licenses & Certifications|Training & Certifications)\b[:\-]*([\s\S]*?)(?=(?:\n\s*(?:Projects|Experience|Work Experience|Education|Technical Skills|Skills|Achievements|Publications|Research|Volunteering|Leadership|Declaration|Languages|Interests)\b[:\-]*)|$)/i);
  if (!certMatch || !certMatch[1]) return [];

  const lines = certMatch[1].trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const certs = [];
  let certCounter = 1;

  const knownIssuers = ["Amazon Web Services", "AWS", "Google", "Microsoft", "Coursera", "Udemy", "NPTEL", "L&T EduTech", "Cisco", "SAP", "German Academy", "Oracle", "IBM", "LinkedIn"];

  for (const rawLine of lines) {
    const cleanLine = rawLine.replace(/^[•\-*\s▪○]+/, "").trim();
    if (cleanLine.length < 3) continue;

    // Filter out email, contact, URL, grade, and header/footer noise lines
    if (/@|cgpa|first class|distinction|visitors|^\s*[|#€+]/i.test(cleanLine)) {
      continue;
    }

    let certName = cleanLine;
    let issuer = null;
    let issueDate = null;

    const dateMatch = cleanLine.match(/\b(20\d{2}|19\d{2})\b/);
    if (dateMatch) issueDate = dateMatch[1];

    for (const kIssuer of knownIssuers) {
      if (new RegExp(`\\b${kIssuer}\\b`, "i").test(cleanLine)) {
        issuer = kIssuer;
        break;
      }
    }

    let certType = "certification";
    if (/course/i.test(cleanLine)) certType = "course";
    else if (/workshop/i.test(cleanLine)) certType = "workshop";
    else if (/training/i.test(cleanLine)) certType = "training";
    else if (/license/i.test(cleanLine)) certType = "license";

    const urlMatch = cleanLine.match(/https?:\/\/[^\s]+/i);
    const credentialUrl = urlMatch ? urlMatch[0] : null;

    // Fix 1: Strictly exclude issuer and platform names from skills
    const matchedSkills = [];
    if (typeof SKILL_TAXONOMY === "object") {
      for (const [cat, keywords] of Object.entries(SKILL_TAXONOMY)) {
        for (const kw of keywords) {
          if (IGNORABLE_CERT_SKILLS.has(kw.toLowerCase())) continue;
          const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          if (regex.test(cleanLine) && !matchedSkills.includes(kw)) {
            matchedSkills.push(kw);
          }
        }
      }
    }

    const hasCertKeyword = /certif|course|academy|training|license|nptel|aws|udemy|l&t|cisco|sap|google|microsoft/i.test(cleanLine);
    const isBulletLine = /^[•\-*\s▪○]/.test(rawLine);

    if (!hasCertKeyword && !isBulletLine && !issuer) {
      continue; // Skip lines without certification evidence
    }

    let confidence = 0.60;
    if (issuer) confidence += 0.25;
    if (issueDate) confidence += 0.15;

    certs.push({
      id: `cert_${certCounter++}`,
      name: certName,
      issuer: issuer || null,
      issueDate: issueDate || null,
      expiryDate: null,
      credentialId: null,
      credentialUrl: credentialUrl || null,
      skills: matchedSkills,
      rawText: cleanLine,
      evidence: [cleanLine],
      confidence: Math.min(1.0, confidence),
      section: "Certifications",
      type: certType,
    });
  }

  const uniqueCerts = [];
  const seenCerts = new Set();
  for (const c of certs) {
    const key = c.name.toLowerCase();
    if (!seenCerts.has(key)) {
      seenCerts.add(key);
      uniqueCerts.push(c);
    }
  }

  return uniqueCerts;
}

export function extractAchievementsFromText(text) {
  if (!text || typeof text !== "string") return [];

  const match = text.match(/(?:^|\n)\s*(?:Achievements|Accomplishments|Honors|Awards|Recognition|Academic Achievements|Extra-Curricular Achievements)\b[:\-]*([\s\S]*?)(?=(?:\n\s*(?:Projects|Experience|Work Experience|Education|Technical Skills|Skills|Certifications|Publications|Research|Volunteering|Leadership|Declaration|Languages|Interests)\b[:\-]*)|$)/i);
  if (!match || !match[1]) return [];

  const lines = match[1].trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const achievements = [];
  let achCounter = 1;

  for (const rawLine of lines) {
    const cleanLine = rawLine.replace(/^[•\-*\s▪○]+/, "").trim();
    if (cleanLine.length < 5) continue;

    let category = "other";
    if (/award|winner|prize|trophy/i.test(cleanLine)) category = "award";
    else if (/rank|secured|placed|top \d+/i.test(cleanLine)) category = "ranking";
    else if (/hackathon|competition|contest/i.test(cleanLine)) category = "competition";
    else if (/academic|cgpa|topper|scholarship/i.test(cleanLine)) category = "academic";
    else if (/lead|head|president|secretary/i.test(cleanLine)) category = "leadership";

    const dateMatch = cleanLine.match(/\b(20\d{2}|19\d{2})\b/);
    const date = dateMatch ? dateMatch[1] : null;

    const metrics = [];
    const metricMatch = cleanLine.match(/\b(\d+%\b|\d+\+\s*\w+|\d+st|\d+nd|\d+rd|\d+th)/gi);
    if (metricMatch) {
      metrics.push(...metricMatch);
    }

    achievements.push({
      id: `ach_${achCounter++}`,
      title: cleanLine,
      description: cleanLine,
      category,
      date,
      organization: null,
      rank: category === "ranking" ? (cleanLine.match(/\b(\d+st|\d+nd|\d+rd|\d+th|top \d+)\b/i)?.[0] || null) : null,
      metrics,
      rawText: cleanLine,
      evidence: [cleanLine],
      confidence: 0.85,
      section: "Achievements",
    });
  }

  return achievements;
}

export function extractExtraSectionsFromText(text) {
  if (!text || typeof text !== "string") {
    return {
      publications: [],
      research: [],
      leadership: [],
      volunteering: [],
      languages: [],
      interests: [],
      codingProfiles: [],
      links: [],
    };
  }

  const links = [];
  const codingProfiles = [];

  const urlMatches = text.match(/https?:\/\/[^\s,;()]+/gi) || [];
  for (const url of urlMatches) {
    links.push(url);
    if (/github\.com/i.test(url)) {
      codingProfiles.push({ platform: "GitHub", username: url.split("/").pop() || null, url, confidence: 0.95 });
    } else if (/linkedin\.com/i.test(url)) {
      codingProfiles.push({ platform: "LinkedIn", username: url.split("/").pop() || null, url, confidence: 0.95 });
    } else if (/leetcode\.com/i.test(url)) {
      codingProfiles.push({ platform: "LeetCode", username: url.split("/").pop() || null, url, confidence: 0.95 });
    } else if (/hackerrank\.com/i.test(url)) {
      codingProfiles.push({ platform: "HackerRank", username: url.split("/").pop() || null, url, confidence: 0.95 });
    } else if (/codechef\.com/i.test(url)) {
      codingProfiles.push({ platform: "CodeChef", username: url.split("/").pop() || null, url, confidence: 0.95 });
    }
  }

  const languages = [];
  const langMatch = text.match(/(?:^|\n)\s*(?:Languages)\b[:\-]*([\s\S]*?)(?=(?:\n\s*(?:Projects|Experience|Education|Skills|Certifications|Interests|Declaration)\b[:\-]*)|$)/i);
  if (langMatch && langMatch[1]) {
    const lLines = langMatch[1].trim().split("\n").map((l) => l.trim()).filter(Boolean);
    for (const lLine of lLines) {
      const parts = lLine.split(/[,;•|\-]/).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (/English|Hindi|Marathi|German|Spanish|French|Japanese|Mandarin/i.test(p)) {
          languages.push({ language: p, proficiency: null, rawText: p, confidence: 0.9 });
        }
      }
    }
  }

  const interests = [];
  const intMatch = text.match(/(?:^|\n)\s*(?:Interests|Hobbies)\b[:\-]*([\s\S]*?)(?=(?:\n\s*(?:Projects|Experience|Education|Skills|Certifications|Declaration)\b[:\-]*)|$)/i);
  if (intMatch && intMatch[1]) {
    const iLines = intMatch[1].trim().split("\n").map((l) => l.trim()).filter(Boolean);
    for (const iLine of iLines) {
      const parts = iLine.split(/[,;•|\-]/).map((p) => p.trim()).filter(Boolean);
      interests.push(...parts);
    }
  }

  return {
    publications: [],
    research: [],
    leadership: [],
    volunteering: [],
    languages,
    interests,
    codingProfiles,
    links: Array.from(new Set(links)),
  };
}

/**
 * ── PHASE 4: EDUCATION SECTION ISOLATION & STRUCTURED EXTRACTION ──
 */
export function isolateEducationSection(text) {
  if (!text || typeof text !== "string") {
    return {
      educationSectionText: "",
      sectionDetectionConfidence: "none",
      warnings: ["No text provided"],
    };
  }

  const match = text.match(/(?:^|\n)\s*(?:Education|Academic Background|Educational Qualification|Academic Qualifications|Education & Training|Qualifications)\b[:\-]*([\s\S]*?)(?=(?:\n\s*(?:Projects|Personal Projects|Technical Skills|Skills|Experience|Work Experience|Certifications|Achievements|Publications|Declaration|Languages|Interests)\b[:\-]*)|$)/i);

  if (!match || !match[1] || !match[1].trim()) {
    return {
      educationSectionText: "",
      sectionDetectionConfidence: "none",
      warnings: ["No education section detected"],
    };
  }

  const sectionText = match[1].trim();

  return {
    educationSectionText: sectionText,
    sectionDetectionConfidence: "high",
    warnings: [],
  };
}

export function extractEducationFromText(text) {
  if (!text) return [];

  const isolation = isolateEducationSection(text);
  const sectionText = isolation.educationSectionText;

  if (!sectionText) return [];

  const lines = sectionText.split("\n").map((l) => l.trim()).filter(Boolean);
  const educationRecords = [];

  const degreeDict = [
    { name: "Bachelor of Technology", aliases: ["B.Tech", "BTech", "B. Tech", "Bachelor of Technology"], level: "undergraduate" },
    { name: "Bachelor of Engineering", aliases: ["B.E.", "BE", "B. E.", "Bachelor of Engineering"], level: "undergraduate" },
    { name: "Bachelor of Science", aliases: ["B.Sc.", "BSc", "B. Sc.", "Bachelor of Science"], level: "undergraduate" },
    { name: "Bachelor of Computer Applications", aliases: ["BCA", "B.C.A.", "Bachelor of Computer Applications"], level: "undergraduate" },
    { name: "Master of Computer Applications", aliases: ["MCA", "M.C.A.", "Master of Computer Applications"], level: "postgraduate" },
    { name: "Master of Technology", aliases: ["M.Tech", "MTech", "Master of Technology"], level: "postgraduate" },
    { name: "Master of Engineering", aliases: ["M.E.", "ME", "Master of Engineering"], level: "postgraduate" },
    { name: "Master of Business Administration", aliases: ["MBA", "M.B.A.", "Master of Business Administration"], level: "postgraduate" },
    { name: "Diploma", aliases: ["Diploma", "Polytechnic"], level: "diploma" },
    { name: "Higher Secondary Certificate (HSC)", aliases: ["HSC", "12th", "Higher Secondary", "H.S.C.", "Higher Secondary Certificate"], level: "higher_secondary" },
    { name: "Secondary School Certificate (SSC)", aliases: ["SSC", "10th", "Secondary School", "S.S.C.", "Secondary School Certificate"], level: "secondary" },
    { name: "Doctor of Philosophy", aliases: ["PhD", "Ph.D.", "Doctorate"], level: "doctoral" },
  ];

  function matchesAlias(alias, str) {
    if (!alias || !str) return false;
    if (alias.includes(".")) {
      const escaped = alias.replace(/\./g, "\\.");
      const regex = new RegExp(`(?:^|[\\s,;:(/\\-|])${escaped}(?:$|[\\s,;:)/\\-|]|\\b)`, "i");
      return regex.test(str);
    }
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return regex.test(str);
  }

  function detectDegree(str) {
    for (const d of degreeDict) {
      for (const alias of d.aliases) {
        if (matchesAlias(alias, str) || str.toLowerCase().includes(d.name.toLowerCase())) {
          return { degreeName: d.name, rawAlias: alias, level: d.level };
        }
      }
    }
    return null;
  }

  // Group lines into raw education blocks based on degree keywords or line boundaries
  const rawBlocks = [];
  let currentBlockLines = [];

  for (const line of lines) {
    const degInfo = detectDegree(line);
    const currBlockDeg = currentBlockLines.length > 0 ? detectDegree(currentBlockLines.join(" ")) : null;

    if (degInfo && currentBlockLines.length > 0) {
      // If the new line has the SAME degree as current block, don't split!
      if (currBlockDeg && currBlockDeg.degreeName === degInfo.degreeName) {
        currentBlockLines.push(line);
      } else {
        rawBlocks.push(currentBlockLines);
        currentBlockLines = [line];
      }
    } else {
      currentBlockLines.push(line);
    }
  }

  if (currentBlockLines.length > 0) {
    rawBlocks.push(currentBlockLines);
  }

  for (const blockLines of rawBlocks) {
    const blockText = blockLines.join(" ");
    const degInfo = detectDegree(blockText);

    let matchedDegree = degInfo ? degInfo.degreeName : null;
    let rawDegreeStr = degInfo ? degInfo.rawAlias : null;
    let educationLevel = degInfo ? degInfo.level : "unknown";

    if (!matchedDegree) {
      if (/bachelor/i.test(blockText)) { matchedDegree = "Bachelor Degree"; educationLevel = "undergraduate"; }
      else if (/master/i.test(blockText)) { matchedDegree = "Master Degree"; educationLevel = "postgraduate"; }
      else { matchedDegree = blockLines[0] || "Degree"; }
    }

    // Extract Field of Study
    let fieldOfStudy = null;
    const fieldMatch = blockText.match(/(?:in|–|-|\|)\s*(Computer Engineering|Computer Science|Information Technology|Electronics Engineering|Mechanical Engineering|Civil Engineering|Electrical Engineering|Data Science|Artificial Intelligence|Software Engineering)\b/i);
    if (fieldMatch) {
      fieldOfStudy = fieldMatch[1].trim();
    }

    // Handle Pipe (|) Separated Lines (e.g. B.E. in CS | MIT College | 2018 - 2022)
    let pipeSegments = [];
    if (blockText.includes("|")) {
      pipeSegments = blockText.split("|").map((s) => s.trim()).filter(Boolean);
    }

    // Extract Institution & University
    let institution = null;
    let university = null;

    if (pipeSegments.length > 1) {
      for (const seg of pipeSegments) {
        if (/college|school|vidyalaya|university|institute|academy|COEP/i.test(seg) && !detectDegree(seg)) {
          institution = seg.replace(/^(?:at|from)\s+/i, "").replace(/\s*\d{4}\s*.*$/, "").trim();
          break;
        }
      }
    }

    if (!institution) {
      for (const line of blockLines) {
        const isDegreeLine = !!detectDegree(line);

        if (!isDegreeLine && /college|school|vidyalaya|university|institute|academy|COEP/i.test(line) && !/cgpa|grade|score|class|distinction/i.test(line)) {
          if (!institution) {
            institution = line.replace(/^(?:at|from)\s+/i, "").replace(/\s*\d{4}\s*.*$/, "").trim();
          } else if (!university && /university/i.test(line)) {
            university = line.trim();
          }
        }
      }
    }

    if (!institution) {
      for (const line of blockLines) {
        const isDegreeLine = !!detectDegree(line);
        if (!isDegreeLine && line.trim().length > 3 && !/^\d{4}/.test(line.trim())) {
          institution = line.trim();
          break;
        }
      }
    }

    if (!institution && blockLines[1]) {
      institution = blockLines[1].replace(/\s*\d{4}\s*.*$/, "").trim();
    }

    // Extract Dates & Duration
    let startDate = null;
    let endDate = null;
    let duration = null;
    let status = "completed";

    const dateRangeMatch = blockText.match(/\b(20\d{2}|19\d{2})\s*[-–]\s*(20\d{2}|19\d{2}|Present|Current)\b/i);
    if (dateRangeMatch) {
      startDate = dateRangeMatch[1];
      endDate = dateRangeMatch[2];
      duration = `${startDate} – ${endDate}`;
      if (/present|current/i.test(endDate)) status = "ongoing";
    } else {
      const singleYearMatch = blockText.match(/\b(20\d{2}|19\d{2})\b/);
      if (singleYearMatch) {
        endDate = singleYearMatch[1];
        duration = endDate;
      }
    }

    // Extract Score (CGPA / Percentage / GPA)
    let score = { value: null, type: null, normalizedValue: null };

    const cgpaMatch = blockText.match(/(?:CGPA|GPA)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
    const percentMatch = blockText.match(/(\d+(?:\.\d+)?)\s*%/);

    if (cgpaMatch) {
      const val = parseFloat(cgpaMatch[1]);
      let scoreType = "GPA";
      if (/CGPA/i.test(blockText)) scoreType = "CGPA";
      else if (/GPA/i.test(blockText)) scoreType = "GPA";

      score = {
        value: val,
        type: scoreType,
        normalizedValue: val,
      };
    } else if (percentMatch) {
      const val = parseFloat(percentMatch[1]);
      score = {
        value: val,
        type: "PERCENTAGE",
        normalizedValue: val,
      };
    }

    // Calculate Confidence
    let confidence = 0;
    if (matchedDegree) confidence += 0.35;
    if (institution) confidence += 0.25;
    if (fieldOfStudy) confidence += 0.15;
    if (duration) confidence += 0.10;
    if (score.value !== null) confidence += 0.10;
    if (blockLines.length >= 2) confidence += 0.05;

    confidence = Math.min(1.0, Math.round(confidence * 100) / 100);

    educationRecords.push({
      degree: matchedDegree,
      rawDegree: rawDegreeStr || matchedDegree,
      fieldOfStudy: fieldOfStudy || null,
      institution: institution || "University / College",
      university: university || null,
      location: null,
      startDate: startDate || null,
      endDate: endDate || null,
      duration: duration || null,
      score,
      educationLevel,
      status,
      sourceText: blockLines.join("\n"),
      confidence,
      extractionMethod: "RULE_BASED",
      warnings: [],
    });
  }

  // Deduplicate & Merge Education Records by Degree/Level
  const mergedMap = new Map();

  for (const rec of educationRecords) {
    const key = rec.degree ? rec.degree.toLowerCase() : rec.educationLevel;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, rec);
    } else {
      const existing = mergedMap.get(key);
      // Merge richer info into existing record
      if (!existing.institution || existing.institution === "University / College") existing.institution = rec.institution;
      if (!existing.startDate) existing.startDate = rec.startDate;
      if (!existing.endDate) existing.endDate = rec.endDate;
      if (!existing.duration) existing.duration = rec.duration;
      if (existing.score.value === null && rec.score.value !== null) existing.score = rec.score;
      if (!existing.fieldOfStudy && rec.fieldOfStudy) existing.fieldOfStudy = rec.fieldOfStudy;
      existing.confidence = Math.max(existing.confidence, rec.confidence);
      existing.sourceText += "\n" + rec.sourceText;
    }
  }

  const uniqueRecords = Array.from(mergedMap.values());

  return uniqueRecords;
}



/**
 * ── PHASE 5 & 9: SKILL DEPTH, STRENGTH ANALYSIS & AI SKILL INSIGHTS ENGINE ──
 */
export function analyzeSkillStrengthAndInsights(allSkills = [], confirmedProjects = [], experience = [], rawText = "") {
  const result = extractSkillIntelligence(rawText, confirmedProjects, experience, [], []);
  const strongSkills = [];
  const workingSkills = [];
  const mentionedSkills = [];
  const skillsToImprove = [];

  for (const skillRecord of result.skillInsights.confirmedSkills) {
    const item = {
      name: skillRecord.skill,
      score: Math.min(100, Math.round(skillRecord.confidence * 100)),
      projectsUsedIn: skillRecord.relatedProjects,
      reason: skillRecord.relatedProjects.length > 0
        ? `Used in ${skillRecord.relatedProjects.length} confirmed project(s)`
        : `Demonstrated in ${skillRecord.sources.join(", ")}`,
      evidence: skillRecord.evidence.length > 0 ? skillRecord.evidence[0].text : "Listed in resume",
    };

    if (skillRecord.depth === "advanced" || skillRecord.confidence >= 0.70) {
      strongSkills.push(item);
    } else if (skillRecord.depth === "intermediate" || skillRecord.confidence >= 0.50) {
      workingSkills.push(item);
    } else {
      mentionedSkills.push(item);
    }
  }

  // Personalized "Skills to Improve" based on evidence
  const lowerText = rawText.toLowerCase();

  // 1. If Web Stack (React/Node) is present, but Testing is missing
  if ((allSkills.includes("React.js") || allSkills.includes("Node.js")) && !allSkills.includes("Jest") && !allSkills.includes("Cypress")) {
    skillsToImprove.push({
      name: "Automated Testing & Integration (Jest/Cypress)",
      reason: "Your profile contains Web Stack skills, but automated unit/integration testing evidence is missing.",
      evidence: "React.js / Node.js present without testing framework",
      recommendation: "Add unit testing (Jest/React Testing Library) to your web projects.",
    });
  }

  // 2. If Backend/Database is present, but DevOps / Docker deployment is missing
  if ((allSkills.includes("Node.js") || allSkills.includes("PostgreSQL") || allSkills.includes("MongoDB")) && !allSkills.includes("Docker") && !allSkills.includes("AWS")) {
    skillsToImprove.push({
      name: "Containerization & Cloud Deployment (Docker/AWS)",
      reason: "Backend and database skills are listed, but containerization (Docker) or cloud hosting evidence is missing.",
      evidence: "Backend API present without Docker/AWS deployment evidence",
      recommendation: "Containerize your backend API with Docker and deploy to cloud (AWS/Vercel).",
    });
  }

  // 3. If SQL/Database is listed, but no explicit database project evidence
  if (allSkills.includes("SQL") && !allSkills.includes("PostgreSQL") && !allSkills.includes("MySQL") && !allSkills.includes("MongoDB")) {
    skillsToImprove.push({
      name: "Relational Database Implementation (PostgreSQL/MySQL)",
      reason: "SQL is listed as a skill, but specific database engine implementation details are missing from project descriptions.",
      evidence: "Generic SQL listed without specific RDBMS engine",
      recommendation: "Specify database schema design and RDBMS engine (PostgreSQL/MySQL) in project descriptions.",
    });
  }

  // Fallback default: If no specific gaps found, suggest System Design for strong profiles
  if (skillsToImprove.length === 0) {
    skillsToImprove.push({
      name: "System Architecture & API Scalability",
      reason: "Core technical stack is solid; focus on demonstrating production system architecture and load handling.",
      evidence: "Strong technical stack",
      recommendation: "Highlight caching (Redis), API rate limiting, and database indexing in your project descriptions.",
    });
  }

  return {
    strongSkills,
    workingSkills,
    mentionedSkills,
    skillsToImprove,
    skillInsights: result.skillInsights,
  };
}

/**
 * ── PHASE 6: PROJECT-BASED DOMAIN CLASSIFICATION ──
 */
export function classifyProjectDomains(confirmedProjects = [], allSkills = []) {
  const domains = new Set();
  const techStr = [...allSkills, ...confirmedProjects.flatMap((p) => p.technologies)].join(" ").toLowerCase();

  if (techStr.includes("react") && (techStr.includes("node") || techStr.includes("express") || techStr.includes("fastapi") || techStr.includes("django"))) {
    domains.add("Full Stack Web Development");
  } else if (techStr.includes("react") || techStr.includes("html") || techStr.includes("tailwind")) {
    domains.add("Frontend Web Development");
  } else if (techStr.includes("node") || techStr.includes("express") || techStr.includes("spring") || techStr.includes("fastapi")) {
    domains.add("Backend API Engineering");
  }

  if (techStr.includes("python") || techStr.includes("pandas") || techStr.includes("pytorch") || techStr.includes("tensorflow") || techStr.includes("scikit")) {
    domains.add("Data Science & AI / ML");
  }

  if (techStr.includes("docker") || techStr.includes("kubernetes") || techStr.includes("aws")) {
    domains.add("Cloud & DevOps Engineering");
  }

  const domainList = Array.from(domains);
  const primaryDomain = domainList[0] || "Software Engineering";
  const secondaryDomains = domainList.slice(1);

  return { primaryDomain, secondaryDomains };
}

/**
 * ── PHASE 7 & 8: REAL DETERMINISTIC ATS SCORE ENGINE (0-100 EXPLAINABLE) ──
 */
export function calculateDeterministicATSScore(data = {}) {
  let score = 0;
  const breakdown = {
    contact: 0,
    sections: 0,
    skills: 0,
    projects: 0,
    experience: 0,
    education: 0,
    quality: 0,
  };
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  // 1. Contact Info (max 10)
  const info = data.personalInfo || {};
  if (info.email) breakdown.contact += 3;
  if (info.phone) breakdown.contact += 2;
  if (info.github) breakdown.contact += 3;
  if (info.linkedin || info.portfolio) breakdown.contact += 2;

  if (breakdown.contact >= 8) strengths.push("Complete contact details and professional links.");
  else weaknesses.push("Missing professional links (GitHub / LinkedIn).");

  // 2. Section Completeness (max 15)
  if (data.summary && data.summary.length > 20) breakdown.sections += 3;
  if (Array.isArray(data.all_skills) && data.all_skills.length > 0) breakdown.sections += 4;
  if (Array.isArray(data.confirmedProjects) && data.confirmedProjects.length > 0) breakdown.sections += 5;
  if (Array.isArray(data.education) && data.education.length > 0) breakdown.sections += 3;

  // 3. Skills Quality (max 15)
  const skillsCount = (data.all_skills || []).length;
  if (skillsCount >= 8) breakdown.skills = 15;
  else if (skillsCount >= 4) breakdown.skills = 10;
  else if (skillsCount >= 1) breakdown.skills = 5;

  // 4. Projects Quality (max 25)
  const projects = Array.isArray(data.confirmedProjects) ? data.confirmedProjects : [];
  if (projects.length >= 3) breakdown.projects = 25;
  else if (projects.length === 2) breakdown.projects = 20;
  else if (projects.length === 1) breakdown.projects = 12;
  else weaknesses.push("No confirmed projects detected in resume.");

  // 5. Experience / Internships (max 15 - auto-redistributed to projects for freshers)
  const exp = Array.isArray(data.experience) ? data.experience : [];
  if (exp.length >= 1) {
    breakdown.experience = 15;
  } else {
    // Fresher redistribution: give up to 10 points if projects are strong
    if (projects.length >= 2) breakdown.experience = 10;
  }

  // 6. Education (max 10)
  const edu = Array.isArray(data.education) ? data.education : [];
  if (edu.length >= 1 && (edu[0].degree || edu[0].institution)) breakdown.education = 10;

  // 7. Quality & Action Verbs (max 10)
  if (data.extractionMetadata && data.extractionMetadata.wordCount > 150) breakdown.quality += 5;
  if (data.strongSkills && data.strongSkills.length > 0) breakdown.quality += 5;

  score = breakdown.contact + breakdown.sections + breakdown.skills + breakdown.projects + breakdown.experience + breakdown.education + breakdown.quality;
  score = Math.min(100, Math.max(0, score));

  if (projects.length < 2) recommendations.push("Add at least 2 detailed technical projects with technologies used.");
  if (skillsCount < 6) recommendations.push("Expand technical skills section to include databases, tools, and frameworks.");

  return {
    atsScore: score,
    atsBreakdown: breakdown,
    strengths,
    weaknesses,
    recommendations,
    scoringVersion: "v2_deterministic",
  };
}

/**
 * ── PHASE 10: ESTIMATED RESUME-BASED READINESS SCORE ──
 */
export function calculateResumeEstimatedReadiness(confirmedProjects = [], allSkills = [], atsScore = 0) {
  const projScore = Math.min(40, confirmedProjects.length * 15);
  const skillScore = Math.min(30, allSkills.length * 4);
  const atsBonus = Math.min(30, Math.round(atsScore * 0.3));

  const total = projScore + skillScore + atsBonus;

  return {
    score: Math.min(95, Math.max(20, total)),
    type: "resume_estimated",
    confidence: "medium",
    breakdown: {
      projectEvidence: projScore,
      technicalEvidence: skillScore,
      atsBonus,
      interviewPerformance: 0,
    },
    explanation: "Estimated from resume project depth and skill coverage. Complete mock interviews to unlock full candidate assessment.",
  };
}

/**
 * ── MASTER RESUME PARSER FUNCTION ──
 */
export async function parseResumeComplete(fileBuffer, mimeType = "application/pdf", studentData = {}) {
  // Phase 1: Extraction & Artifact Cleaning
  const extraction = await extractResumeText(fileBuffer, mimeType);
  const rawText = extraction.text;
  const extractionMeta = extraction.metadata;

  console.log("\n========== EXTRACTED RESUME TEXT ==========");
  console.log(`[RESUME] Character count: ${extractionMeta.characterCount}, Hash: ${extractionMeta.normalizedTextHash}`);
  console.log(rawText.length > 2000 ? rawText.slice(0, 2000) + "\n...[FULL TEXT PRESERVED FOR PARSER]..." : rawText);
  console.log("===========================================\n");

  // Phase 2: Contact Info & Deterministic Section Extraction
  const contact = extractContactInfo(rawText);
  const deterministicSummary = extractSummaryFromText(rawText);
  const projectExtraction = extractProjectsFromText(rawText);
  const regexSkills = extractSkillsFromTextRegex(rawText);
  const regexExperience = extractExperienceFromText(rawText);
  const regexEducation = extractEducationFromText(rawText);
  const regexCertifications = extractCertificationsFromText(rawText);

  let parsedResult = null;
  let parsingMethod = "DETERMINISTIC_REGEX";
  const parsingWarnings = [...extractionMeta.extractionWarnings, ...projectExtraction.projectWarnings];

  // Stage B AI Structured Parsing (if configured & available)
  if (rawText.length >= 80) {
    const prompt = `You are an expert ATS resume parser. Analyze the following resume text and return structured JSON matching the exact schema below.

CRITICAL RULES:
1. Extract ONLY facts explicitly mentioned in the resume.
2. NEVER infer, invent, or fabricate missing skills, projects, degrees, or companies.
3. Return empty arrays [] or empty strings "" for missing fields.
4. Return ONLY valid JSON without markdown code fences.

RESUME TEXT:
"""
${rawText}
"""

JSON SCHEMA:
{
  "fullName": "Candidate Name",
  "summary": "",
  "skills": {
    "programming_languages": [],
    "data_science": [],
    "machine_learning": [],
    "deep_learning": [],
    "web_technologies": [],
    "frameworks": [],
    "libraries": [],
    "databases": [],
    "cloud": [],
    "devops": [],
    "tools": [],
    "other": []
  },
  "projects": [
    {
      "name": "Project Title",
      "description": "Brief description",
      "technologies": []
    }
  ],
  "experience": [
    {
      "role": "Role Title",
      "company": "Company Name",
      "duration": ""
    }
  ],
  "education": [
    {
      "degree": "Degree",
      "institution": "University / College"
    }
  ],
  "certifications": []
}`;

    try {
      const response = await AIGateway.execute({
        prompt,
        temperature: 0.1,
        timeoutMs: 15000,
      });

      if (response && response.text) {
        const repaired = AIJsonRepair.repairJson(response.text);
        if (repaired) {
          parsedResult = JSON.parse(repaired);
          parsingMethod = "AI_STRUCTURED_GROQ";
        }
      }
    } catch (aiErr) {
      parsingWarnings.push(`AI parsing fallback: ${aiErr.message}`);
    }
  }

  // Combine Skills & Projects
  const rawSkillsObj = parsedResult?.skills || {};
  const sanitizedCategories = {
    programming_languages: normalizeSkills(rawSkillsObj.programming_languages?.length ? rawSkillsObj.programming_languages : regexSkills.programming_languages),
    data_science: normalizeSkills(rawSkillsObj.data_science?.length ? rawSkillsObj.data_science : regexSkills.data_science),
    machine_learning: normalizeSkills(rawSkillsObj.machine_learning?.length ? rawSkillsObj.machine_learning : regexSkills.machine_learning),
    deep_learning: normalizeSkills(rawSkillsObj.deep_learning?.length ? rawSkillsObj.deep_learning : regexSkills.deep_learning),
    web_technologies: normalizeSkills(rawSkillsObj.web_technologies?.length ? rawSkillsObj.web_technologies : regexSkills.web_technologies),
    frameworks: normalizeSkills(rawSkillsObj.frameworks?.length ? rawSkillsObj.frameworks : regexSkills.frameworks),
    libraries: normalizeSkills(rawSkillsObj.libraries?.length ? rawSkillsObj.libraries : regexSkills.libraries),
    databases: normalizeSkills(rawSkillsObj.databases?.length ? rawSkillsObj.databases : regexSkills.databases),
    cloud: normalizeSkills(rawSkillsObj.cloud?.length ? rawSkillsObj.cloud : regexSkills.cloud),
    devops: normalizeSkills(rawSkillsObj.devops?.length ? rawSkillsObj.devops : regexSkills.devops),
    tools: normalizeSkills(rawSkillsObj.tools?.length ? rawSkillsObj.tools : regexSkills.tools),
    other: normalizeSkills(rawSkillsObj.other?.length ? rawSkillsObj.other : regexSkills.other),
  };

  const confirmedProjects = projectExtraction.confirmedProjects;

  for (const proj of confirmedProjects) {
    if (Array.isArray(proj.technologies)) {
      for (const tech of proj.technologies) {
        const norm = normalizeSkill(tech);
        if (norm) {
          const alreadyExists = Object.values(sanitizedCategories).some((arr) => arr.some((s) => s.toLowerCase() === norm.toLowerCase()));
          if (!alreadyExists) {
            sanitizedCategories.other.push(norm);
          }
        }
      }
    }
  }

  const allSkillsList = [];
  Object.values(sanitizedCategories).forEach((arr) => {
    if (Array.isArray(arr)) allSkillsList.push(...arr);
  });
  const all_skills = normalizeSkills(allSkillsList);

  const extractedExperience = parsedResult?.experience?.length ? parsedResult.experience : regexExperience;
  const extractedEducation = parsedResult?.education?.length ? parsedResult.education : regexEducation;
  const extractedCertifications = parsedResult?.certifications?.length ? parsedResult.certifications : regexCertifications;
  const extractedAchievements = extractAchievementsFromText(rawText);
  const extraSections = extractExtraSectionsFromText(rawText);

  const candidateName = parsedResult?.fullName || contact.fullName || studentData.name || "Candidate";

  // Phase 5: Skill Depth & Insights
  const skillInsights = analyzeSkillStrengthAndInsights(all_skills, confirmedProjects, extractedExperience, rawText);

  // Phase 6: Domain Classification
  const domains = classifyProjectDomains(confirmedProjects, all_skills);

  const tempContext = {
    candidateName,
    personalInfo: {
      fullName: candidateName,
      email: contact.email || studentData.email || "",
      phone: contact.phone || studentData.phone || "",
      location: contact.location || "",
      linkedin: contact.linkedin || studentData.linkedin || "",
      github: contact.github || studentData.github || "",
      portfolio: contact.portfolio || studentData.portfolio || "",
    },
    summary: parsedResult?.summary || deterministicSummary || "",
    skills: sanitizedCategories,
    categorizedSkills: sanitizedCategories,
    all_skills,
    projects: confirmedProjects,
    confirmedProjects,
    possibleProjects: projectExtraction.possibleProjects,
    experience: extractedExperience,
    education: extractedEducation,
    certifications: extractedCertifications,
    achievements: extractedAchievements,
    publications: extraSections.publications,
    research: extraSections.research,
    leadership: extraSections.leadership,
    volunteering: extraSections.volunteering,
    languages: extraSections.languages,
    interests: extraSections.interests,
    codingProfiles: extraSections.codingProfiles,
    links: extraSections.links,
    strongSkills: skillInsights.strongSkills,
    workingSkills: skillInsights.workingSkills,
    mentionedSkills: skillInsights.mentionedSkills,
    skillsToImprove: skillInsights.skillsToImprove,
    primaryDomain: domains.primaryDomain,
    secondaryDomains: domains.secondaryDomains,
    resumeText: rawText,
    extractionMetadata: extractionMeta,
    parsingMetadata: {
      parsingMethod,
      parsedAt: new Date().toISOString(),
    },
    warnings: parsingWarnings,
  };

  // Phase 7: Real Deterministic ATS Score Engine
  const atsResult = calculateDeterministicATSScore(tempContext);

  // Phase 10: Estimated Readiness
  const readinessAnalysis = calculateResumeEstimatedReadiness(confirmedProjects, all_skills, atsResult.atsScore);

  console.log("\n[RESUME] Evidence-Based Analysis Complete:");
  console.log(`[RESUME] Method: ${parsingMethod}`);
  console.log(`[RESUME] Dynamic ATS Score: ${atsResult.atsScore}/100`);
  console.log(`[RESUME] Confirmed Projects: ${confirmedProjects.length} (${confirmedProjects.map((p) => p.title).join(", ")})`);
  console.log(`[RESUME] Total Unique Skills: ${all_skills.length}\n`);

  return {
    ...tempContext,
    atsScore: atsResult.atsScore,
    atsBreakdown: atsResult.atsBreakdown,
    atsWarnings: atsResult.recommendations,
    readinessAnalysis,
  };
}

export function parseResumeText(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return {
      candidateName: "Candidate",
      atsScore: 0,
      skills: {},
      categorizedSkills: {},
      all_skills: [],
      projects: [],
      confirmedProjects: [],
      experience: [],
      education: [],
      certifications: [],
      achievements: [],
      publications: [],
      research: [],
      leadership: [],
      volunteering: [],
      languages: [],
      interests: [],
      codingProfiles: [],
      links: [],
    };
  }

  const normalized = cleanPDFTextArtifacts(rawText).text;
  const regexSkills = extractSkillsFromTextRegex(normalized);
  const projectExtraction = extractProjectsFromText(normalized);
  const experience = extractExperienceFromText(normalized);
  const education = extractEducationFromText(normalized);
  const certifications = extractCertificationsFromText(normalized);
  const achievements = extractAchievementsFromText(normalized);
  const extraSections = extractExtraSectionsFromText(normalized);
  const contact = extractContactInfo(normalized);
  const deterministicSummary = extractSummaryFromText(normalized);

  const allSkillsList = [];
  Object.values(regexSkills).forEach((arr) => {
    if (Array.isArray(arr)) allSkillsList.push(...arr);
  });
  const all_skills = normalizeSkills(allSkillsList);

  const skillInsights = analyzeSkillStrengthAndInsights(all_skills, projectExtraction.confirmedProjects, experience, normalized);
  const domains = classifyProjectDomains(projectExtraction.confirmedProjects, all_skills);

  const tempContext = {
    candidateName: contact.fullName || "Candidate",
    personalInfo: contact,
    summary: deterministicSummary || "",
    all_skills,
    confirmedProjects: projectExtraction.confirmedProjects,
    projects: projectExtraction.confirmedProjects,
    experience,
    education,
    certifications,
    achievements,
    publications: extraSections.publications,
    research: extraSections.research,
    leadership: extraSections.leadership,
    volunteering: extraSections.volunteering,
    languages: extraSections.languages,
    interests: extraSections.interests,
    codingProfiles: extraSections.codingProfiles,
    links: extraSections.links,
    strongSkills: skillInsights.strongSkills,
  };

  const atsResult = calculateDeterministicATSScore(tempContext);
  const readinessAnalysis = calculateResumeEstimatedReadiness(projectExtraction.confirmedProjects, all_skills, atsResult.atsScore);

  return {
    candidateName: contact.fullName || "Candidate",
    atsScore: atsResult.atsScore,
    atsBreakdown: atsResult.atsBreakdown,
    skills: regexSkills,
    categorizedSkills: regexSkills,
    all_skills,
    projects: projectExtraction.confirmedProjects,
    confirmedProjects: projectExtraction.confirmedProjects,
    experience,
    education,
    certifications,
    achievements,
    publications: extraSections.publications,
    research: extraSections.research,
    leadership: extraSections.leadership,
    volunteering: extraSections.volunteering,
    languages: extraSections.languages,
    interests: extraSections.interests,
    codingProfiles: extraSections.codingProfiles,
    links: extraSections.links,
    strongSkills: skillInsights.strongSkills,
    skillsToImprove: skillInsights.skillsToImprove,
    primaryDomain: domains.primaryDomain,
    secondaryDomains: domains.secondaryDomains,
    readinessAnalysis,
  };
}

export const calculateDynamicATSScore = calculateDeterministicATSScore;
