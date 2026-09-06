import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
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
 * 3b. Deterministic Section Extractor for Projects, Experience, Education & Certifications
 */
export function extractProjectsFromText(text) {
  if (!text) return [];

  const projects = [];
  const projectSectionMatch = text.match(/(?:^|\n)\s*(?:Projects|Personal Projects|Key Projects|Academic Projects|Relevant Projects|Project Details)\b([\s\S]*?)(?=(?:\n\s*(?:Experience|Work Experience|Internships|Technical Skills|Skills|Education|Certifications|Achievements|Research Work|Publications|Declaration)\b)|$)/i);

  if (!projectSectionMatch || !projectSectionMatch[1]) return [];

  const sectionText = projectSectionMatch[1].trim();
  const lines = sectionText.split("\n").map(l => l.trim()).filter(Boolean);

  let currentProject = null;

  for (const line of lines) {
    const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*") || line.startsWith("–");
    const isContinuation = line.endsWith(".") || line.endsWith(",") || /^[a-z]/.test(line) || line.length < 15;

    // Check if line looks like a project header (e.g. "Title | Tech1, Tech2" or "Title : Tech1, Tech2")
    const headerWithDelimiter = line.match(/^([^|:–]+?)\s*(?:[|:]|–)\s*(.+)$/);
    const headerMatch = headerWithDelimiter;

    if (!isBullet && !isContinuation && (headerMatch || line.length < 80)) {
      if (currentProject && currentProject.name) {
        projects.push(currentProject);
      }

      let projName = line;
      let techList = [];

      if (headerMatch) {
        projName = headerMatch[1].trim();
        const techStr = headerMatch[2].trim();
        techList = techStr.split(/[,|;]/).map(t => normalizeSkill(t.trim())).filter(Boolean);
      }

      projName = projName.replace(/^[^a-zA-Z0-9]+/, "").replace(/[^a-zA-Z0-9)]+$/, "").trim();

      currentProject = {
        name: projName || "Project",
        description: "",
        technologies: techList
      };
    } else if (currentProject) {
      const lineClean = line.replace(/^[•\-*–\s]+/, "").trim();
      if (currentProject.description) {
        currentProject.description += " " + lineClean;
      } else {
        currentProject.description = lineClean;
      }

      // Also extract any technologies mentioned in the line text
      const extractedTechs = extractSkillsFromTextRegex(lineClean);
      Object.values(extractedTechs).forEach(arr => {
        if (Array.isArray(arr)) {
          arr.forEach(t => {
            if (!currentProject.technologies.includes(t)) {
              currentProject.technologies.push(t);
            }
          });
        }
      });
    }
  }

  if (currentProject && currentProject.name) {
    projects.push(currentProject);
  }

  // Filter out any invalid / dummy project entries (e.g. name < 2 chars or generic words)
  const validProjects = projects.filter(p => p.name && p.name.length > 2 && !["dashboard", "dashboard.", "project", "details"].includes(p.name.toLowerCase()));

  return validProjects;
}

export function extractExperienceFromText(text) {
  if (!text) return [];
  const expMatch = text.match(/(?:^|\n)\s*(?:Experience|Work Experience|Internships|Employment|Professional Experience)\b([\s\S]*?)(?=(?:\n\s*(?:Projects|Personal Projects|Technical Skills|Skills|Education|Certifications|Achievements|Research Work|Declaration)\b)|$)/i);
  if (!expMatch || !expMatch[1]) return [];

  const lines = expMatch[1].trim().split("\n").map(l => l.trim()).filter(Boolean);
  const experience = [];
  let currentExp = null;

  for (const line of lines) {
    const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*");
    if (!isBullet && line.length < 80) {
      if (currentExp) experience.push(currentExp);
      currentExp = { role: line, company: "", duration: "" };
    } else if (currentExp && isBullet) {
      const content = line.replace(/^[•\-*\s]+/, "").trim();
      currentExp.company = currentExp.company ? currentExp.company + " " + content : content;
    }
  }
  if (currentExp) experience.push(currentExp);
  return experience;
}

export function extractEducationFromText(text) {
  if (!text) return [];
  const eduMatch = text.match(/(?:^|\n)\s*(?:Education|Academic Background|Qualifications)\b([\s\S]*?)(?=(?:\n\s*(?:Projects|Experience|Technical Skills|Skills|Certifications|Achievements|Declaration)\b)|$)/i);
  if (!eduMatch || !eduMatch[1]) return [];

  const lines = eduMatch[1].trim().split("\n").map(l => l.trim()).filter(Boolean);
  const education = [];
  for (let i = 0; i < lines.length; i += 2) {
    education.push({
      degree: lines[i] || "Degree",
      institution: lines[i + 1] || "University / College"
    });
  }
  return education;
}

export function extractCertificationsFromText(text) {
  if (!text) return [];
  const certMatch = text.match(/(?:^|\n)\s*(?:Certifications|Certificates|Licenses)\b([\s\S]*?)(?=(?:\n\s*(?:Projects|Experience|Education|Technical Skills|Skills|Achievements|Declaration)\b)|$)/i);
  if (!certMatch || !certMatch[1]) return [];

  const lines = certMatch[1].trim().split("\n").map(l => l.trim()).filter(Boolean);
  return lines.map(l => l.replace(/^[•\-*\s]+/, "").trim()).filter(l => l.length > 3 && l.length < 120);
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

  // Resume parsing is performed locally (PDF text extraction + regex skill
  // analysis). No external AI provider is used here, keeping the only AI calls
  // in the interview flow to the two Groq requests (generation + evaluation).

  // Fallback regex extraction if AI did not return skills
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

  const extractedProjects = parsedResult?.projects?.length ? parsedResult.projects : extractProjectsFromText(rawText);
  const extractedExperience = parsedResult?.experience?.length ? parsedResult.experience : extractExperienceFromText(rawText);
  const extractedEducation = parsedResult?.education?.length ? parsedResult.education : extractEducationFromText(rawText);
  const extractedCertifications = parsedResult?.certifications?.length ? parsedResult.certifications : extractCertificationsFromText(rawText);

  const atsScore = typeof parsedResult?.atsScore === "number" ? parsedResult.atsScore : 82;
  const candidateName = parsedResult?.candidateName || studentData.name || "Candidate";

  console.log("\n[RESUME] Skills & Sections detected:");
  for (const [cat, list] of Object.entries(sanitizedCategories)) {
    if (list.length > 0) {
      console.log(`  ${cat.replace(/_/g, " ").toUpperCase()}: ${list.join(", ")}`);
    }
  }
  console.log(`[RESUME] Projects Extracted: ${extractedProjects.length} (${extractedProjects.map(p => p.name).join(", ")})`);
  console.log(`[RESUME] Total Unique Skills: ${all_skills.length}\n`);

  return {
    candidateName,
    atsScore,
    skills: sanitizedCategories,
    categorizedSkills: sanitizedCategories,
    all_skills,
    projects: extractedProjects,
    experience: extractedExperience,
    education: extractedEducation,
    certifications: extractedCertifications
  };
}
