const fs = require("fs");
const content = fs.readFileSync("frontend/src/utils/coding/monacoSetup.js", "utf8");
const lines = content.split("\n");
console.log("Line 20 (0-indexed 19):");
console.log(JSON.stringify(lines[19]));
console.log("");
console.log("Line 246 (wordPattern usage):");
if (lines[245]) console.log(JSON.stringify(lines[245]));
