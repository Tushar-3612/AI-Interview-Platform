import User from "../models/User.js";
import { parseResumeComplete } from "../services/resumeParser.js";
import dotenv from "dotenv";
import { normalizeYear, normalizeDepartment } from "../utils/academicConfig.js";

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
    res.json(student);
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

    res.json({
      message: "Profile updated successfully",
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        department: student.department,
        year: student.year,
        phone: student.phone,
        skills: student.skills,
        categorizedSkills: student.categorizedSkills,
        all_skills: student.skills,
        portfolio: student.portfolio,
        github: student.github,
        linkedin: student.linkedin,
        atsScore: student.atsScore,
        resumeFileName: student.resumeFileName,
        targetCompany: student.targetCompany,
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error.message);
    res.status(500).json({ message: "Server error updating profile" });
  }
};

/**
 * Upload Resume PDF, extract complete skills across all categories, compute ATS score, and update user profile.
 */
export const uploadResumeAndAnalyze = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Only PDF resumes are allowed" });
    }

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    console.log(`\n===== RESUME UPLOAD FOR: ${student.name} (${req.file.originalname}) =====`);

    const resumeBase64 = req.file.buffer.toString("base64");
    const parsed = await parseResumeComplete(req.file.buffer, req.file.mimetype, student);

    // Save details to student's User document
    student.resumeFileName = req.file.originalname;
    student.resumeUploadedAt = new Date();
    student.resumeBase64 = resumeBase64;
    student.atsScore = parsed.atsScore || 82;
    student.skills = parsed.all_skills || [];
    student.categorizedSkills = parsed.categorizedSkills || parsed.skills || {};
    student.projects = parsed.projects || [];
    student.experience = parsed.experience || [];
    student.education = parsed.education || [];
    student.certifications = parsed.certifications || [];
    await student.save();

    res.json({
      message: "Resume analyzed and profile skills updated successfully",
      atsScore: student.atsScore,
      skills: student.skills,
      categorizedSkills: student.categorizedSkills,
      all_skills: student.skills,
      resumeFileName: student.resumeFileName,
      resumeUploadedAt: student.resumeUploadedAt,
      projects: parsed.projects || [],
      experience: parsed.experience || [],
      education: parsed.education || [],
      certifications: parsed.certifications || []
    });
  } catch (error) {
    console.error("Resume Upload/Analyze Error:", error.message);
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
