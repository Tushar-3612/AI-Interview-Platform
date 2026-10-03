class EvaluationStrategy {
  async evaluate(answer, question) {
    throw new Error("evaluate() must be implemented by subclass");
  }
  get name() {
    throw new Error("name getter must be implemented by subclass");
  }
}

class AiEvaluation extends EvaluationStrategy {
  get name() { return "ai"; }

  async evaluate(answer, question) {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `Evaluate this answer for a ${question.type || "technical"} question.

Question: ${question.question}
Correct Answer: ${question.correctAnswer || "N/A"}
Student Answer: ${answer}

Score from 0-100. Return JSON: { "score": number, "feedback": "string", "correct": boolean }`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleaned = text.replace(/```json?/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      const correct = answer.trim().toLowerCase() === (question.correctAnswer || "").trim().toLowerCase();
      return {
        score: correct ? 100 : 0,
        feedback: correct ? "Correct" : "Incorrect",
        correct,
      };
    }
  }
}

const strategies = {
  ai: new AiEvaluation(),
};

export function getEvaluationStrategy(method = "ai") {
  return strategies[method] || strategies.ai;
}

export default EvaluationStrategy;
