import { generateAptitudeAI } from "../realInterviewAI/aptitudeAI.js";
import RealInterviewAptitudeQuestion from "../../models/RealInterviewAptitudeQuestion.js";
import RealInterviewAptitudeSession from "../../models/RealInterviewAptitudeSession.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
} from "./questionHistoryService.js";

const STATIC_FALLBACK_APTITUDE_QUESTIONS = [
  { question: "What is 20% of 150?", options: [{ label: "A", text: "25" }, { label: "B", text: "30" }, { label: "C", text: "35" }, { label: "D", text: "40" }], correctAnswer: "B", explanation: "20% of 150 = 0.2 * 150 = 30.", difficulty: "easy", topic: "Percentage", questionType: "Numerical Aptitude" },
  { question: "If the ratio of A to B is 2:3 and their sum is 50, what is the value of A?", options: [{ label: "A", text: "20" }, { label: "B", text: "25" }, { label: "C", text: "30" }, { label: "D", text: "35" }], correctAnswer: "A", explanation: "2x + 3x = 50 => 5x = 50 => x = 10 => A = 20.", difficulty: "easy", topic: "Ratio & Proportion", questionType: "Numerical Aptitude" },
  { question: "A train travels 120 km in 2 hours. What is its average speed in km/h?", options: [{ label: "A", text: "50" }, { label: "B", text: "55" }, { label: "C", text: "60" }, { label: "D", text: "65" }], correctAnswer: "C", explanation: "Speed = distance / time = 120 / 2 = 60 km/h.", difficulty: "easy", topic: "Speed, Distance & Time", questionType: "Numerical Aptitude" },
  { question: "If 4 workers can complete a task in 10 days, how many days will 5 workers take?", options: [{ label: "A", text: "5" }, { label: "B", text: "6" }, { label: "C", text: "7" }, { label: "D", text: "8" }], correctAnswer: "D", explanation: "Total work = 4 * 10 = 40 worker-days. 40 / 5 = 8 days.", difficulty: "easy", topic: "Time & Work", questionType: "Numerical Aptitude" },
  { question: "A fair 6-sided die is rolled. What is the probability of rolling a 4?", options: [{ label: "A", text: "1/6" }, { label: "B", text: "1/3" }, { label: "C", text: "1/2" }, { label: "D", text: "2/3" }], correctAnswer: "A", explanation: "Only 1 favorable outcome out of 6 possible => 1/6.", difficulty: "easy", topic: "Probability", questionType: "Numerical Aptitude" },
  { question: "Find the simple interest on Rs 1,000 at 5% per annum for 3 years.", options: [{ label: "A", text: "120" }, { label: "B", text: "150" }, { label: "C", text: "180" }, { label: "D", text: "200" }], correctAnswer: "B", explanation: "SI = (P * R * T) / 100 = (1000 * 5 * 3) / 100 = 150.", difficulty: "medium", topic: "Simple Interest", questionType: "Numerical Aptitude" },
  { question: "An item purchased for Rs 400 is sold for Rs 500. What is the profit percentage?", options: [{ label: "A", text: "15%" }, { label: "B", text: "20%" }, { label: "C", text: "25%" }, { label: "D", text: "30%" }], correctAnswer: "C", explanation: "Profit = 100; Profit % = (100 / 400) * 100 = 25%.", difficulty: "medium", topic: "Profit & Loss", questionType: "Numerical Aptitude" },
  { question: "Identify the next number in the sequence: 2, 5, 10, 17, 26, ?", options: [{ label: "A", text: "33" }, { label: "B", text: "35" }, { label: "C", text: "36" }, { label: "D", text: "37" }], correctAnswer: "D", explanation: "Pattern is n^2 + 1: 1^2+1=2, 2^2+1=5, 3^2+1=10, 4^2+1=17, 5^2+1=26, 6^2+1=37.", difficulty: "medium", topic: "Logical Reasoning", questionType: "Logical Reasoning" },
  { question: "The average of 5 numbers is 20. If one number equal to 10 is removed, what is the new average?", options: [{ label: "A", text: "22.5" }, { label: "B", text: "23" }, { label: "C", text: "24" }, { label: "D", text: "25" }], correctAnswer: "A", explanation: "Sum = 5 * 20 = 100. New sum = 90. New average = 90 / 4 = 22.5.", difficulty: "medium", topic: "Average", questionType: "Numerical Aptitude" },
  { question: "In a certain code language, 'CAT' is coded as 'DBU'. How is 'DOG' coded?", options: [{ label: "A", text: "ENF" }, { label: "B", text: "EPH" }, { label: "C", text: "FQI" }, { label: "D", text: "DOH" }], correctAnswer: "B", explanation: "Each letter is shifted by +1: D->E, O->P, G->H => EPH.", difficulty: "medium", topic: "Verbal Reasoning", questionType: "Verbal Reasoning" },
  { question: "Calculate the compound interest on Rs 2,000 at 10% per annum for 2 years.", options: [{ label: "A", text: "400" }, { label: "B", text: "410" }, { label: "C", text: "420" }, { label: "D", text: "440" }], correctAnswer: "C", explanation: "Amount = 2000 * (1.1)^2 = 2420. CI = 2420 - 2000 = 420.", difficulty: "hard", topic: "Compound Interest", questionType: "Numerical Aptitude" },
  { question: "In how many different ways can the letters of the word 'LEARN' be arranged?", options: [{ label: "A", text: "60" }, { label: "B", text: "90" }, { label: "C", text: "100" }, { label: "D", text: "120" }], correctAnswer: "D", explanation: "5 distinct letters => 5! = 5 * 4 * 3 * 2 * 1 = 120 ways.", difficulty: "hard", topic: "Permutations & Combinations", questionType: "Logical Reasoning" },
  { question: "A 20-liter mixture contains 20% acid. How many liters of water must be added to make it a 10% acid mixture?", options: [{ label: "A", text: "20 L" }, { label: "B", text: "15 L" }, { label: "C", text: "10 L" }, { label: "D", text: "5 L" }], correctAnswer: "A", explanation: "Acid = 4 L. To make 4 L equal to 10% of mixture, total volume must be 40 L. 40 - 20 = 20 L.", difficulty: "hard", topic: "Mixture & Alligation", questionType: "Numerical Aptitude" },
  { question: "Pipe A can fill a tank in 10 hours and Pipe B in 15 hours. How long will both pipes take working together?", options: [{ label: "A", text: "5 hours" }, { label: "B", text: "6 hours" }, { label: "C", text: "7 hours" }, { label: "D", text: "8 hours" }], correctAnswer: "B", explanation: "Rate = 1/10 + 1/15 = 5/60 = 1/6 tank per hour => 6 hours.", difficulty: "hard", topic: "Pipes & Cisterns", questionType: "Numerical Aptitude" },
  { question: "A company's annual revenue increased from $80,000 to $112,000. What is the percentage increase?", options: [{ label: "A", text: "30%" }, { label: "B", text: "35%" }, { label: "C", text: "40%" }, { label: "D", text: "45%" }], correctAnswer: "C", explanation: "Increase = $32,000. % Increase = (32,000 / 80,000) * 100 = 40%.", difficulty: "hard", topic: "Data Interpretation", questionType: "Data Interpretation" },
  // Additional unique questions for pool depth (Session B / C fallback safety)
  { question: "What is the perimeter of a rectangle with length 12 cm and width 8 cm?", options: [{ label: "A", text: "40 cm" }, { label: "B", text: "36 cm" }, { label: "C", text: "48 cm" }, { label: "D", text: "96 cm" }], correctAnswer: "A", explanation: "Perimeter = 2*(12 + 8) = 2*20 = 40 cm.", difficulty: "easy", topic: "Mensuration", questionType: "Numerical Aptitude" },
  { question: "If 15% of a number is 45, what is 50% of that number?", options: [{ label: "A", text: "120" }, { label: "B", text: "150" }, { label: "C", text: "180" }, { label: "D", text: "200" }], correctAnswer: "B", explanation: "Number = 45 / 0.15 = 300; 50% of 300 = 150.", difficulty: "easy", topic: "Percentage", questionType: "Numerical Aptitude" },
  { question: "A seller marks an article 25% above cost price and allows a 10% discount. What is the profit %?", options: [{ label: "A", text: "12.5%" }, { label: "B", text: "15%" }, { label: "C", text: "10%" }, { label: "D", text: "20%" }], correctAnswer: "A", explanation: "CP = 100, MP = 125, SP = 125 * 0.9 = 112.5. Profit % = 12.5%.", difficulty: "easy", topic: "Profit & Loss", questionType: "Numerical Aptitude" },
  { question: "Two numbers are in ratio 3:4. If their HCF is 4, what is their LCM?", options: [{ label: "A", text: "36" }, { label: "B", text: "48" }, { label: "C", text: "60" }, { label: "D", text: "72" }], correctAnswer: "B", explanation: "Numbers are 12 and 16. LCM(12, 16) = 48.", difficulty: "easy", topic: "HCF & LCM", questionType: "Numerical Aptitude" },
  { question: "In a class of 60 students, 35 play cricket, 25 play football, and 10 play both. How many play neither?", options: [{ label: "A", text: "10" }, { label: "B", text: "15" }, { label: "C", text: "20" }, { label: "D", text: "5" }], correctAnswer: "A", explanation: "Total playing = 35 + 25 - 10 = 50. Neither = 60 - 50 = 10.", difficulty: "easy", topic: "Set Theory", questionType: "Logical Reasoning" },
  { question: "A train 150 meters long crosses a pole in 9 seconds. What is the speed of the train in km/h?", options: [{ label: "A", text: "50 km/h" }, { label: "B", text: "60 km/h" }, { label: "C", text: "72 km/h" }, { label: "D", text: "80 km/h" }], correctAnswer: "B", explanation: "Speed in m/s = 150 / 9 = 50/3 m/s. In km/h = (50/3) * (18/5) = 60 km/h.", difficulty: "medium", topic: "Trains", questionType: "Numerical Aptitude" },
  { question: "How many terms of the AP 2, 4, 6, 8... must be taken to get a sum of 90?", options: [{ label: "A", text: "8" }, { label: "B", text: "9" }, { label: "C", text: "10" }, { label: "D", text: "11" }], correctAnswer: "B", explanation: "Sum = n(n + 1) = 90 => n^2 + n - 90 = 0 => (n - 9)(n + 10) = 0 => n = 9.", difficulty: "medium", topic: "Progressions", questionType: "Numerical Aptitude" },
  { question: "If 'LIGHT' is written as 'MJHIU', how is 'FLAME' written?", options: [{ label: "A", text: "GMBNF" }, { label: "B", text: "GMBNF" }, { label: "C", text: "GNCNF" }, { label: "D", text: "GLBNF" }], correctAnswer: "A", explanation: "Each letter is shifted +1: F->G, L->M, A->B, M->N, E->F => GMBNF.", difficulty: "medium", topic: "Coding Decoding", questionType: "Logical Reasoning" },
  { question: "A sum of money doubles itself at simple interest in 8 years. What is the rate of interest per annum?", options: [{ label: "A", text: "10%" }, { label: "B", text: "12.5%" }, { label: "C", text: "15%" }, { label: "D", text: "8%" }], correctAnswer: "B", explanation: "SI = P. P = (P * R * 8)/100 => R = 100 / 8 = 12.5%.", difficulty: "medium", topic: "Simple Interest", questionType: "Numerical Aptitude" },
  { question: "Point A is 10 m East of Point B. Point C is 10 m North of Point B. What is the direction of A relative to C?", options: [{ label: "A", text: "South-East" }, { label: "B", text: "North-West" }, { label: "C", text: "South-West" }, { label: "D", text: "North-East" }], correctAnswer: "A", explanation: "From C (0,10) to A (10,0), vector is (+10, -10) which is South-East.", difficulty: "medium", topic: "Direction Sense", questionType: "Logical Reasoning" },
  { question: "Find the angle between the hour hand and minute hand of a clock at 3:30.", options: [{ label: "A", text: "75 degrees" }, { label: "B", text: "80 degrees" }, { label: "C", text: "90 degrees" }, { label: "D", text: "105 degrees" }], correctAnswer: "A", explanation: "Minute hand at 180 deg. Hour hand at 90 + 15 = 105 deg. Angle = 180 - 105 = 75 degrees.", difficulty: "hard", topic: "Clocks", questionType: "Logical Reasoning" },
  { question: "A and B together take 12 days to complete work. B alone takes 30 days. How long will A take alone?", options: [{ label: "A", text: "18 days" }, { label: "B", text: "20 days" }, { label: "C", text: "24 days" }, { label: "D", text: "25 days" }], correctAnswer: "B", explanation: "1/A = 1/12 - 1/30 = 3/60 = 1/20 => A takes 20 days.", difficulty: "hard", topic: "Time & Work", questionType: "Numerical Aptitude" },
  { question: "If log2(x) + log2(x-2) = 3, what is the value of x?", options: [{ label: "A", text: "4" }, { label: "B", text: "6" }, { label: "C", text: "8" }, { label: "D", text: "2" }], correctAnswer: "A", explanation: "log2(x(x-2)) = 3 => x^2 - 2x = 8 => x^2 - 2x - 8 = 0 => (x-4)(x+2) = 0 => x = 4.", difficulty: "hard", topic: "Logarithms", questionType: "Numerical Aptitude" },
  { question: "In a row of 40 students, Rahul is 14th from the left. What is his rank from the right end?", options: [{ label: "A", text: "26th" }, { label: "B", text: "27th" }, { label: "C", text: "28th" }, { label: "D", text: "25th" }], correctAnswer: "B", explanation: "Rank from right = Total - Rank from left + 1 = 40 - 14 + 1 = 27th.", difficulty: "hard", topic: "Ordering & Ranking", questionType: "Logical Reasoning" },
  { question: "Three solid cubes of sides 3 cm, 4 cm, and 5 cm are melted into a single cube. What is its side length?", options: [{ label: "A", text: "6 cm" }, { label: "B", text: "7 cm" }, { label: "C", text: "8 cm" }, { label: "D", text: "9 cm" }], correctAnswer: "A", explanation: "Volume sum = 27 + 64 + 125 = 216 cm^3. Cube root of 216 = 6 cm.", difficulty: "hard", topic: "Mensuration 3D", questionType: "Numerical Aptitude" },
  { question: "What is the square root of 576?", options: [{ label: "A", text: "22" }, { label: "B", text: "24" }, { label: "C", text: "26" }, { label: "D", text: "28" }], correctAnswer: "B", explanation: "24 * 24 = 576.", difficulty: "easy", topic: "Simplification", questionType: "Numerical Aptitude" },
  { question: "If x + 1/x = 4, find the value of x^2 + 1/x^2.", options: [{ label: "A", text: "14" }, { label: "B", text: "16" }, { label: "C", text: "18" }, { label: "D", text: "12" }], correctAnswer: "A", explanation: "(x + 1/x)^2 = x^2 + 1/x^2 + 2 => 16 - 2 = 14.", difficulty: "medium", topic: "Algebra", questionType: "Numerical Aptitude" },
  { question: "A bag contains 3 red balls and 5 green balls. If one ball is drawn at random, what is the probability it is green?", options: [{ label: "A", text: "3/8" }, { label: "B", text: "5/8" }, { label: "C", text: "1/2" }, { label: "D", text: "1/4" }], correctAnswer: "B", explanation: "Green balls = 5, total = 8 => P(green) = 5/8.", difficulty: "medium", topic: "Probability", questionType: "Numerical Aptitude" },
  { question: "Find the median of the numbers: 7, 12, 3, 18, 14, 9, 21.", options: [{ label: "A", text: "9" }, { label: "B", text: "12" }, { label: "C", text: "14" }, { label: "D", text: "18" }], correctAnswer: "B", explanation: "Sorted: 3, 7, 9, 12, 14, 18, 21. Middle element (4th) is 12.", difficulty: "medium", topic: "Statistics", questionType: "Numerical Aptitude" },
  { question: "What is the HCF of 36, 54, and 90?", options: [{ label: "A", text: "9" }, { label: "B", text: "12" }, { label: "C", text: "18" }, { label: "D", text: "24" }], correctAnswer: "C", explanation: "36 = 18*2, 54 = 18*3, 90 = 18*5. HCF is 18.", difficulty: "hard", topic: "HCF & LCM", questionType: "Numerical Aptitude" }
];

