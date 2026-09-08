import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { callPythonGroqBridge } from '../backend/services/realInterviewAI/pythonGroqBridge.js';
import { extractJsonFromText } from '../backend/services/realInterviewAI/jsonExtractor.js';

const apiKey = (process.env.REAL_INTERVIEW_HR_API_KEY || '').trim();

if (!apiKey) {
  console.log('REAL_INTERVIEW_HR_API_KEY is missing');
  process.exit(1);
}

// 1. Fetch model list from GET https://api.groq.com/openai/v1/models
console.log('--- Fetching models from Groq API with REAL_INTERVIEW_HR_API_KEY ---');
const res = await fetch('https://api.groq.com/openai/v1/models', {
  headers: { 'Authorization': 'Bearer ' + apiKey }
});
const data = await res.json();
console.log('GET /v1/models HTTP status:', res.status);

const accessibleModels = [];
if (data.data && Array.isArray(data.data)) {
  console.log('Accessible model IDs returned by Groq API:');
  for (const m of data.data) {
    if (m.active !== false) {
      accessibleModels.push(m.id);
      console.log(` - ${m.id}`);
    }
  }
} else {
  console.log('Response error/data:', data);
  process.exit(1);
}

// 2. Test text-generation with accessible candidates
const userPrompt = 'Candidate Profile:\n- Full Name: Rohan Sharma\n- Education: B.Tech CS\n\nGenerate EXACTLY 5 deep HR questions in valid JSON.';

const textGenCandidates = accessibleModels.filter(id => 
  id.includes('llama') || id.includes('gpt-oss') || id.includes('qwen') || id.includes('compound') || id.includes('allam')
);

console.log('\n--- Testing HR generation with candidate text-generation models ---');
for (const model of textGenCandidates) {
  try {
    console.log(`Testing model: "${model}"...`);
    const rawContent = await callPythonGroqBridge({
      round: 'hr',
      apiKey,
      model,
      messages: [
        { role: 'system', content: 'You are a JSON API endpoint. Output ONLY valid JSON starting with {"questions": [...]}' },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      timeoutMs: 60000,
    });
    const parsed = extractJsonFromText(rawContent);
    const questions = parsed?.questions || parsed?.data || (Array.isArray(parsed) ? parsed : null);
    if (Array.isArray(questions) && questions.length >= 5) {
      console.log(`✅ Model "${model}" SUCCESS! Generated ${questions.length} questions.`);
    } else {
      console.log(`⚠️ Model "${model}" responded but questions array length was ${questions?.length}`);
    }
  } catch (e) {
    console.log(`❌ Model "${model}" FAILED: ${e.message}`);
  }
}
