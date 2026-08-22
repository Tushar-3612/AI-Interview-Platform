import { executeSingle } from "./services/codeExecutionService.js";

const code = `class Solution {
    public static int solve(String s) {
        return s.length();
    }
}`;

console.log("CALLING executeSingle...");
const p = executeSingle("java", code, ["abc"], { timeLimitMs: 2000 });
const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("SELF_TIMEOUT_60s")), 60000));
try {
  const r = await Promise.race([p, timeout]);
  console.log("RESULT:", JSON.stringify(r).slice(0, 500));
} catch (e) {
  console.log("CAUGHT:", e.message);
  process.exit(1);
}
process.exit(0);
