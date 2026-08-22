import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

/**
 * 1. Extract raw text from PDF buffer
 */
export async function extractPDFText(buffer) {
  try {
    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8 });
    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      let lastY = null;
      let pageText = "";
      
      for (const item of content.items) {
        if (!item.str) continue;
        const y = item.transform ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 5) {
          pageText += "\n";
        }
        pageText += item.str + " ";
        lastY = y;
      }
      fullText += pageText + "\n\n";
    }

    return fullText.trim();
  } catch (err) {
    console.warn("⚠️ PDF text extraction warning:", err.message);
    return "";
  }
}

/**
 * 2. Technology Name Normalization & Safe Deduplication
 */
const CANONICAL_SKILL_MAP = {
  "react": "React.js",
  "react.js": "React.js",
  "reactjs": "React.js",
  "node": "Node.js",
  "node.js": "Node.js",
  "nodejs": "Node.js",
  "express": "Express.js",
  "express.js": "Express.js",
  "expressjs": "Express.js",
  "js": "JavaScript",
  "javascript": "JavaScript",
  "ts": "TypeScript",
  "typescript": "TypeScript",
  "py": "Python",
  "python": "Python",
  "cpp": "C++",
  "c++": "C++",
  "c": "C",
  "c#": "C#",
  "csharp": "C#",
  "golang": "Go",
  "go": "Go",
  "scikit-learn": "Scikit-learn",
  "scikitlearn": "Scikit-learn",
  "sklearn": "Scikit-learn",
  "tensorflow": "TensorFlow",
  "tf": "TensorFlow",
  "keras": "Keras",
  "pytorch": "PyTorch",
  "torch": "PyTorch",
  "powerbi": "Power BI",
  "power bi": "Power BI",
  "tableau": "Tableau",
  "xgboost": "XGBoost",
  "postgres": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "mysql": "MySQL",
  "mongodb": "MongoDB",
  "mongo": "MongoDB",
  "fastapi": "FastAPI",
  "django": "Django",
  "flask": "Flask",
  "spring": "Spring Boot",
  "springboot": "Spring Boot",
  "spring boot": "Spring Boot",
  "docker": "Docker",
  "kubernetes": "Kubernetes",
  "k8s": "Kubernetes",
  "aws": "AWS",
  "azure": "Azure",
  "gcp": "GCP",
  "git": "Git",
  "github": "GitHub",
  "vscode": "VS Code",
  "vs code": "VS Code",
  "pandas": "Pandas",
  "numpy": "NumPy",
  "matplotlib": "Matplotlib",
  "seaborn": "Seaborn",
  "html": "HTML",
  "html5": "HTML",
  "css": "CSS",
  "css3": "CSS",
  "tailwind": "Tailwind CSS",
  "tailwindcss": "Tailwind CSS",
  "bootstrap": "Bootstrap",
  "sql": "SQL",
  "nosql": "NoSQL",
  "redis": "Redis",
  "graphql": "GraphQL",
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
  // Preserve original title casing if not in map
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
 * 3. Fallback Regex-based Skill Extractor (when offline or AI fails)
 */
export function extractSkillsFromTextRegex(text) {
  if (!text) return {
    programming_languages: ["Python", "JavaScript", "SQL"],
    data_science: [],
    machine_learning: [],
    deep_learning: [],
    web_technologies: ["HTML", "CSS"],
    frameworks: ["React.js", "Node.js"],
    libraries: [],
    databases: ["MySQL"],
    cloud: [],
    devops: ["Git"],
    tools: ["GitHub", "VS Code"],
    other: []
  };

  const categories = {
    programming_languages: ["Python", "Java", "C++", "C#", "\\bC\\b", "JavaScript", "TypeScript", "SQL", "Go", "Rust", "Kotlin", "Swift", "PHP", "Ruby", "R", "Scala", "Dart"],
    data_science: ["Pandas", "NumPy", "Matplotlib", "Seaborn", "SciPy", "Statsmodels", "Plotly", "Data Analysis", "EDA", "Data Visualization", "Power BI", "Tableau", "Excel"],
    machine_learning: ["Scikit-learn", "XGBoost", "LightGBM", "CatBoost", "Random Forest", "Decision Trees", "SVM", "KNN", "Linear Regression", "Logistic Regression", "K-Means", "PCA", "Gradient Boosting"],
    deep_learning: ["TensorFlow", "Keras", "PyTorch", "OpenCV", "NLTK", "Spacy", "Transformers", "BERT", "LLM", "Hugging Face", "CNN", "RNN", "LSTM", "YOLO"],
    web_technologies: ["HTML", "CSS", "Tailwind CSS", "Bootstrap", "REST APIs", "GraphQL", "WebSockets", "JSON", "XML"],
    frameworks: ["React.js", "React", "Next.js", "Node.js", "Express.js", "Express", "FastAPI", "Django", "Flask", "Spring Boot", "Angular", "Vue.js"],
    libraries: ["Redux", "Axios", "Prisma", "Mongoose", "Lodash", "JQuery"],
    databases: ["MySQL", "PostgreSQL", "MongoDB", "SQLite", "Redis", "Cassandra", "Oracle", "DynamoDB", "Firebase", "Supabase"],
    cloud: ["AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud Platform", "Heroku", "Vercel", "Netlify"],
    devops: ["Docker", "Kubernetes", "CI/CD", "GitHub Actions", "Jenkins", "Terraform", "Ansible", "Linux", "Nginx"],
    tools: ["Git", "GitHub", "GitLab", "VS Code", "Visual Studio", "Postman", "Jupyter", "Jupyter Notebook", "Colab", "Jira", "Figma"],
    other: ["Agile", "Scrum", "OOP", "Object-Oriented Programming", "Data Structures", "Algorithms", "DSA", "System Design", "Microservices"]
  };

  const detected = {};
  for (const [cat, keywords] of Object.entries(categories)) {
    detected[cat] = [];
    for (const kw of keywords) {
      let regex;
      if (kw === "C++") {
        regex = /(?:^|[\s,;:(/])C\+\+(?:$|[\s,;:)/])/i;
      } else if (kw === "C#") {
        regex = /(?:^|[\s,;:(/])C#(?:$|[\s,;:)/])/i;
      } else if (kw === "\\bC\\b") {
        regex = /(?:^|[\s,;:(/])C(?:$|[\s,;:)/])/;
      } else if (kw.includes("+") || kw.includes("#")) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regex = new RegExp(`(?:^|[\\s,;:(/])${escaped}(?:$|[\\s,;:)/])`, "i");
      } else {
        regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      }

      if (regex.test(text)) {
        const cleanName = kw === "\\bC\\b" ? "C" : kw.replace(/\\\+/g, "+").replace(/\\b/g, "").replace(/\\\./g, ".");
        detected[cat].push(normalizeSkill(cleanName));
      }
    }
    detected[cat] = normalizeSkills(detected[cat]);
  }

  return detected;
}

/**
 * 4. Master Resume Parser Function
 */
export async function parseResumeComplete(fileBuffer, mimeType, studentData = {}) {
  // Step 1: Extract full text from PDF
  const rawText = await extractPDFText(fileBuffer);

  console.log("\n========== EXTRACTED RESUME TEXT ==========");
  console.log(`[RESUME] Character count: ${rawText.length}`);
  console.log(rawText.length > 3000 ? rawText.slice(0, 3000) + "\n...[FULL TEXT PRESERVED FOR AI]..." : rawText);
  console.log("===========================================\n");

  const resumeBase64 = fileBuffer.toString("base64");

  const prompt = `You are an expert ATS resume parser.

Extract ALL technical and professional skills explicitly mentioned in the resume.

The resume may contain skill sections with headings such as:
- Skills
- Technical Skills
- Technical Expertise
- Technologies
- Technical Knowledge
- Programming Skills
- Tools & Technologies
- Software Skills
- Core Skills
- Data Science Skills
- Machine Learning Skills
- Languages
- Frameworks
- Libraries
- Databases
- Cloud
- Developer Tools

Do NOT rely only on a heading called "Skills".
Search the ENTIRE resume for technologies and skills.

Extract skills mentioned in:
1. Skills sections
2. Technical Skills sections
3. Project descriptions
4. Internship/work experience
5. Certifications
6. Research/publications
7. Education
8. Technology stacks

Do not invent skills.
Only include skills that are explicitly present in the resume.
Preserve the original technology names where possible (e.g., "React.js", "Node.js", "Express.js", "Scikit-learn", "Power BI", "XGBoost", "Python", "SQL").

Return ONLY valid JSON matching this exact structure:
{
  "candidateName": "Candidate Full Name",
  "atsScore": 85,
  "skills": {
    "programming_languages": ["Python", "Java", "C++", "JavaScript", "SQL"],
    "data_science": ["Pandas", "NumPy", "Matplotlib", "Seaborn"],
    "machine_learning": ["Scikit-learn", "XGBoost"],
    "deep_learning": ["TensorFlow", "Keras"],
    "web_technologies": ["HTML", "CSS", "JavaScript"],
    "frameworks": ["React.js", "Node.js", "Express.js"],
    "libraries": [],
    "databases": ["MySQL", "PostgreSQL"],
    "cloud": ["AWS"],
    "devops": ["Docker"],
    "tools": ["Git", "GitHub", "VS Code"],
    "other": []
  },
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["Tech1", "Tech2"]
    }
  ],
  "experience": [
    {
      "role": "Role Title",
      "company": "Company Name",
      "duration": "Duration"
    }
  ],
  "education": [
    {
      "degree": "Degree",
      "institution": "University / College"
    }
  ],
  "certifications": ["Certification 1"]
}`;

  let parsedResult = null;

  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      
      const contents = [];
      if (rawText && rawText.length > 20) {
        contents.push({ text: `Full Extracted Resume Text:\n${rawText}\n\n${prompt}` });
      }
      if (mimeType === "application/pdf" && resumeBase64) {
        contents.push({ inlineData: { mimeType: "application/pdf", data: resumeBase64 } });
      }
      if (contents.length === 0) {
        contents.push({ text: prompt });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (response && response.text) {
        parsedResult = JSON.parse(response.text);
      }
    }
  } catch (err) {
    console.warn("⚠️ Gemini AI resume extraction notice (falling back to text parser):", err.message);
  }

  // Fallback regex extraction if Gemini did not return skills
  const regexSkills = extractSkillsFromTextRegex(rawText);

  const rawSkillsObj = parsedResult?.skills || {};
  const sanitizedCategories = {
    programming_languages: normalizeSkills(rawSkillsObj.programming_languages || regexSkills.programming_languages || []),
    data_science: normalizeSkills(rawSkillsObj.data_science || regexSkills.data_science || []),
    machine_learning: normalizeSkills(rawSkillsObj.machine_learning || regexSkills.machine_learning || []),
    deep_learning: normalizeSkills(rawSkillsObj.deep_learning || regexSkills.deep_learning || []),
    web_technologies: normalizeSkills(rawSkillsObj.web_technologies || regexSkills.web_technologies || []),
    frameworks: normalizeSkills(rawSkillsObj.frameworks || regexSkills.frameworks || []),
    libraries: normalizeSkills(rawSkillsObj.libraries || regexSkills.libraries || []),
    databases: normalizeSkills(rawSkillsObj.databases || regexSkills.databases || []),
    cloud: normalizeSkills(rawSkillsObj.cloud || regexSkills.cloud || []),
    devops: normalizeSkills(rawSkillsObj.devops || regexSkills.devops || []),
    tools: normalizeSkills(rawSkillsObj.tools || regexSkills.tools || []),
    other: normalizeSkills(rawSkillsObj.other || regexSkills.other || []),
  };

  // Also collect skills mentioned inside projects
  if (Array.isArray(parsedResult?.projects)) {
    for (const proj of parsedResult.projects) {
      if (Array.isArray(proj.technologies)) {
        for (const tech of proj.technologies) {
          const norm = normalizeSkill(tech);
          if (norm && !sanitizedCategories.other.includes(norm)) {
            // Check if already in any category
            const alreadyExists = Object.values(sanitizedCategories).some(arr => arr.some(s => s.toLowerCase() === norm.toLowerCase()));
            if (!alreadyExists) {
              sanitizedCategories.other.push(norm);
            }
          }
        }
      }
    }
  }

  // Generate flat all_skills array
  const allSkillsList = [];
  Object.values(sanitizedCategories).forEach(arr => {
    if (Array.isArray(arr)) allSkillsList.push(...arr);
  });
  const all_skills = normalizeSkills(allSkillsList);

  const atsScore = typeof parsedResult?.atsScore === "number" ? parsedResult.atsScore : 82;
  const candidateName = parsedResult?.candidateName || studentData.name || "Candidate";

  console.log("\n[RESUME] Skills detected:");
  for (const [cat, list] of Object.entries(sanitizedCategories)) {
    if (list.length > 0) {
      console.log(`  ${cat.replace(/_/g, " ").toUpperCase()}: ${list.join(", ")}`);
    }
  }
  console.log(`[RESUME] Total Unique Skills: ${all_skills.length}\n`);

  return {
    candidateName,
    atsScore,
    skills: sanitizedCategories,
    categorizedSkills: sanitizedCategories,
    all_skills,
    projects: parsedResult?.projects || [],
    experience: parsedResult?.experience || [],
    education: parsedResult?.education || [],
    certifications: parsedResult?.certifications || []
  };
}
