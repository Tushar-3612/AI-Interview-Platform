import mongoose from "mongoose";
import crypto from "crypto";
import User from "../models/User.js";
import { parseResumeComplete, normalizeSkill } from "../services/resumeParser.js";

/**
 * Common list of technology keywords used to audit generated questions for resume grounding.
 */
const KNOWN_TECH_KEYWORDS = [
  "Python", "Java", "C++", "C#", "C", "JavaScript", "TypeScript", "SQL", "Go", "Rust", "Kotlin", "Swift", "PHP", "Ruby", "R", "Scala", "Dart",
  "React", "React.js", "Next.js", "Node.js", "Express", "Express.js", "FastAPI", "Django", "Flask", "Spring Boot", "Spring", "Angular", "Vue.js", "Vue",
  "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Redis", "Cassandra", "Oracle", "DynamoDB", "Firebase", "Supabase",
  "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud Platform", "Heroku", "Vercel", "Netlify",
  "Docker", "Kubernetes", "K8s", "CI/CD", "Jenkins", "Terraform", "Ansible", "Linux", "Nginx",
  "Redux", "Axios", "Prisma", "Mongoose", "GraphQL", "REST APIs", "WebSockets", "Kafka", "RabbitMQ",
  "Pandas", "NumPy", "Matplotlib", "Seaborn", "Scikit-learn", "XGBoost", "TensorFlow", "Keras", "PyTorch", "OpenCV", "NLTK", "Spacy", "Transformers", "BERT", "Power BI", "Tableau"
];

/**
 * Computes a deterministic hash representation for a candidate's resume context.
 * Used for resume-isolated question history tracking.
 */
export function computeResumeHash(resumeContext = {}, studentDoc = null) {
  const normSkills = (resumeContext.skills || []).map((s) => String(s).toLowerCase().trim()).sort().join("|");
  const normProjects = (resumeContext.projects || []).map((p) => {
    const name = String(p.name || "").toLowerCase().trim();
    const techs = Array.isArray(p.technologies) ? p.technologies.map((t) => String(t).toLowerCase().trim()).sort().join(",") : "";
    return `${name}:${techs}`;
  }).sort().join("|");
  const normExp = (resumeContext.experience || []).map((e) => String(e.company || e.title || "").toLowerCase().trim()).sort().join("|");
  const normEdu = (resumeContext.education || []).map((e) => String(e.degree || e.institution || "").toLowerCase().trim()).sort().join("|");
  const fileName = String(studentDoc?.resumeFileName || "").toLowerCase().trim();
  const uploadedAt = studentDoc?.resumeUploadedAt ? new Date(studentDoc.resumeUploadedAt).getTime() : "";

  const rawStr = `file:${fileName};uploaded:${uploadedAt};skills:${normSkills};projects:${normProjects};exp:${normExp};edu:${normEdu}`;
  return crypto.createHash("sha256").update(rawStr).digest("hex").slice(0, 16);
}

/**
 * Fetches and builds structured candidate resume context from MongoDB User record,
 * supplemented by bodyProfile and dynamic fallback parsing if required.
 *
 * @param {string} userId - Authenticated student User ID
 * @param {Object} bodyProfile - Candidate profile payload sent from frontend
 * @returns {Promise<Object>} Structured resume context
 */