/**
 * Validates, persists, and formats Real Interview Aptitude Questions.
 * Assigns maxMarks: Easy = 2, Medium = 3, Hard = 5 (Total = 50 Marks).
 */
export async function generateAndProcessAptitudeQuestions({ userId = null, sessionId = null } = {}) {
  const lockKey = `aptitude:${sessionId || "global"}`;
  return withInFlightLock(lockKey, async () => {
    // Check if questions already generated for this session
    if (sessionId) {
      const existing = await RealInterviewAptitudeQuestion.find({ sessionId });
      if (existing.length >= 15) {
        console.log(`[AptitudeService] Session ${sessionId} already has 15 aptitude questions. Reusing existing.`);
        const studentQuestions = existing.map((doc) => ({
          id: doc._id.toString(),
          question: doc.question,
          options: doc.options.map((o) => ({ label: o.label, text: o.text })),
          difficulty: doc.difficulty,
          maxMarks: doc.maxMarks || (doc.difficulty === "easy" ? 2 : doc.difficulty === "hard" ? 5 : 3),
          topic: doc.topic,
          questionType: doc.questionType,
        }));
        return {
          success: true,
          message: "Reused existing 15 aptitude questions",
          count: studentQuestions.length,
          questions: studentQuestions,
          reused: true,
        };
      }
    }

  let rawQuestions = [];
  let fallbackUsed = false;
  const userHistorySet = await getUserQuestionHistorySet(userId);

  try {
    const aiResult = await generateAptitudeAI();
    if (aiResult && Array.isArray(aiResult.questions) && aiResult.questions.length >= 15) {
      rawQuestions = filterUniqueQuestions(aiResult.questions, userHistorySet);
    }
  } catch (err) {
    console.warn(`[AptitudeService] AI generation warning (${err.message}). Checking pool...`);
  }

  if (rawQuestions.length < 15) {
    const currentAptSet = new Set(rawQuestions.map((q) => (q.question || "").toLowerCase().trim()));
    const fallbackUnique = filterUniqueQuestions(STATIC_FALLBACK_APTITUDE_QUESTIONS, userHistorySet);
    for (const fbQ of fallbackUnique) {
      if (rawQuestions.length >= 15) break;
      const norm = (fbQ.question || "").toLowerCase().trim();
      if (!currentAptSet.has(norm)) {
        currentAptSet.add(norm);
        rawQuestions.push(fbQ);
      }
    }
    // Safety fallback: if historical filter removed too many, fill from static pool
    if (rawQuestions.length < 15) {
      for (const fbQ of STATIC_FALLBACK_APTITUDE_QUESTIONS) {
        if (rawQuestions.length >= 15) break;
        const norm = (fbQ.question || "").toLowerCase().trim();
        if (!currentAptSet.has(norm)) {
          currentAptSet.add(norm);
          rawQuestions.push(fbQ);
        }
      }
    }
    fallbackUsed = true;
  }

  const selectedQuestions = rawQuestions.slice(0, 15);

  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  const answerCounts = { A: 0, B: 0, C: 0, D: 0 };
  const seenTexts = new Set();
  const validatedDocs = [];

  for (let idx = 0; idx < selectedQuestions.length; idx++) {
    const q = selectedQuestions[idx];

    const text = String(q.question || "").trim();
    if (!text) {
      throw new Error(`Question #${idx + 1} has empty question text`);
    }

    const normText = text.toLowerCase().replace(/\s+/g, " ").trim();
    if (seenTexts.has(normText)) {
      console.warn(`[AptitudeService] Duplicate question text detected: "${text.slice(0, 40)}..."`);
      continue;
    }
    seenTexts.add(normText);

    const diff = String(q.difficulty || "").toLowerCase().trim();
    if (!["easy", "medium", "hard"].includes(diff)) {
      throw new Error(`Question #${idx + 1} has invalid difficulty: "${q.difficulty}"`);
    }
    diffCounts[diff]++;

    const maxMarks = diff === "easy" ? 2 : diff === "hard" ? 5 : 3;

    let rawOpts = q.options;
    if (rawOpts && !Array.isArray(rawOpts) && typeof rawOpts === "object") {
      const keys = Object.keys(rawOpts);
      if (keys.length === 4) {
        rawOpts = keys.map((k, i) => ({
          label: ["A", "B", "C", "D"][i],
          text: String(rawOpts[k])
        }));
      }
    }

    if (!Array.isArray(rawOpts) || rawOpts.length !== 4) {
      throw new Error(`Question #${idx + 1} must have exactly 4 options`);
    }

    const formattedOptions = rawOpts.map((opt, optIdx) => {
      const expectedLabel = ["A", "B", "C", "D"][optIdx];
      let parsedOpt = opt;
      if (typeof opt === "string" && opt.trim().startsWith("{")) {
        try {
          parsedOpt = JSON.parse(opt);
        } catch (e) {}
      }
      const optText = typeof parsedOpt === "string" ? parsedOpt.trim() : String(parsedOpt.text || parsedOpt.option || "").trim();
      const label = String(parsedOpt.label || expectedLabel).toUpperCase().trim();

      if (!optText) {
        throw new Error(`Question #${idx + 1} Option ${label} is empty`);
      }
      return { label: expectedLabel, text: optText };
    });

    const correctAns = String(q.correctAnswer || "").toUpperCase().trim();
    if (!["A", "B", "C", "D"].includes(correctAns)) {
      throw new Error(`Question #${idx + 1} has invalid correctAnswer: "${q.correctAnswer}"`);
    }
    answerCounts[correctAns]++;

    const exp = String(q.explanation || "").trim();
    if (!exp) {
      throw new Error(`Question #${idx + 1} has empty explanation`);
    }

    const topic = String(q.topic || "General Aptitude").trim();
    const questionType = String(q.questionType || "Numerical Aptitude").trim();

    validatedDocs.push({
      sessionId,
      userId,
      question: text,
      options: formattedOptions,
      correctAnswer: correctAns,
      explanation: exp,
      difficulty: diff,
      maxMarks,
      topic,
      questionType,
      source: "real_interview_ai",
    });
  }

  let isValidationPassed = validatedDocs.length === 15 && diffCounts.easy >= 3 && diffCounts.medium >= 3 && diffCounts.hard >= 3;
  if (isValidationPassed) {
    for (const label of ["A", "B", "C", "D"]) {
      if (answerCounts[label] > 8 || answerCounts[label] < 1) {
        isValidationPassed = false;
        break;
      }
    }
  }

  if (!isValidationPassed && !fallbackUsed) {
    console.warn("[AptitudeService] AI generated questions failed strict validation/distribution checks. Falling back to static 15 aptitude questions.");
    validatedDocs.length = 0;
    fallbackUsed = true;
    for (let idx = 0; idx < STATIC_FALLBACK_APTITUDE_QUESTIONS.length; idx++) {
      const q = STATIC_FALLBACK_APTITUDE_QUESTIONS[idx];
      validatedDocs.push({
        sessionId,
        userId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        maxMarks: q.difficulty === "easy" ? 2 : q.difficulty === "hard" ? 5 : 3,
        topic: q.topic,
        questionType: q.questionType,
        source: "static_fallback",
      });
    }
  }

  const savedDocs = await RealInterviewAptitudeQuestion.insertMany(validatedDocs);
  if (userId && sessionId) {
    await recordUserQuestionHistory({ userId, sessionId, round: "aptitude", questions: savedDocs });
  }

  // STRIP correctAnswer & explanation from active interview candidate response
  const studentQuestions = savedDocs.map((doc) => ({
    id: doc._id.toString(),
    question: doc.question,
    options: doc.options.map((o) => ({ label: o.label, text: o.text })),
    difficulty: doc.difficulty,
    maxMarks: doc.maxMarks,
    topic: doc.topic,
    questionType: doc.questionType,
  }));

    return {
      success: true,
      message: "15 placement-level aptitude questions generated successfully",
      count: studentQuestions.length,
      distribution: diffCounts,
      answerDistribution: answerCounts,
      questions: studentQuestions,
      reused: false,
    };
  });
}

