const fs = require("fs");
const content = fs.readFileSync("frontend/src/utils/coding/monacoSetup.js", "utf8");

// Extract the word pattern source
const match = content.match(/const WORD_PATTERN = \/([^\/]+)\/g/);
if (!match) {
  console.log("No WORD_PATTERN found");
  process.exit(1);
}

const patternSource = match[1];
console.log("Pattern source:", patternSource);

try {
  const re = new RegExp(patternSource, "g");
  console.log("Regex compiles OK with 'g' flag");
} catch(e) {
  console.log("Error with 'g' flag:", e.message);
}

try {
  const re = new RegExp(patternSource, "gu");
  console.log("Regex compiles OK with 'gu' flags");
} catch(e) {
  console.log("Error with 'gu' flags:", e.message);
}

// Also try the regex literal directly
try {
  eval(`const re = ${'/' + patternSource + '/g'};`);
  console.log("Regex literal compiles OK");
} catch(e) {
  console.log("Regex literal error:", e.message);
}
