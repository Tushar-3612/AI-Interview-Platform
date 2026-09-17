import { generateTechnicalAIBatch, evaluateTechnicalInterviewAI } from "../backend/services/realInterviewAI/technicalAI.js";
import { generateProjectAI } from "../backend/services/realInterviewAI/projectAI.js";
import { generateHRAI } from "../backend/services/realInterviewAI/hrAI.js";
import { generateCodingAI } from "../backend/services/realInterviewAI/codingAI.js";
import { AIGateway, sessionManager } from "../backend/services/aiReliability/index.js";

async function runIntegrationTest() {
  console.log("=== STARTING INTEGRATION PIPELINE VERIFICATION ===");

  const testSessionId = `test_session_${Date.now()}`;
  sessionManager.setSessionBYOK(testSessionId, "groq", process.env.GROQ_API_KEY || "gsk_test_key_123");

  const byok = sessionManager.getSessionBYOK(testSessionId);
  console.log("BYOK retrieved for test session:", byok.providerName, "Key present:", Boolean(byok.apiKey));

  console.log("\n[1/4] Testing Technical AI Gateway adapter...");
  try {
    const techQuestions = await generateTechnicalAIBatch({
      skillsContextStr: "Node.js, React, MongoDB",
      startQuestionNumber: 1,
      batchSize: 2,
      targetTotalCount: 20,
      userHistorySet: new Set(),
      currentPoolSet: new Set(),
      sessionId: testSessionId
    });
    console.log(`✓ Technical AI Batch generated ${techQuestions.length} questions:`, techQuestions.map(q => q.question.slice(0, 40) + "..."));
  } catch (err) {
    console.log("Technical AI call output:", err.message);
  }

  console.log("\n=== INTEGRATION PIPELINE VERIFICATION COMPLETE ===");
}

runIntegrationTest().catch(err => {
  console.error("Integration test error:", err);
});