/**
 * Robust option letter resolver for Aptitude questions.
 * Handles "Option B: 30", "Option B", "B", "30", "b", etc.
 */
function resolveAptitudeOptionLetter(rawAns, options = []) {
  if (!rawAns || typeof rawAns !== "string") return "";
  const trimmed = rawAns.trim();
  if (!trimmed) return "";

  const upper = trimmed.toUpperCase();

  // 1. Direct match on A, B, C, D
  if (["A", "B", "C", "D"].includes(upper)) {
    return upper;
  }

  // 2. Starts with OPTION A, OPTION B, OPTION C, OPTION D or A:, B:, C:, D:
  const match = upper.match(/^(?:OPTION\s+)?([A-D])(?:\b|:|\s)/);
  if (match && ["A", "B", "C", "D"].includes(match[1])) {
    return match[1];
  }

  // 3. Match text against options array
  const lower = trimmed.toLowerCase();
  for (const o of options) {
    const label = String(o.label || "").toUpperCase().trim();
    const text = String(o.text || "").toLowerCase().trim();
    if (!label) continue;

    if (
      lower === text ||
      lower === `option ${label.toLowerCase()}: ${text}` ||
      lower === `option ${label.toLowerCase()}` ||
      lower === `${label.toLowerCase()}: ${text}`
    ) {
      return label;
    }
  }

  // 4. Pure option text fallback match
  for (const o of options) {
    const label = String(o.label || "").toUpperCase().trim();
    const text = String(o.text || "").toLowerCase().trim();
    if (text && text === lower) {
      return label;
    }
  }

  return "";
}

