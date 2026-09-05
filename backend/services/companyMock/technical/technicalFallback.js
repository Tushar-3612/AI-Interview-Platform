/**
 * Company Mock — Deterministic fallback scoring for technical answers.
 *
 * Uses a blended scoring approach:
 * 1. Extract sentence-level concepts from the expectedAnswer
 * 2. For each concept, compute phrase-level coverage
 * 3. Combine concept-level and phrase-level scores
 * 4. Apply difficulty-based adjustments
 */

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","shall","should",
  "may","might","must","can","could","of","in","to","for","with","on",
  "at","from","by","about","as","into","through","during","before",
  "after","above","below","between","out","off","over","under","again",
  "further","then","once","here","there","when","where","why","how",
  "all","both","each","few","more","most","other","some","such","no",
  "nor","not","only","own","same","so","than","too","very","just",
  "don","now","and","but","or","if","while","that","this","these",
  "those","it","its","i","me","my","we","our","you","your","he","him",
  "his","she","her","they","them","their","what","which","who","whom",
  "up","down","also","like","well","much","many","get","got","make",
  "made","say","said","go","going","come","came","know","known",
  "think","take","taken","see","seen","want","use","used",
  "find","found","give","given","tell","told","work","call","need",
  "try","tried","ask","asked","put","keep","let","begin","seem",
  "help","show","hear","play","run","move","live","believe","bring",
  "happen","write","provide","sit","stand","lose","pay","meet","include",
  "continue","set","learn","change","lead","understand","watch","follow",
  "stop","create","speak","read","allow","add","spend","grow","open",
  "walk","win","offer","remember","love","consider","appear","buy","wait",
  "serve","die","send","expect","build","stay","fall","cut","reach",
  "kill","remain","suggest","raise","pass","sell","require","report",
  "decide","pull","develop","agree","support","hold","produce","eat",
  "apply","feel","especially","actually","however","typically","often",
  "using","used","based","may","can","will","also","rather","one",
  "two","three","four","five","first","second","third","new","old",
  "different","similar","important","example","part","number","type",
  "system","way","method","technique","approach",
  "because","therefore","thus","hence","since","means","whereas",
  "although","though","despite","moreover","furthermore",
  "specifically","particularly","generally",
  "usually","sometimes","rarely","never","always",
  "better","worse","good","bad","best","worst","high","low",
  "more","less","increase","decrease","improve","reduce",
  "key","common","main","core","significant","fundamental",
  "difference","between","versus","compare","define",
  "explain","describe","discuss","outline","list","give","state",
]);

const SEMANTIC_EQUIVALENCE = new Map([
  ["performance on unseen data", "generalization"],
  ["does not generalize", "overfitting"],
  ["learns noise", "overfitting"],
  ["high variance", "overfitting"],
  ["high bias", "underfitting"],
  ["mean absolute error", "mae"],
  ["mean squared error", "mse"],
  ["root mean squared error", "rmse"],
  ["vanishing gradient", "gradient vanishing"],
  ["gradient vanishes", "gradient vanishing"],
  ["long range dependencies", "long-term dependencies"],
  ["gating mechanism", "gates"],
  ["memory cell", "cell state"],
  ["self attention", "attention"],
  ["multi-head attention", "attention"],
  ["penalty", "regularization"],
  ["shrinkage", "regularization"],
  ["l1 regularization", "l1"],
  ["l2 regularization", "l2"],
  ["lasso", "l1"],
  ["ridge", "l2"],
  ["impurity", "entropy"],
  ["disorder", "entropy"],
  ["bootstrap aggregating", "bagging"],
  ["sequential training", "boosting"],
  ["correcting errors", "boosting"],
  ["meta-learner", "stacking"],
  ["combining models", "ensemble"],
  ["majority vote", "voting"],
  ["resample with replacement", "bootstrapping"],
  ["bootstrap sample", "bootstrapping"],
  ["central tendency", "mean"],
  ["average value", "mean"],
  ["middle value", "median"],
  ["most frequent", "mode"],
  ["spread", "variance"],
  ["null hypothesis", "h0"],
  ["alternative hypothesis", "ha"],
  ["significance level", "alpha"],
  ["rectified linear", "relu"],
  ["logistic sigmoid", "sigmoid"],
  ["hyperbolic tangent", "tanh"],
  ["squashing function", "sigmoid"],
  ["bell curve", "normal distribution"],
  ["gaussian", "normal distribution"],
  ["number of successes", "binomial"],
  ["fixed number of trials", "binomial"],
  ["two outcomes", "binomial"],
  ["independent trials", "binomial"],
  ["positional encoding", "transformer"],
  ["feed forward", "transformer"],
  ["bias variance", "bias-variance"],
]);

