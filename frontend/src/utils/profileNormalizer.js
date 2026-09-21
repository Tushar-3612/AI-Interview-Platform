/**
 * Reusable frontend helper functions for safe profile data mapping.
 * Ensures arrays remain arrays, missing values default to null or [] (no fake data).
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

export function normalizeProfileData(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  // Handle case where API response is wrapped as { data: { ... } } or direct object
  const root = (data.data && typeof data.data === "object" && !Array.isArray(data.data))
    ? data.data
    : data;

  const ra = root.resumeAnalysis && typeof root.resumeAnalysis === "object" ? root.resumeAnalysis : {};

  const name = safeStringOrNull(root.name) || safeStringOrNull(root.candidateName) || safeStringOrNull(ra.candidateName) || safeStringOrNull(ra.personalInfo?.fullName) || null;
  const email = safeStringOrNull(root.email) || safeStringOrNull(ra.personalInfo?.email) || null;
  const phone = safeStringOrNull(root.phone) || safeStringOrNull(ra.personalInfo?.phone) || null;
  const portfolio = safeStringOrNull(root.portfolio) || safeStringOrNull(ra.personalInfo?.portfolio) || null;
  const github = safeStringOrNull(root.github) || safeStringOrNull(ra.personalInfo?.github) || null;
  const linkedin = safeStringOrNull(root.linkedin) || safeStringOrNull(ra.personalInfo?.linkedin) || null;
  const location = safeStringOrNull(ra.personalInfo?.location) || null;

  const skills = safeArray(root.skills).length ? safeArray(root.skills) : safeArray(ra.all_skills);
  const categorizedSkills = (root.categorizedSkills && Object.keys(root.categorizedSkills).length > 0)
    ? root.categorizedSkills
    : (ra.categorizedSkills || ra.skills || {});

  const projects = safeArray(root.projects).length ? safeArray(root.projects) : safeArray(ra.projects || ra.confirmedProjects);
  const experience = safeArray(root.experience).length ? safeArray(root.experience) : safeArray(ra.experience);
  const education = safeArray(root.education).length ? safeArray(root.education) : safeArray(ra.education);
  const certifications = safeArray(root.certifications).length ? safeArray(root.certifications) : safeArray(ra.certifications);

  const achievements = safeArray(root.achievements).length ? safeArray(root.achievements) : safeArray(ra.achievements);
  const publications = safeArray(root.publications).length ? safeArray(root.publications) : safeArray(ra.publications);
  const research = safeArray(root.research).length ? safeArray(root.research) : safeArray(ra.research);
  const leadership = safeArray(root.leadership).length ? safeArray(root.leadership) : safeArray(ra.leadership);
  const volunteering = safeArray(root.volunteering).length ? safeArray(root.volunteering) : safeArray(ra.volunteering);
  const languages = safeArray(root.languages).length ? safeArray(root.languages) : safeArray(ra.languages);
  const interests = safeArray(root.interests).length ? safeArray(root.interests) : safeArray(ra.interests);
  const codingProfiles = safeArray(root.codingProfiles).length ? safeArray(root.codingProfiles) : safeArray(ra.codingProfiles);
  const links = safeArray(root.links).length ? safeArray(root.links) : safeArray(ra.links);

  const atsScore = typeof root.atsScore === "number"
    ? root.atsScore
    : safeNumberOrNull(ra.atsScore);

  const summary = safeStringOrNull(root.summary) || safeStringOrNull(ra.summary) || null;

  return {
    _id: root._id || root.id || null,
    name,
    candidateName: name,
    email,
    department: safeStringOrNull(root.department),
    year: safeStringOrNull(root.year),
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
    summary,
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
    atsBreakdown: root.atsBreakdown || ra.atsBreakdown || {},
    readinessAnalysis: root.readinessAnalysis || ra.readinessAnalysis || {},
    strongSkills: safeArray(root.strongSkills).length ? safeArray(root.strongSkills) : safeArray(ra.strongSkills),
    workingSkills: safeArray(root.workingSkills).length ? safeArray(root.workingSkills) : safeArray(ra.workingSkills),
    mentionedSkills: safeArray(root.mentionedSkills).length ? safeArray(root.mentionedSkills) : safeArray(ra.mentionedSkills),
    skillsToImprove: safeArray(root.skillsToImprove).length ? safeArray(root.skillsToImprove) : safeArray(ra.skillsToImprove),
    primaryDomain: safeStringOrNull(root.primaryDomain) || safeStringOrNull(ra.primaryDomain),
    secondaryDomains: safeArray(root.secondaryDomains).length ? safeArray(root.secondaryDomains) : safeArray(ra.secondaryDomains),
    resumeFileName: safeStringOrNull(root.resumeFileName),
    resumeUploadedAt: root.resumeUploadedAt || null,
    resumeAnalysis: root.resumeAnalysis || ra || null,
    targetCompany: safeStringOrNull(root.targetCompany),
    profilePicture: safeStringOrNull(root.profilePicture),
    attemptUsed: safeNumberOrNull(root.attemptUsed) || 0,
  };
}
