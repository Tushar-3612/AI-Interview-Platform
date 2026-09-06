import { callPythonGroqBridge } from '../backend/services/realInterviewAI/pythonGroqBridge.js';
import { extractJsonFromText } from '../backend/services/realInterviewAI/jsonExtractor.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    const prompt = 'Generate a JSON object with key "questions" containing EXACTLY 15 placement-level aptitude questions. Each question has "question", "options" (array of 4 objects with "label" and "text"), "correctAnswer", "explanation", "difficulty", "topic", "questionType". Output JSON ONLY.';
    const rawText = await callPythonGroqBridge({
        round: 'aptitude',
        apiKey: process.env.REAL_INTERVIEW_TECHNICAL_API_KEY,
        model: 'openai/gpt-oss-120b',
        temperature: 0.1,
        max_tokens: 3500,
        messages: [
            { role: 'system', content: 'Output valid JSON starting immediately with {"questions": [...]} without reasoning or markdown.' },
            { role: 'user', content: prompt }
        ]
    });
    console.log('Raw text length:', rawText.length);
    const parsed = extractJsonFromText(rawText);
    console.log('Parsed questions count:', parsed?.questions?.length);
    if (parsed?.questions?.length > 0) {
        console.log('Sample Q1:', parsed.questions[0].question);
        console.log('Sample Q15:', parsed.questions[parsed.questions.length - 1].question);
    }
}
test().catch(console.error);
