/**
 * Reusable backend normalizer for student profile & resume intelligence response.
 * Authoritative source: user.resumeAnalysis
 * Backward-compatibility source: top-level User model fields
 */

export function safeArray(val) {
  return Array.isArray(val) ? val : [];
}

export function safeStringOrNull(val) {
  if (typeof val === "string" && val.trim().length > 0) {
    return val.trim();
  }
  return null;
}

export function safeNumberOrNull(val) {
  if (typeof val === "number" && !isNaN(val)) {
    return val;
  }
  return null;
}

export function normalizeProfileResponse(student) {
  if (!student) {
    return null;
  }

  const userObj = typeof student.toObject === "function" ? student.toObject() : student;
  const ra = userObj.resumeAnalysis && typeof userObj.resumeAnalysis === "object" ? userObj.resumeAnalysis : {};

  const name = safeStringOrNull(userObj.name) || safeStringOrNull(ra.candidateName) || safeStringOrNull(ra.personalInfo?.fullName) || null;
  const email = safeStringOrNull(userObj.email) || safeStringOrNull(ra.personalInfo?.email) || null;
  const phone = safeStringOrNull(userObj.phone) || safeStringOrNull(ra.personalInfo?.phone) || null;
  const portfolio = safeStringOrNull(userObj.portfolio) || safeStringOrNull(ra.personalInfo?.portfolio) || null;
  const github = safeStringOrNull(userObj.github) || safeStringOrNull(ra.personalInfo?.github) || null;
  const linkedin = safeStringOrNull(userObj.linkedin) || safeStringOrNull(ra.personalInfo?.linkedin) || null;
  const location = safeStringOrNull(ra.personalInfo?.location) || null;

  const skills = safeArray(userObj.skills).length ? safeArray(userObj.skills) : safeArray(ra.all_skills);
  const categorizedSkills = (userObj.categorizedSkills && Object.keys(userObj.categorizedSkills).length > 0)
    ? userObj.categorizedSkills
    : (ra.categorizedSkills || ra.skills || {});

  const projects = safeArray(userObj.projects).length ? safeArray(userObj.projects) : safeArray(ra.projects || ra.confirmedProjects);
  const experience = safeArray(userObj.experience).length ? safeArray(userObj.experience) : safeArray(ra.experience);
  const education = safeArray(userObj.education).length ? safeArray(userObj.education) : safeArray(ra.education);
  const certifications = safeArray(userObj.certifications).length ? safeArray(userObj.certifications) : safeArray(ra.certifications);

  const achievements = safeArray(ra.achievements);
  const publications = safeArray(ra.publications);
  const research = safeArray(ra.research);
  const leadership = safeArray(ra.leadership);
  const volunteering = safeArray(ra.volunteering);
  const languages = safeArray(ra.languages);
  const interests = safeArray(ra.interests);
  const codingProfiles = safeArray(ra.codingProfiles);
  const links = safeArray(ra.links);

  const atsScore = typeof userObj.atsScore === "number"
    ? userObj.atsScore
    : safeNumberOrNull(ra.atsScore);

  const atsBreakdown = ra.atsBreakdown && typeof ra.atsBreakdown === "object" ? ra.atsBreakdown : {};
  const readinessAnalysis = ra.readinessAnalysis && typeof ra.readinessAnalysis === "object" ? ra.readinessAnalysis : {};

  return {
    _id: userObj._id,
    id: userObj._id,
    name,
    candidateName: name,
    email,
    department: safeStringOrNull(userObj.department),
    year: safeStringOrNull(userObj.year),
    phone,
    portfolio,
    github,
    linkedin,
    personalInfo: {
      fullName: name,
      email,
      phone,
      location,
      linkedin,
      github,
      portfolio,
    },
    summary: safeStringOrNull(ra.summary),
    skills,
    categorizedSkills,
    all_skills: skills,
    projects,
    confirmedProjects: projects,
    experience,
    education,
    certifications,
    achievements,
    publications,
    research,
    leadership,
    volunteering,
    languages,
    interests,
    codingProfiles,
    links,
    atsScore,
    atsBreakdown,
    readinessAnalysis,
    strongSkills: safeArray(ra.strongSkills),
    workingSkills: safeArray(ra.workingSkills),
    mentionedSkills: safeArray(ra.mentionedSkills),
    skillsToImprove: safeArray(ra.skillsToImprove),
    primaryDomain: safeStringOrNull(ra.primaryDomain),
    secondaryDomains: safeArray(ra.secondaryDomains),
    resumeFileName: safeStringOrNull(userObj.resumeFileName),
    resumeUploadedAt: userObj.resumeUploadedAt || null,
    resumeAnalysis: userObj.resumeAnalysis || null,
    targetCompany: safeStringOrNull(userObj.targetCompany),
    profilePicture: safeStringOrNull(userObj.profilePicture),
    attemptUsed: safeNumberOrNull(userObj.attemptUsed) || 0,
  };
}