function normalizeText(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").replace(/\s+/g, " ").trim();
}

function extractWords(text) {
  return normalizeText(text).split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

function extractKeyPhrases(text) {
  const words = normalizeText(text).split(/\s+/).filter((w) => w.length >= 2);
  const phrases = new Set();
  for (const w of words) { if (!STOPWORDS.has(w) && w.length >= 3) phrases.add(w); }
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i], w2 = words[i + 1];
    if ((!STOPWORDS.has(w1) && w1.length >= 3) || (!STOPWORDS.has(w2) && w2.length >= 3)) {
      phrases.add(`${w1} ${w2}`);
    }
  }
  for (let i = 0; i < words.length - 2; i++) {
    const w1 = words[i], w2 = words[i + 1], w3 = words[i + 2];
    if ((!STOPWORDS.has(w1) && w1.length >= 3) || (!STOPWORDS.has(w2) && w2.length >= 3) || (!STOPWORDS.has(w3) && w3.length >= 3)) {
      phrases.add(`${w1} ${w2} ${w3}`);
    }
  }
  return phrases;
}

function areEquivalent(phrase1, phrase2) {
  const n1 = normalizeText(phrase1);
  const n2 = normalizeText(phrase2);
  if (n1 === n2) return true;
  const c1 = SEMANTIC_EQUIVALENCE.get(n1);
  const c2 = SEMANTIC_EQUIVALENCE.get(n2);
  if (c1 && c2 && c1 === c2) return true;
  if (c1 === n2 || c2 === n1) return true;
  return false;
}

function phraseMatches(candidatePhrase, conceptPhrase) {
  if (areEquivalent(candidatePhrase, conceptPhrase)) return true;
  const nc = normalizeText(candidatePhrase);
  const np = normalizeText(conceptPhrase);
  if (nc.includes(np) || np.includes(nc)) return true;
  return false;
}

function conceptCoverageFraction(candidateText, conceptPhrases) {
  if (conceptPhrases.length === 0) return 0;
  const candidatePhrases = extractKeyPhrases(candidateText);
  const normCandidate = normalizeText(candidateText);
  let covered = 0;
  for (const kp of conceptPhrases) {
    let found = false;
    if (candidatePhrases.has(kp)) found = true;
    else if (normCandidate.includes(kp)) found = true;
    else {
      for (const cp of candidatePhrases) {
        if (phraseMatches(cp, kp)) { found = true; break; }
      }
    }
    if (found) covered++;
  }
  return covered / conceptPhrases.length;
}

function extractConcepts(expectedAnswer, question) {
  if (!expectedAnswer) return [];
  const sentences = expectedAnswer.split(/[.;:]\s+/).map((s) => s.trim()).filter((s) => s.length > 10);
  if (sentences.length === 0) return [];
  const questionWords = new Set(extractWords(question || ""));
  const concepts = [];
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const keyPhrases = extractKeyPhrases(sentence);
    if (keyPhrases.size === 0) continue;
    let importance = "supporting";
    if (i === 0) importance = "core";
    else if (i === sentences.length - 1 && sentences.length > 2) importance = "optional";
    const sentenceWords = extractWords(sentence);
    const overlap = sentenceWords.filter((w) => questionWords.has(w));
    if (overlap.length >= 2) importance = "core";
    concepts.push({ keyPhrases: [...keyPhrases], sentence, importance });
  }
  return concepts;
}

