import User from "../models/User.js";
import { parseResumeComplete } from "../services/resumeParser.js";
import dotenv from "dotenv";
import { normalizeYear, normalizeDepartment } from "../utils/academicConfig.js";
import { normalizeProfileResponse } from "../utils/resumeResponseNormalizer.js";

dotenv.config();

/**
 * Get student profile details.
 */
export const getProfile = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select("-password");
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }
    const normalized = normalizeProfileResponse(student);
    res.json(normalized);
  } catch (error) {
    console.error("Get Profile Error:", error.message);
    res.status(500).json({ message: "Server error retrieving profile" });
  }
};

/**
 * Update student profile details.
 */
export const updateProfile = async (req, res) => {
  try {
    const { phone, portfolio, github, linkedin, skills, categorizedSkills, department, year, name, targetCompany } = req.body;

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    if (name) student.name = name;
    if (department) student.department = normalizeDepartment(department);
    if (year) student.year = normalizeYear(year);
    if (phone !== undefined) student.phone = phone;
    if (portfolio !== undefined) student.portfolio = portfolio;
    if (github !== undefined) student.github = github;
    if (linkedin !== undefined) student.linkedin = linkedin;
    if (skills !== undefined) student.skills = skills;
    if (categorizedSkills !== undefined) student.categorizedSkills = categorizedSkills;
    if (targetCompany !== undefined) student.targetCompany = targetCompany;

    await student.save();

    const normalized = normalizeProfileResponse(student);
    res.json({
      message: "Profile updated successfully",
      user: normalized,
      data: normalized,
    });
  } catch (error) {
    console.error("Update Profile Error:", error.message);
    res.status(500).json({ message: "Server error updating profile" });
  }
};

/**
 * Upload Resume PDF/DOCX, extract complete Phase 1-6 intelligence, compute dynamic ATS score, and replace user profile data.
 */
export const uploadResumeAndAnalyze = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"
    ];
    const fileNameLower = (req.file.originalname || "").toLowerCase();
    const isPdfOrDocx = allowedMimeTypes.includes(req.file.mimetype) || fileNameLower.endsWith(".pdf") || fileNameLower.endsWith(".docx");

    if (!isPdfOrDocx) {
      return res.status(400).json({ message: "Only PDF and DOCX resume files are allowed." });
    }

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    console.log(`\n===== RESUME UPLOAD FOR: ${student.name} (${req.file.originalname}) =====`);

    const resumeBase64 = req.file.buffer.toString("base64");
    const parsed = await parseResumeComplete(req.file.buffer, req.file.mimetype, student);

    if (parsed.extractionMetadata && parsed.extractionMetadata.extractionSuccess === false) {
      return res.status(400).json({
        message: parsed.warnings?.[0] || "Failed to extract text from uploaded resume.",
        warnings: parsed.warnings || [],
      });
    }

    // Comprehensive Phase 1-6 resume analysis context object
    const resumeAnalysisObj = {
      candidateName: parsed.candidateName || student.name,
      personalInfo: parsed.personalInfo || {},
      summary: parsed.summary || "",
      atsScore: typeof parsed.atsScore === "number" ? parsed.atsScore : null,
      atsBreakdown: parsed.atsBreakdown || {},
      confirmedProjects: parsed.projects || parsed.confirmedProjects || [],
      confirmedSkills: parsed.all_skills || [],
      skills: parsed.categorizedSkills || parsed.skills || {},
      categorizedSkills: parsed.categorizedSkills || parsed.skills || {},
      all_skills: parsed.all_skills || [],
      projects: parsed.projects || parsed.confirmedProjects || [],
      experience: parsed.experience || [],
      education: parsed.education || [],
      certifications: parsed.certifications || [],
      achievements: parsed.achievements || [],
      publications: parsed.publications || [],
      research: parsed.research || [],
      leadership: parsed.leadership || [],
      volunteering: parsed.volunteering || [],
      languages: parsed.languages || [],
      interests: parsed.interests || [],
      codingProfiles: parsed.codingProfiles || [],
      links: parsed.links || [],
      strongSkills: parsed.strongSkills || [],
      workingSkills: parsed.workingSkills || [],
      mentionedSkills: parsed.mentionedSkills || [],
      skillsToImprove: parsed.skillsToImprove || [],
      primaryDomain: parsed.primaryDomain || "Software Engineering",
      secondaryDomains: parsed.secondaryDomains || [],
      readinessAnalysis: parsed.readinessAnalysis || {},
      analyzedAt: new Date(),
    };

    // Atomically replace resume-derived fields on student's User document from exact same normalized object
    student.resumeFileName = req.file.originalname;
    student.resumeUploadedAt = new Date();
    student.resumeBase64 = resumeBase64;
    student.atsScore = resumeAnalysisObj.atsScore;
    student.skills = parsed.all_skills || [];
    student.categorizedSkills = parsed.categorizedSkills || parsed.skills || {};
    student.projects = parsed.projects || parsed.confirmedProjects || [];
    student.experience = parsed.experience || [];
    student.education = parsed.education || [];
    student.certifications = parsed.certifications || [];
    student.resumeAnalysis = resumeAnalysisObj;

    // Auto-fill candidate contact info if currently blank
    if (!student.phone && parsed.personalInfo?.phone) student.phone = parsed.personalInfo.phone;
    if (!student.github && parsed.personalInfo?.github) student.github = parsed.personalInfo.github;
    if (!student.linkedin && parsed.personalInfo?.linkedin) student.linkedin = parsed.personalInfo.linkedin;
    if (!student.portfolio && parsed.personalInfo?.portfolio) student.portfolio = parsed.personalInfo.portfolio;

    await student.save();

    const normalized = normalizeProfileResponse(student);

    res.json({
      success: true,
      message: "Resume analyzed and profile skills updated successfully",
      user: normalized,
      data: normalized,
      ...normalized,
      warnings: parsed.warnings || [],
    });
  } catch (error) {
    console.error("Resume Upload Error:", error);
    res.status(500).json({
      message: "Resume analysis failed",
      error: error.message,
    });
  }
};

/**
 * Download uploaded resume PDF
 */
export const downloadResume = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student || !student.resumeBase64) {
      return res.status(404).json({ message: "No resume found. Please upload your resume first." });
    }
    const pdfBuffer = Buffer.from(student.resumeBase64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${student.resumeFileName || "Candidate_Resume.pdf"}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Download Resume Error:", error.message);
    res.status(500).json({ message: "Failed to download resume" });
  }
};

/**
 * View uploaded resume PDF in browser
 */
export const viewResume = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student || !student.resumeBase64) {
      return res.status(404).json({ message: "No resume found. Please upload your resume first." });
    }
    const pdfBuffer = Buffer.from(student.resumeBase64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${student.resumeFileName || "Candidate_Resume.pdf"}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("View Resume Error:", error.message);
    res.status(500).json({ message: "Failed to view resume" });
  }
};

/**
 * Update target company for current student.
 */
export const updateTargetCompany = async (req, res) => {
  try {
    const { targetCompany } = req.body;
    
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    student.targetCompany = targetCompany || "";
    await student.save();
    
    res.json({ 
      message: "Target company updated successfully",
      targetCompany: student.targetCompany 
    });
  } catch (error) {
    console.error("Update Target Company Error:", error.message);
    res.status(500).json({ message: "Server error updating target company" });
  }
};
