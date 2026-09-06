import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const keys = [
  { name: "APTITUDE", key: process.env.REAL_INTERVIEW_APTITUDE_API_KEY },
  { name: "TECHNICAL", key: process.env.REAL_INTERVIEW_TECHNICAL_API_KEY },
  { name: "PROJECT", key: process.env.REAL_INTERVIEW_PROJECT_API_KEY },
  { name: "HR", key: process.env.REAL_INTERVIEW_HR_API_KEY },
  { name: "CODING", key: process.env.REAL_INTERVIEW_CODING_API_KEY },
];

const modelsToTest = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "openai/gpt-oss-120b"];

async function testKeyModel(keyObj, model) {
  if (!keyObj.key) return { status: "MISSING_KEY" };
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keyObj.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });
    const status = res.status;
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, status };
    }
    return { ok: false, status, err: body.error?.message || body.error?.code };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

async function run() {
  console.log("=== GROQ KEY & MODEL COMPATIBILITY TEST ===");
  for (const k of keys) {
    console.log(`\nKey: ${k.name}`);
    for (const m of modelsToTest) {
      const res = await testKeyModel(k, m);
      console.log(`  Model: ${m.padEnd(25)} -> OK: ${res.ok} (Status: ${res.status || 'ERR'}, Msg: ${res.err || 'Success'})`);
    }
  }
}

run();