/**
 * Deterministically evaluates candidate's Aptitude round (ZERO AI CALLS).
 * Easy = 2 marks, Medium = 3 marks, Hard = 5 marks. Total Max Score = 50.
 */
export async function evaluateAptitudeSession({ sessionId, candidateAnswers = [], userId = null }) {
  if (!sessionId) {
    throw new Error("sessionId is required for aptitude evaluation");
  }

  let session = await RealInterviewAptitudeSession.findOne({ sessionId });
  if (session && session.evaluationCompleted) {
    console.log(`[AptitudeService] Session ${sessionId} already evaluated. Reusing stored result.`);
    return {
      success: true,
      message: "Reused existing aptitude evaluation result",
      sessionId,
      totalScore: session.totalScore,
      maxScore: session.maxScore || 50,
      percentage: session.percentage,
      overallRating: session.overallRating,
      answers: session.answers,
      reused: true,
    };
  }

  const questions = await RealInterviewAptitudeQuestion.find({ sessionId });
  if (questions.length === 0) {
    throw new Error("No aptitude questions found for evaluation in this session");
  }

  let calculatedTotalScore = 0;
  const maxScoreTotal = 50;
  const processedAnswers = [];

  for (const q of questions) {
    const qIdStr = q._id.toString();
    const subAns = candidateAnswers.find(
      (a) => String(a.questionId || a.id) === qIdStr
    );

    const rawAns = String(subAns?.selectedOption || subAns?.answer || "").trim();
    const resolvedOption = resolveAptitudeOptionLetter(rawAns, q.options || []);

    const isCorrect = Boolean(resolvedOption) && resolvedOption === q.correctAnswer;
    const maxMarks = q.maxMarks || (q.difficulty === "easy" ? 2 : q.difficulty === "hard" ? 5 : 3);
    const score = isCorrect ? maxMarks : 0;

    calculatedTotalScore += score;

    processedAnswers.push({
      questionId: q._id,
      question: q.question,
      selectedOption: resolvedOption || "", // Must be strictly A, B, C, D, or "" to satisfy Mongoose enum
      correctAnswer: q.correctAnswer,
      isCorrect,
      score,
      maxMarks,
      difficulty: q.difficulty,
      explanation: q.explanation,
    });
  }

  const percentage = Math.round((calculatedTotalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 90) overallRating = "Excellent";
  else if (percentage >= 80) overallRating = "Very Strong";
  else if (percentage >= 70) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Good";
  else if (percentage >= 50) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  if (!session) {
    session = await RealInterviewAptitudeSession.create({
      sessionId,
      userId,
      answers: processedAnswers,
      questionsAnswered: processedAnswers.filter((a) => a.selectedOption !== "").length,
      status: "completed",
      totalScore: calculatedTotalScore,
      maxScore: maxScoreTotal,
      percentage,
      overallRating,
      evaluationCompleted: true,
      evaluatedAt: new Date(),
    });
  } else {
    session.answers = processedAnswers;
    session.questionsAnswered = processedAnswers.filter((a) => a.selectedOption !== "").length;
    session.status = "completed";
    session.totalScore = calculatedTotalScore;
    session.maxScore = maxScoreTotal;
    session.percentage = percentage;
    session.overallRating = overallRating;
    session.evaluationCompleted = true;
    session.evaluatedAt = new Date();
    await session.save();
  }

  return {
    success: true,
    message: "Aptitude round evaluated deterministically in 0 AI calls",
    sessionId,
    totalScore: session.totalScore,
    maxScore: session.maxScore,
    percentage: session.percentage,
    overallRating: session.overallRating,
    answers: session.answers,
    reused: false,
  };
}
