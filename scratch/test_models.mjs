import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY_TECHNICAL || process.env.GROQ_API_KEY });
async function test() {
  const models = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
  for (const model of models) {
    try {
      const res = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an AI. Return JSON object.' },
          { role: 'user', content: 'Return a JSON object with key "status" and value "ok"' }
        ],
        response_format: { type: 'json_object' }
      });
      console.log(model, '-> SUCCESS:', res.choices[0].message.content.trim().slice(0, 50));
    } catch (e) {
      console.log(model, '-> FAIL:', e.status, e.message);
    }
  }
}
test();
