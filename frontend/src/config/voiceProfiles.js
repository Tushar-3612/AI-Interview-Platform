/**
 * Voice Configuration Profiles for AI Interviewer Text-to-Speech (TTS)
 * Separates voice audio configuration (rate, pitch, volume, style) from interview logic.
 */

export const VOICE_PROFILES = {
  hr: {
    key: "hr",
    label: "HR & Behavioral",
    pitch: 0.92,
    rate: 0.94,
    volume: 1.0,
    style: "Professional & Professional Warmth",
    description: "Mature, balanced corporate tone suitable for background and experience discussions."
  },
  technical: {
    key: "technical",
    label: "Technical Engineering",
    pitch: 0.88,
    rate: 0.90,
    volume: 1.0,
    style: "Deep, Calm & Analytical",
    description: "Deep, authoritative, slightly serious tone suitable for senior technical architecture questions."
  },
  coding: {
    key: "coding",
    label: "Coding & Algorithms",
    pitch: 0.86,
    rate: 0.88,
    volume: 1.0,
    style: "Calm & Focused",
    description: "Slower pace with clear articulation for problem statements."
  }
};

/**
 * Auto-detects the appropriate voice profile based on section/topic strings.
 */
export function getVoiceProfile(section = "", topic = "") {
  const combined = `${section} ${topic}`.toLowerCase();
  
  if (combined.includes("hr") || combined.includes("behavioral")) {
    return VOICE_PROFILES.hr;
  }
  
  if (combined.includes("coding") || combined.includes("algorithm") || combined.includes("data structure")) {
    return VOICE_PROFILES.coding;
  }
  
  return VOICE_PROFILES.technical;
}

/**
 * Selects the optimal browser voice for senior corporate interviewer Alex.
 */
export function selectOptimalVoice(voices = []) {
  if (!voices || voices.length === 0) return null;

  // Preferred deep, corporate, natural voices in priority order
  const preferredVoiceNames = [
    "Microsoft Guy Online (Natural)",
    "Microsoft Christopher Online (Natural)",
    "Microsoft Eric Online (Natural)",
    "Google US English",
    "Daniel",
    "Alex",
    "Microsoft David - English (United States)",
    "Microsoft Mark - English (United States)",
    "Samantha"
  ];

  for (const preferred of preferredVoiceNames) {
    const found = voices.find((v) => v.name.toLowerCase().includes(preferred.toLowerCase()));
    if (found) return found;
  }

  // Fallback to male or any natural English voice
  const maleVoice = voices.find(
    (v) => (v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("guy") || v.name.toLowerCase().includes("david")) &&
           (v.lang.startsWith("en-US") || v.lang.startsWith("en"))
  );
  if (maleVoice) return maleVoice;

  const englishVoice = voices.find((v) => v.lang.startsWith("en-US") || v.lang.startsWith("en"));
  return englishVoice || voices[0];
}
