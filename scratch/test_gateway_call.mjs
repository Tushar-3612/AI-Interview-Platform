import dotenv from 'dotenv';
dotenv.config();
import { AIGateway } from './backend/services/aiReliability/index.js';

async function test() {
  try {
    const res = await AIGateway.execute({
      prompt: 'Output ONLY valid JSON: {"status": "success", "message": "hello"}',
      provider: 'groq',
      roundType: 'technical',
      orderIndex: 1
    });
    console.log("TEST RESULT:", JSON.stringify(res));
  } catch (e) {
    console.error("TEST FAILED:", e);
  }
}
test();
