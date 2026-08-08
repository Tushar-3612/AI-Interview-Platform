const fs = require("fs");
const content = fs.readFileSync("frontend/src/utils/coding/monacoSetup.js", "utf8");

const match = content.match(/const WORD_PATTERN = \/([^\/]+)\/g/);
if (!match) {
  console.log("No WORD_PATTERN found");
  process.exit(1);
}

const source = match[1];
console.log("Source length:", source.length);
console.log("Source chars:");

for (let i = 0; i < source.length; i++) {
  const ch = source[i];
  const code = ch.charCodeAt(0);
  if (ch === '\\') {
    console.log(`  [${i}] \\ (backslash) next: '${source[i+1]}'`);
    i++; // skip next since we printed it as part of backslash
    continue;
  }
  console.log(`  [${i}] '${ch}' (0x${code.toString(16)})`);
}