export async function getOrBuildCandidateResumeContext(userId = null, bodyProfile = {}) {
  let student = null;
  if (userId) {
    try {
      student = await User.findById(userId).lean();
    } catch (err) {
      console.warn(`[RESUME-CONTEXT] Failed to fetch User by ID ${userId}:`, err.message);
    }
  }

  let skills = student?.skills?.length ? student.skills : (bodyProfile?.skills || bodyProfile?.all_skills || bodyProfile?.extractedSkills || []);
  let categorizedSkills = student?.categorizedSkills && Object.keys(student.categorizedSkills).length > 0
    ? student.categorizedSkills
    : (bodyProfile?.categorizedSkills || {});
  let projects = Array.isArray(student?.projects) && student.projects.length > 0
    ? student.projects
    : (Array.isArray(bodyProfile?.projects) ? bodyProfile.projects : (Array.isArray(bodyProfile?.parsedProjects) ? bodyProfile.parsedProjects : []));
  let experience = Array.isArray(student?.experience) && student.experience.length > 0
    ? student.experience
    : (Array.isArray(bodyProfile?.experience) ? bodyProfile.experience : []);
  let education = Array.isArray(student?.education) && student.education.length > 0
    ? student.education
    : (Array.isArray(bodyProfile?.education) ? bodyProfile.education : []);
  let certifications = Array.isArray(student?.certifications) && student.certifications.length > 0
    ? student.certifications
    : (Array.isArray(bodyProfile?.certifications) ? bodyProfile.certifications : []);

  // Lookup from Interview model's resumeSnapshot if skills or projects are missing
  if ((!projects.length || !skills.length) && (bodyProfile?.sessionId || bodyProfile?.interviewId || userId)) {
    try {
      const interviewId = bodyProfile?.sessionId || bodyProfile?.interviewId;
      const Interview = mongoose.models.Interview;
      if (Interview) {
        const interview = interviewId
          ? await Interview.findById(interviewId).lean()
          : await Interview.findOne({ userId }).sort({ createdAt: -1 }).lean();

        if (interview?.resumeSnapshot) {
          const snap = interview.resumeSnapshot;
          if (!skills.length && (snap.skills?.length || snap.all_skills?.length)) {
            skills = snap.skills || snap.all_skills;
          }
          if (!projects.length && (snap.projects?.length || snap.parsedProjects?.length)) {
            projects = snap.projects || snap.parsedProjects;
          }
          if (!Object.keys(categorizedSkills).length && snap.categorizedSkills) {
            categorizedSkills = snap.categorizedSkills;
          }
        }
      }
    } catch (e) {
      console.warn("[RESUME-CONTEXT] Interview snapshot lookup warning:", e.message);
    }
  }

  // Fallback: If projects or categorizedSkills are missing, but resumeBase64 is available, perform local parsing
  if ((!projects.length || !skills.length) && student?.resumeBase64) {
    try {
      console.log(`[RESUME-CONTEXT] Stored profile missing detailed projects/skills. Parsing stored resumeBase64 for user ${userId}...`);
      const fileBuffer = Buffer.from(student.resumeBase64, "base64");
      const parsed = await parseResumeComplete(fileBuffer, "application/pdf", student);
      if (parsed) {
        skills = parsed.all_skills || skills;
        categorizedSkills = parsed.categorizedSkills || categorizedSkills;
        projects = parsed.projects?.length ? parsed.projects : projects;
        experience = parsed.experience?.length ? parsed.experience : experience;
        education = parsed.education?.length ? parsed.education : education;
        certifications = parsed.certifications?.length ? parsed.certifications : certifications;

        // Persist parsed findings back to User document silently
        User.findByIdAndUpdate(userId, {
          skills,
          categorizedSkills,
          projects,
          experience,
          education,
          certifications,
        }).catch((e) => console.warn("[RESUME-CONTEXT] Async update warning:", e.message));
      }
    } catch (parseErr) {
      console.warn("[RESUME-CONTEXT] On-demand resume parsing warning:", parseErr.message);
    }
  }

  // Normalize project entries and filter out fragments/technology names
  const techNameSet = new Set(KNOWN_TECH_KEYWORDS.map(k => k.toLowerCase()));
  const genericWords = new Set(["workflows", "workflow", "control", "dashboards", "dashboard", "communication", "generation", "based", "system", "management", "project", "details", "implementation", "features", "functionality", "using", "with", "technology", "technologies"]);

  const normalizedProjects = projects.map((p) => {
    if (typeof p === "string") {
      return { name: p.trim(), description: "", technologies: [] };
    }
    return {
      name: p.name || p.title || "Project",
      description: p.description || p.summary || "",
      technologies: Array.isArray(p.technologies) ? p.technologies : (p.techStack || []),
    };
  }).filter((p) => {
    const name = (p.name || "").trim();
    if (!name || name.length < 4) return false;
    // Filter out entries that are just technology names (e.g., "React.js", "HTML", "ESP32")
    if (techNameSet.has(name.toLowerCase())) return false;
    // Filter out generic single words or short fragments
    if (name.split(/\s+/).length === 1 && genericWords.has(name.toLowerCase())) return false;
    // Filter out entries that look like description fragments (contain "based on", "using", etc.)
    if (/^(?:based on|using|with|for|the|a|an)\b/i.test(name)) return false;
    // Filter out entries that are clearly not project titles (too short and no description)
    if (name.length < 8 && (!p.description || p.description.length < 10)) return false;
    return true;
  }).filter((p, idx, arr) => {
    // Deduplicate by normalized name
    const normalizedName = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return arr.findIndex(x => x.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedName) === idx;
  });

  // Extract explicit skill categories
  const programmingLanguages = categorizedSkills.programming_languages || bodyProfile?.programmingLanguages || [];
  const frameworks = categorizedSkills.frameworks || bodyProfile?.frameworks || [];
  const databases = categorizedSkills.databases || bodyProfile?.databases || [];
  const cloud = categorizedSkills.cloud || bodyProfile?.cloud || [];
  const tools = categorizedSkills.tools || bodyProfile?.tools || [];
  const webTechnologies = categorizedSkills.web_technologies || [];
  const devops = categorizedSkills.devops || [];
  const libraries = categorizedSkills.libraries || [];

  // Build lowercase canonical set of all candidate technologies
  const allTechSet = new Set();
  const addTech = (item) => {
    if (!item || typeof item !== "string") return;
    const norm = normalizeSkill(item).toLowerCase().trim();
    if (norm) allTechSet.add(norm);
    const raw = item.toLowerCase().trim();
    if (raw) allTechSet.add(raw);

    // Canonical technology aliases
    if (raw.includes("react")) { allTechSet.add("react"); allTechSet.add("react.js"); allTechSet.add("javascript"); allTechSet.add("js"); }
    if (raw.includes("node")) { allTechSet.add("node"); allTechSet.add("node.js"); allTechSet.add("javascript"); allTechSet.add("js"); }
    if (raw.includes("express")) { allTechSet.add("express"); allTechSet.add("express.js"); allTechSet.add("javascript"); allTechSet.add("js"); }
    if (raw.includes("vue")) { allTechSet.add("vue"); allTechSet.add("vue.js"); allTechSet.add("javascript"); allTechSet.add("js"); }
    if (raw.includes("next")) { allTechSet.add("next"); allTechSet.add("next.js"); allTechSet.add("javascript"); allTechSet.add("js"); }
    if (raw === "js" || raw === "javascript") { allTechSet.add("js"); allTechSet.add("javascript"); }
    if (raw === "ts" || raw === "typescript") { allTechSet.add("ts"); allTechSet.add("typescript"); }
    if (raw === "c++" || raw === "cpp") { allTechSet.add("c++"); allTechSet.add("cpp"); }
    if (raw.includes("postgres")) { allTechSet.add("postgres"); allTechSet.add("postgresql"); allTechSet.add("sql"); }
    if (raw.includes("mysql")) { allTechSet.add("mysql"); allTechSet.add("sql"); }
    if (raw.includes("mongo")) { allTechSet.add("mongo"); allTechSet.add("mongodb"); allTechSet.add("nosql"); }
    if (raw.includes("aws") || raw.includes("amazon web services")) { allTechSet.add("aws"); allTechSet.add("amazon web services"); }
    if (raw.includes("spring")) { allTechSet.add("spring"); allTechSet.add("spring boot"); allTechSet.add("java"); }
  };

  skills.forEach(addTech);
  Object.values(categorizedSkills).forEach((arr) => {
    if (Array.isArray(arr)) arr.forEach(addTech);
  });

  normalizedProjects.forEach((p) => {
    if (Array.isArray(p.technologies)) p.technologies.forEach(addTech);
  });

  const fullName = student?.name || bodyProfile?.fullName || bodyProfile?.name || "Candidate";

  const tempContext = {
    fullName,
    skills,
    categorizedSkills,
    programmingLanguages,
    frameworks,
    databases,
    cloud,
    tools,
    webTechnologies,
    devops,
    libraries,
    projects: normalizedProjects,
    experience,
    education,
    certifications,
    allCandidateTechSet: allTechSet,
  };

  const resumeHash = computeResumeHash(tempContext, student);

  console.log("\n[REAL-INTERVIEW][RESUME-CONTEXT]");
  console.log(`resumeHash: ${resumeHash}`);
  console.log(`skills: [${skills.join(", ")}]`);
  console.log(`projects: ${JSON.stringify(normalizedProjects.map(p => ({ name: p.name, technologies: p.technologies })))}`);
  console.log(`experience: ${JSON.stringify(experience)}`);
  console.log(`education: ${JSON.stringify(education)}`);
  console.log(`certifications: ${JSON.stringify(certifications)}\n`);

  return {
    ...tempContext,
    resumeHash,
  };
}