function computeCoverage(candidateText, concepts) {
  let coreTotal = 0, coreCovered = 0;
  let supportingTotal = 0, supportingCovered = 0;
  let optionalTotal = 0, optionalCovered = 0;
  const totalPhrases = concepts.reduce((sum, c) => sum + c.keyPhrases.length, 0);
  let coveredPhrases = 0;
  const coveredSentences = [];
  const missingSentences = [];

  for (const concept of concepts) {
    const fraction = conceptCoverageFraction(candidateText, concept.keyPhrases);
    const isCovered = fraction >= 0.30;
    coveredPhrases += Math.round(fraction * concept.keyPhrases.length);

    if (concept.importance === "core") {
      coreTotal++;
      if (isCovered) { coreCovered++; coveredSentences.push(concept.sentence); }
      else missingSentences.push(concept.sentence);
    } else if (concept.importance === "supporting") {
      supportingTotal++;
      if (isCovered) { supportingCovered++; coveredSentences.push(concept.sentence); }
      else missingSentences.push(concept.sentence);
    } else {
      optionalTotal++;
      if (isCovered) { optionalCovered++; coveredSentences.push(concept.sentence); }
    }
  }

  const phraseFraction = totalPhrases > 0 ? coveredPhrases / totalPhrases : 0;

  return {
    coreTotal, coreCovered,
    supportingTotal, supportingCovered,
    optionalTotal, optionalCovered,
    totalPhrases, coveredPhrases, phraseFraction,
    coveredSentences, missingSentences,
  };
}

function scoreByCoverage(coverage, maxMarks, candidateLen, expectedLen) {
  const { coreTotal, coreCovered, supportingTotal, supportingCovered, optionalTotal, optionalCovered, phraseFraction } = coverage;
  const totalConcepts = coreTotal + supportingTotal + optionalTotal;
  if (totalConcepts === 0) return null;

  const coreRatio = coreTotal > 0 ? coreCovered / coreTotal : 1;
  const supportRatio = supportingTotal > 0 ? supportingCovered / supportingTotal : 1;
  const optionalRatio = optionalTotal > 0 ? optionalCovered / optionalTotal : 1;
  const conceptScore = coreRatio * 0.60 + supportRatio * 0.30 + optionalRatio * 0.10;
  const lengthRatio = Math.min(candidateLen / Math.max(expectedLen * 0.2, 15), 1);

  // Blend: concept coverage (70%) + phrase-level (30%)
  let score = (conceptScore * 0.7 + phraseFraction * 0.3) * maxMarks;

  // Length penalty
  if (lengthRatio < 0.15) score *= 0.6;
  else if (lengthRatio < 0.3) score *= 0.8;

  return score;
}

function buildEvaluation(coverage, maxMarks, score) {
  const scorePct = maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0;
  if (scorePct >= 80) return `Strong response. The answer demonstrates solid understanding of the core concepts.`;
  if (scorePct >= 60) return `Good response. Core concepts are mostly addressed.`;
  if (scorePct >= 40) return `Partial response. Some important concepts are present but significant gaps remain.`;
  if (scorePct >= 20) return `Minimal response. Only a few relevant concepts are touched upon.`;
  if (score > 0) return "The response contains some related terminology but lacks substantive explanation.";
  return "The answer does not demonstrate understanding of the required concepts.";
}

function buildFeedback(coverage) {
  const strengths = [];
  const weaknesses = [];
  if (coverage.coreCovered > 0) strengths.push(`${coverage.coreCovered} core concept(s) addressed`);
  if (coverage.missingSentences.length > 0) weaknesses.push(`${coverage.missingSentences.length} concept(s) missing or incomplete`);
  return { strengths, weaknesses };
}

function computeWordOverlap(candidateText, expectedText) {
  const candidateWords = new Set(extractWords(candidateText));
  const expectedWords = new Set(extractWords(expectedText));
  if (expectedWords.size === 0) return 0;
  let matched = 0;
  for (const w of expectedWords) { if (candidateWords.has(w)) matched++; }
  return matched / expectedWords.size;
}

