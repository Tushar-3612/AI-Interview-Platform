const fs = require("fs");
const content = fs.readFileSync("frontend/src/utils/coding/monacoSetup.js", "utf8");
const lines = content.split("\n");
const line20 = lines[19]; // 0-indexed

console.log("Line 20 length:", line20.length);
console.log("Raw line 20:");
console.log(line20);

// Now extract just the regex pattern between first and last /
const regexStart = line20.indexOf("/");
const regexEnd = line20.lastIndexOf("/");
const rawRegex = line20.substring(regexStart + 1, regexEnd);
console.log("\nRaw regex content (between delimiters):");
console.log(rawRegex);

console.log("\nChar-by-char for the positive lookbehind section:");
const section = rawRegex.substring(regexStart); // not right, let me search
const idx = rawRegex.indexOf("(?<=^");
if (idx >= 0) {
  const sub = rawRegex.substring(idx, idx + 60);
  console.log("From (?<=^ ...");
  console.log(JSON.stringify(sub));
  for (let i = 0; i < sub.length; i++) {
    console.log(`  [${idx+i}] '${sub[i]}' (0x${sub.charCodeAt(i).toString(16)})`);
  }
}
