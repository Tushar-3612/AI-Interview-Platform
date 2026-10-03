import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_SCRIPT_PATH = path.resolve(__dirname, "../../python_ai/groq_bridge.py");

/**
 * Executes a Groq API request via the Python bridge.
 * Node.js (Prompt & Logic) -> Python (HTTP Client) -> Groq API -> Node.js (Validation & Persistence)
 * 
 * @param {Object} options
 * @param {string} options.round - e.g. "technical", "aptitude", "project", "hr", "coding"
 * @param {string} options.apiKey - Groq API key (never printed)
 * @param {string} options.model - Groq model identifier
 * @param {Array} options.messages - Chat completion messages array
 * @param {number} [options.temperature=0.2]
 * @param {number} [options.max_tokens=4000]
 * @param {number} [options.timeoutMs=60000]
 * @returns {Promise<string>} Raw AI text response
 */
export async function callPythonGroqBridge({
  round = "unknown",
  apiKey,
  model = "openai/gpt-oss-20b",
  messages = [],
  temperature = 0.2,
  max_tokens = 4000,
  timeoutMs = 60000,
}) {
  if (!apiKey) {
    throw new Error(`[PythonAIBridge][${round}] API key is required`);
  }

  console.log(`\n[PYTHON-AI-BRIDGE]\nround=${round}\nrequestStarted=true`);

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [BRIDGE_SCRIPT_PATH], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutData = "";
    let stderrData = "";
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        pythonProcess.kill();
        reject(new Error(`[PythonAIBridge][${round}] Python bridge request timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    pythonProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    pythonProcess.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    pythonProcess.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(new Error(`[PythonAIBridge][${round}] Failed to spawn Python process: ${err.message}`));
      }
    });

    pythonProcess.on("close", (code) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);

      if (!stdoutData.trim()) {
        return reject(new Error(`[PythonAIBridge][${round}] Python bridge exited with code ${code} and empty output: ${stderrData}`));
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        if (parsed.success) {
          console.log(`\n[PYTHON-AI-BRIDGE]\nround=${round}\ngroqResponseReceived=true`);
          return resolve(parsed.content || "");
        } else {
          const err = new Error(`[PythonAIBridge][${round}] Groq request failed: ${parsed.error || "Unknown error"}`);
          if (parsed.status) err.status = parsed.status;
          if (parsed.retry_after) err.retryAfter = parsed.retry_after;
          return reject(err);
        }
      } catch (parseErr) {
        return reject(new Error(`[PythonAIBridge][${round}] Failed to parse Python stdout JSON: ${stdoutData.trim()}`));
      }
    });

    const payload = JSON.stringify({
      apiKey,
      model,
      messages,
      temperature,
      max_tokens,
    });

    pythonProcess.stdin.write(payload);
    pythonProcess.stdin.end();
  });
}
