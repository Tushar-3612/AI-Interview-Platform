import { callPythonGroqBridge } from "../backend/services/realInterviewAI/pythonGroqBridge.js";
import { extractJsonFromText } from "../backend/services/realInterviewAI/jsonExtractor.js";
import dotenv from "dotenv";
dotenv.config();

const key = process.env.AI_API_KEY;

async function testAllRounds() {
  console.log("=== TESTING ALL 5 ROUNDS WITH QWEN (LIGHTNING FAST) ===");

  // 1. Aptitude (15 Qs)
  console.log("\n1. Generating Aptitude (15 Qs)...");
  const t0 = Date.now();
  const aptPrompt1 = `Generate a JSON object with key "questions" containing 8 aptitude questions. Output valid JSON ONLY.\n{"questions":[{"question":"Text","options":["A","B","C","D"],"correctAnswer":"A","difficulty":"easy","topic":"Math"}]}`;
  const aptPrompt2 = `Generate a JSON object with key "questions" containing 7 aptitude questions. Output valid JSON ONLY.\n{"questions":[{"question":"Text","options":["A","B","C","D"],"correctAnswer":"B","difficulty":"hard","topic":"Logic"}]}`;
  
  const aptRes1 = await callPythonGroqBridge({ round: "aptitude_1", apiKey: key, model: "qwen/qwen3.8-27b", messages: [{ role: "user", content: aptPrompt1 }], max_tokens: 700 });
  await new Promise(r => setTimeout(r, 12000));
  const aptRes2 = await callPythonGroqBridge({ round: "aptitude_2", apiKey: key, model: "qwen/qwen3.8-27b", messages: [{ role: "user", content: aptPrompt2 }], max_tokens: 700 });
  
  const apt1 = extractJsonFromText(aptRes1);
  const apt2 = extractJsonFromText(aptRes2);
  const aptTotal = [...(apt1.questions || []), ...(apt2.questions || [])];
  console.log(`Aptitude DONE: ${aptTotal.length} questions in ${Date.now() - t0}ms!`);

  // 2. Project (10 Qs)
  console.log("\n2. Generating Project (10 Qs)...");
  await new Promise(r => setTimeout(r, 12000));
  const t1 = Date.now();
  const projPrompt = `Candidate Projects: AI Resume Parser (Python, FastAPI, SpaCy), Customer Churn (Python, XGBoost, Docker). Generate a JSON object with key "questions" containing 10 technical project questions. Output valid JSON ONLY.\n{"questions":[{"question":"Deep technical question","difficulty":"easy","topic":"FastAPI","projectName":"AI Resume Parser"}]}`;
  const projRes = await callPythonGroqBridge({ round: "project", apiKey: key, model: "qwen/qwen3.8-27b", messages: [{ role: "user", content: projPrompt }], max_tokens: 850 });
  const projParsed = extractJsonFromText(projRes);
  console.log(`Project DONE: ${projParsed.questions?.length} questions in ${Date.now() - t1}ms!`);

  // 3. HR (5 Qs)
  console.log("\n3. Generating HR (5 Qs)...");
  await new Promise(r => setTimeout(r, 12000));
  const t2 = Date.now();
  const hrPrompt = `Candidate: Tushar Nagare (BE CS). Generate a JSON object with key "questions" containing 5 HR interview questions. Output valid JSON ONLY.\n{"questions":[{"question":"HR question text","difficulty":"medium","maxMarks":20}]}`;
  const hrRes = await callPythonGroqBridge({ round: "hr", apiKey: key, model: "qwen/qwen3.8-27b", messages: [{ role: "user", content: hrPrompt }], max_tokens: 600 });
  const hrParsed = extractJsonFromText(hrRes);
  console.log(`HR DONE: ${hrParsed.questions?.length} questions in ${Date.now() - t2}ms!`);

  // 4. Coding (3 Qs)
  console.log("\n4. Generating Coding (3 Qs)...");
  await new Promise(r => setTimeout(r, 12000));
  const t3 = Date.now();
  const codePrompt = `Generate a JSON object with key "questions" containing 3 DSA coding problems (Easy 20m, Medium 30m, Hard 50m). Output valid JSON ONLY.\n{"questions":[{"title":"Two Sum","description":"Problem statement","difficulty":"easy","marks":20,"supportedLanguages":["python","javascript","java","cpp"]}]}`;
  const codeRes = await callPythonGroqBridge({ round: "coding", apiKey: key, model: "qwen/qwen3.8-27b", messages: [{ role: "user", content: codePrompt }], max_tokens: 800 });
  const codeParsed = extractJsonFromText(codeRes);
  console.log(`Coding DONE: ${codeParsed.questions?.length} problems in ${Date.now() - t3}ms!`);

  console.log("\n=== ALL ROUNDS TEST COMPLETED SUCCESSFULLY! ===");
}

testAllRounds().catch(console.error);
