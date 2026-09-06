import { callPythonGroqBridge } from "../backend/services/realInterviewAI/pythonGroqBridge.js";
import { extractJsonFromText } from "../backend/services/realInterviewAI/jsonExtractor.js";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.REAL_INTERVIEW_APTITUDE_API_KEY;

async function testFastAptitude() {
  console.log("Generating 15 aptitude questions via 2 fast parallel Python bridge calls...");
  const t0 = Date.now();

  const prompt1 = `Generate a JSON object with key "questions" containing EXACTLY 8 placement aptitude questions (5 Easy, 3 Medium). Output valid JSON ONLY.
{"questions":[{"question":"Problem statement","options":[{"label":"A","text":"Opt1"},{"label":"B","text":"Opt2"},{"label":"C","text":"Opt3"},{"label":"D","text":"Opt4"}],"correctAnswer":"A","explanation":"Formula","difficulty":"easy","topic":"Arithmetic","questionType":"Numerical Aptitude"}]}`;

  const prompt2 = `Generate a JSON object with key "questions" containing EXACTLY 7 placement aptitude questions (4 Medium, 3 Hard). Output valid JSON ONLY.
{"questions":[{"question":"Problem statement","options":[{"label":"A","text":"Opt1"},{"label":"B","text":"Opt2"},{"label":"C","text":"Opt3"},{"label":"D","text":"Opt4"}],"correctAnswer":"B","explanation":"Formula","difficulty":"hard","topic":"Logical Reasoning","questionType":"Logical Reasoning"}]}`;

  const [res1, res2] = await Promise.all([
    callPythonGroqBridge({
      round: "aptitude_part1",
      apiKey: process.env.REAL_INTERVIEW_APTITUDE_API_KEY,
      model: "qwen/qwen3.8-27b",
      messages: [{ role: "user", content: prompt1 }],
      temperature: 0.1,
      max_tokens: 600
    }),
    callPythonGroqBridge({
      round: "aptitude_part2",
      apiKey: process.env.AI_API_KEY,
      model: "qwen/qwen3.8-27b",
      messages: [{ role: "user", content: prompt2 }],
      temperature: 0.1,
      max_tokens: 600
    })
  ]);

  const p1 = extractJsonFromText(res1);
  const p2 = extractJsonFromText(res2);

  const all = [...(p1.questions || []), ...(p2.questions || [])];
  console.log(`Total questions generated: ${all.length} in ${Date.now() - t0}ms!`);
  console.log("Q1:", all[0]?.question);
  console.log("Q15:", all[14]?.question);
}

testFastAptitude().catch(console.error);
