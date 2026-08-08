const fs = require("fs");
const content = fs.readFileSync("frontend/src/utils/coding/monacoSetup.js", "utf8");
const lines = content.split("\n");
console.log("Line 20:", JSON.stringify(lines[19]));
console.log("");
console.log("Total lines:", lines.length);
