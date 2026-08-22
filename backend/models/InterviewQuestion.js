import mongoose from "mongoose";

/**
 * InterviewQuestion schema — stores pre-generated questions per round.
 * Enables zero-latency retrieval during the interview and persistent per-question evaluation.
 */
const interviewQuestionSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
      index: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    round: {
      type: String,
      enum: ["aptitude", "technical", "coding", "hr"],
      required: true,
      index: true,
    },
    questionNumber: {
      type: Number,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    skill: {
      type: String,
      default: "General",
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "Easy", "Medium", "Hard"],
      default: "medium",
    },
    questionType: {
      type: String,
      default: "conceptual", // conceptual, practical, debugging, scenario, behavioral, coding, mcq
    },
    // MCQ specific fields (for Aptitude round)
    options: {
      type: [String],
      default: [],
    },
    correctAnswer: {
      type: String,
      default: "",
    },
    // Coding specific fields (for Coding round)
    starterCode: {
      type: String,
      default: "",
    },
    testCases: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    inputFormat: { type: String, default: "" },
    outputFormat: { type: String, default: "" },
    constraints: { type: String, default: "" },
    sampleInput: { type: String, default: "" },
    sampleOutput: { type: String, default: "" },
    expectedComplexity: { type: String, default: "" },
    // Voice / TTS assistance text
    aiSpeechText: {
      type: String,
      default: "",
    },
    // Candidate interaction state
    candidateAnswer: {
      type: String,
      default: "",
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    feedback: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "answered", "skipped"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Compound index for fast round questions retrieval
interviewQuestionSchema.index({ interviewId: 1, round: 1, questionNumber: 1 });

const InterviewQuestion = mongoose.model("InterviewQuestion", interviewQuestionSchema);

export default InterviewQuestion;