function scoreByDifficulty(overlapRatio, maxMarks, candidateLen, expectedLen) {
  const lengthRatio = Math.min(candidateLen / Math.max(expectedLen * 0.25, 15), 1);
  if (maxMarks <= 2) {
    if (overlapRatio >= 0.60 && lengthRatio >= 0.3) return maxMarks;
    if (overlapRatio >= 0.40 && lengthRatio >= 0.2) return 1.5;
    if (overlapRatio >= 0.20) return 1;
    if (overlapRatio > 0 && lengthRatio >= 0.2) return 0.5;
    return 0;
  }
  if (maxMarks <= 3) {
    if (overlapRatio >= 0.75 && lengthRatio >= 0.4) return maxMarks;
    if (overlapRatio >= 0.55 && lengthRatio >= 0.3) return 2.5;
    if (overlapRatio >= 0.45) return 2;
    if (overlapRatio >= 0.30) return 1.5;
    if (overlapRatio >= 0.18) return 1;
    if (overlapRatio > 0 && lengthRatio >= 0.15) return 0.5;
    return 0;
  }
  if (overlapRatio >= 0.85 && lengthRatio >= 0.5) return maxMarks;
  if (overlapRatio >= 0.70 && lengthRatio >= 0.4) return maxMarks - 1;
  if (overlapRatio >= 0.55 && lengthRatio >= 0.3) return maxMarks - 2;
  if (overlapRatio >= 0.40) return maxMarks - 3;
  if (overlapRatio >= 0.25) return 1.5;
  if (overlapRatio >= 0.12) return 1;
  if (overlapRatio > 0 && lengthRatio >= 0.15) return 0.5;
  return 0;
}

export function computeFallbackScore({ candidateAnswer, expectedAnswer, explanation, betterAnswer, maxMarks, question }) {
  const candidate = (candidateAnswer || "").trim();
  const expected = (expectedAnswer || "").trim();

  if (!candidate) {
    return {
      score: 0, maxMarks,
      evaluation: "No answer provided.",
      strengths: [], weaknesses: ["No answer was submitted."],
      betterAnswer: betterAnswer || expectedAnswer || "",
      evaluationStatus: "fallback",
    };
  }

  if (!expected) {
    return {
      score: null, maxMarks,
      evaluation: "AI evaluation is not available and no reference answer is stored. Your answer has been saved.",
      strengths: [], weaknesses: [],
      betterAnswer: betterAnswer || "",
      evaluationStatus: "fallback",
    };
  }

  const concepts = extractConcepts(expected, question);

  let score;
  let evaluation;
  let strengths = [];
  let weaknesses = [];

  if (concepts.length >= 2) {
    const coverage = computeCoverage(candidate, concepts);
    score = scoreByCoverage(coverage, maxMarks, candidate.length, expected.length);
    if (score === null) {
      const wo = computeWordOverlap(candidate, expected);
      score = scoreByDifficulty(wo, maxMarks, candidate.length, expected.length);
    }
    evaluation = buildEvaluation(coverage, maxMarks, score);
    const fb = buildFeedback(coverage);
    strengths = fb.strengths;
    weaknesses = fb.weaknesses;
  } else {
    const wo = computeWordOverlap(candidate, expected);
    score = scoreByDifficulty(wo, maxMarks, candidate.length, expected.length);
    const pct = Math.round(wo * 100);
    if (pct >= 70) evaluation = `Strong response — covers approximately ${pct}% of the expected content.`;
    else if (pct >= 40) evaluation = `Partial response — covers approximately ${pct}% of the expected content.`;
    else if (pct > 0) evaluation = `Minimal response — covers approximately ${pct}% of the expected content.`;
    else evaluation = "The answer does not match the expected content.";
  }

  score = Math.max(0, Math.min(maxMarks, score));
  score = Math.round(score * 2) / 2;

  return {
    score, maxMarks, evaluation, strengths, weaknesses,
    betterAnswer: betterAnswer || expected,
    evaluationStatus: "fallback",
  };
}
