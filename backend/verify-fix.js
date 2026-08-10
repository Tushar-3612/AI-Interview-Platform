// Quick verification: print the generated Main.java to check escaping
import { executeSingle } from "./services/codeExecutionService.js";

const code = `class Solution {
    public static int solve(String s) {
        return s.length();
    }
}`;

const result = await executeSingle("java", code, ["hello"], { timeLimitMs: 5000 });
console.log("Result type:", result.type);
console.log("Result output:", result.output);
if (result.type !== "success") {
  console.log("Full error:", result.output);
}
