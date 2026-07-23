import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-2.5-flash";

let aiInstance = null;

function getClient() {
  if (!aiInstance) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiInstance;
}

export async function generateJSON(prompt, options = {}) {
  const model = options.model || GEMINI_MODEL;
  const maxRetries = options.maxRetries || 2;
  const timeout = options.timeout || 30000;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ai = getClient();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await ai.models.generateContent({
        model,
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: options.maxOutputTokens || 8192,
          temperature: options.temperature || 0.3,
        },
      });

      clearTimeout(timeoutId);

      const text = response.text;
      if (!text || text.trim() === "") {
        throw new Error("Empty response from Gemini");
      }

      const parsed = JSON.parse(text);
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw new Error(`Gemini API failed after ${maxRetries} retries: ${lastError.message}`);
}

export function resetClient() {
  aiInstance = null;
}

export default { generateJSON, resetClient };