/**
 * Validates if a generated question is strictly grounded in the supplied candidate resume context.
 *
 * @param {Object} questionObj - Generated question object
 * @param {string} roundType - "technical" | "project" | "hr" | "coding"
 * @param {Object} resumeContext - Candidate resume context returned by getOrBuildCandidateResumeContext
 * @returns {boolean} True if grounded, false if unsupported by resume
 */
export function isQuestionGroundedInResume(questionObj, roundType, resumeContext = {}) {
  if (!questionObj || !questionObj.question) return false;

  const candidateTechSet = resumeContext.allCandidateTechSet || new Set();
  const qText = String(questionObj.question || "");
  const qLower = qText.toLowerCase();
  const qTopic = String(questionObj.topic || "").toLowerCase();
  const qSkill = String(questionObj.relatedSkill || "").toLowerCase();

  // Sort KNOWN_TECH_KEYWORDS by length descending so longer keywords (e.g. C++, React.js) match before shorter substrings (e.g. C, React)
  const sortedKeywords = [...KNOWN_TECH_KEYWORDS].sort((a, b) => b.length - a.length);

  // 1. Technical Round Grounding Check
  if (roundType === "technical") {
    if (candidateTechSet.size === 0) return true;

    // Check implementation claim wording: if question says "How did you implement..." without explicit project feature detail
    const claimsImplementation = /\bhow did you (?:implement|build|design|handle|develop|create)\b/i.test(qLower) &&
      !/\bhow (?:would|could|can|do) you\b/i.test(qLower);

    for (const kw of sortedKeywords) {
      const kwLower = kw.toLowerCase();
      // Handle single-letter / special boundary keywords like "C", "R", "C++", "C#"
      let regex;
      if (kwLower === "c" || kwLower === "r") {
        regex = new RegExp(`(^|[^a-zA-Z0-9+#])${kwLower}($|[^a-zA-Z0-9+#])`, "i");
      } else {
        regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      }

      if (regex.test(qLower) || regex.test(qTopic) || regex.test(qSkill)) {
        if (!candidateTechSet.has(kwLower)) {
          if (["operating systems", "computer networks", "data structures", "software engineering", "object-oriented programming"].includes(kwLower)) {
            continue;
          }
          console.warn(`[GROUNDING-GATE][TECHNICAL] REJECTED question (unmentioned technology '${kw}'): "${qText.slice(0, 80)}..."`);
          return false;
        }

        // If technology IS in tech stack, but question claims "How did you implement [feature] in your project..." when only technology is listed
        if (claimsImplementation && !qText.toLowerCase().includes("how would you") && !qText.toLowerCase().includes("how could you")) {
          // Check if candidate resume has explicit project feature detail for this
          const hasProjectDetail = (resumeContext.projects || []).some((p) => {
            const desc = (p.description || "").toLowerCase();
            return desc.includes(kwLower);
          });
          if (!hasProjectDetail) {
            console.warn(`[GROUNDING-GATE][TECHNICAL] REJECTED implementation claim wording for '${kw}' (no explicit feature detail): "${qText.slice(0, 80)}..."`);
            return false;
          }
        }
      }
    }
    return true;
  }

  // 2. Project Round Grounding Check (Claim-Level Factual Evidence Validation)
  if (roundType === "project") {
    const candidateProjects = resumeContext.projects || [];
    if (candidateProjects.length === 0) return true;

    const targetProjName = String(questionObj.projectName || "").toLowerCase();
    
    // Find the specific project in candidate's resume
    const matchedProj = candidateProjects.find((p) => {
      const pName = String(p.name || p.title || "").toLowerCase();
      return pName && (pName.includes(targetProjName) || targetProjName.includes(pName));
    });

    // Build project explicit evidence string (description + project technologies)
    const projTechs = matchedProj?.technologies || [];
    const projDesc = String(matchedProj?.description || "").toLowerCase();
    const projTechSet = new Set(projTechs.map((t) => String(t).toLowerCase().trim()));

    // Expand project tech aliases
    projTechs.forEach((t) => {
      const tLower = String(t).toLowerCase();
      if (tLower.includes("react")) { projTechSet.add("react"); projTechSet.add("react.js"); }
      if (tLower.includes("node")) { projTechSet.add("node"); projTechSet.add("node.js"); }
      if (tLower.includes("express")) { projTechSet.add("express"); projTechSet.add("express.js"); }
      if (tLower.includes("mysql") || tLower.includes("postgres") || tLower.includes("mongodb") || tLower.includes("jdbc") || tLower.includes("sql")) {
        projTechSet.add("database"); projTechSet.add("db"); projTechSet.add("sql"); projTechSet.add("schema");
      }
      if (tLower.includes("fastapi") || tLower.includes("rest") || tLower.includes("express")) {
        projTechSet.add("api"); projTechSet.add("rest"); projTechSet.add("endpoint");
      }
      if (tLower.includes("docker") || tLower.includes("aws") || tLower.includes("kubernetes")) {
        projTechSet.add("deploy"); projTechSet.add("devops"); projTechSet.add("cloud");
      }
    });

    // Factual Claim Checks against target project evidence:

    // Claim: Database / Schema / Concurrency / Transactions
    if (qLower.includes("database schema") || qLower.includes("database design") || qLower.includes("concurrent operations") || qLower.includes("data integrity")) {
      const hasDbEvidence = projTechSet.has("database") || projTechSet.has("mysql") || projTechSet.has("mongodb") || projDesc.includes("database") || projDesc.includes("sql") || projDesc.includes("records");
      if (!hasDbEvidence) {
        console.warn(`[GROUNDING-GATE][PROJECT] REJECTED question (unsupported Database claim for '${questionObj.projectName}'): "${qText.slice(0, 80)}..."`);
        return false;
      }
    }

    // Claim: Authentication / Authorization / Security Implementation (JWT, OAuth, RBAC)
    if (qLower.includes("authentication") || qLower.includes("authorization") || qLower.includes("jwt") || qLower.includes("oauth") || qLower.includes("rbac")) {
      const hasAuthEvidence = projDesc.includes("auth") || projDesc.includes("secure") || projTechSet.has("auth") || projTechSet.has("jwt");
      if (!hasAuthEvidence) {
        console.warn(`[GROUNDING-GATE][PROJECT] REJECTED question (unsupported Authentication claim for '${questionObj.projectName}'): "${qText.slice(0, 80)}..."`);
        return false;
      }
    }

    // Claim: Deployment / Server Monitoring / Downtime / Docker / Kubernetes
    if (qLower.includes("deploy") || qLower.includes("runtime health") || qLower.includes("server downtime") || qLower.includes("docker") || qLower.includes("kubernetes") || qLower.includes("ci/cd")) {
      const hasDeployEvidence = projTechSet.has("docker") || projTechSet.has("deploy") || projTechSet.has("aws") || projDesc.includes("deploy") || projDesc.includes("cloud");
      if (!hasDeployEvidence) {
        console.warn(`[GROUNDING-GATE][PROJECT] REJECTED question (unsupported Deployment claim for '${questionObj.projectName}'): "${qText.slice(0, 80)}..."`);
        return false;
      }
    }

    // Claim: Caching / Redis / CDN
    if (qLower.includes("caching") || qLower.includes("redis") || qLower.includes("cdn")) {
      const hasCacheEvidence = projTechSet.has("redis") || projTechSet.has("cache") || projDesc.includes("cache") || projDesc.includes("redis");
      if (!hasCacheEvidence) {
        console.warn(`[GROUNDING-GATE][PROJECT] REJECTED question (unsupported Caching claim for '${questionObj.projectName}'): "${qText.slice(0, 80)}..."`);
        return false;
      }
    }

    // Claim: Check if question mentions any technology NOT explicitly in the project's tech stack or description
    for (const kw of sortedKeywords) {
      const kwLower = kw.toLowerCase();
      let regex;
      if (kwLower === "c" || kwLower === "r") {
        regex = new RegExp(`(^|[^a-zA-Z0-9+#])${kwLower}($|[^a-zA-Z0-9+#])`, "i");
      } else {
        regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      }

      if (regex.test(qLower) || regex.test(qTopic)) {
        const inProjTech = projTechSet.has(kwLower) || projDesc.includes(kwLower);
        const isCoreEngWord = ["project", "software", "code", "architecture", "system", "testing", "design", "performance"].includes(kwLower);
        if (!inProjTech && !isCoreEngWord) {
          console.warn(`[GROUNDING-GATE][PROJECT] REJECTED question (unmentioned project tech '${kw}' for '${questionObj.projectName}'): "${qText.slice(0, 80)}..."`);
          return false;
        }
      }
    }

    return true;
  }

  // HR & Coding rounds match basic valid profile context
  return true;
}
