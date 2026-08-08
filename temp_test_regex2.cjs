const parts = [
  { name: "outer group + number", pattern: "(-?\\d*\\.\\d)" },
  { name: "identifier with colon", pattern: "([_\\p{L}\\p{N}$@#]*:[<># ]*)" },
  { name: "number with @ suffix", pattern: "(-?\\d*\\.?\\d(?:@[^;]+;)?)" },
  { name: "hash/pound word", pattern: "([#@]\\w*)" },
  { name: "neg lookbehind word", pattern: "(?<![^\\s\"'{] )\\b[a-zA-Z_$]\\w*" },
  { name: "pos lookbehind bracket", pattern: "(?<=^[^\"'=;\\]\\}])\\][a-zA-Z_$]\\w*" },
  { name: "full alternation 1", pattern: "(-?\\d*\\.\\d|[_\\p{L}\\p{N}$@#]*:[<># ]*)" },
  { name: "full alternation 2", pattern: "(-?\\d*\\.\\d|[_\\p{L}\\p{N}$@#]*:[<># ]*|-?\\d*\\.?\\d(?:@[^;]+;)?)" },
  { name: "full alternation 3", pattern: "(-?\\d*\\.\\d|[_\\p{L}\\p{N}$@#]*:[<># ]*|-?\\d*\\.?\\d(?:@[^;]+;)?|[#@]\\w*)" },
  { name: "with first neg lookbehind", pattern: "(-?\\d*\\.\\d|[_\\p{L}\\p{N}$@#]*:[<># ]*|-?\\d*\\.?\\d(?:@[^;]+;)?|[#@]\\w*|(?<![^\\s\"'{] )\\b[a-zA-Z_$]\\w*)" },
  { name: "two neg lookbehinds", pattern: "(-?\\d*\\.\\d|[_\\p{L}\\p{N}$@#]*:[<># ]*|-?\\d*\\.??\\d(?:@[^;]+;)?|[#@]\\w*|(?<![^\\s\"'{] )\\b[a-zA-Z_$]\\w*|(?<![^\\s\"'{] )\\b[a-zA-Z_$]\\w*)" },
  { name: "one pos lookbehind added", pattern: "(-?\\d*\\.\\d|[_\\p{L}\\p{N}$@#]*:[<># ]*|-?\\d*\\.?\\d(?:@[^;]+;)?|[#@]\\w*|(?<![^\\s\"'{] )\\b[a-zA-Z_$]\\w*|(?<![^\\s\"'{] )\\b[a-zA-Z_$]\\w*|(?<=^[^\"'=;\\]\\}])\\][a-zA-Z_$]\\w*)" },
  { name: "full regex", pattern: "(-?\\d*\\.\\d|[_\\p{L}\\p{N}$@#]*:[<># ]*|-?\\d*\\.?\\d(?:@[^;]+;)?|[#@]\\w*|(?<![^\\s\"'{] )\\b[a-zA-Z_$]\\w*|(?<![^\\s\"'{] )\\b[a-zA-Z_$]\\w*|(?<=^[^\"'=;\\]\\}])\\][a-zA-Z_$]\\w*|(?<=^[^\"'=;\\]\\}])\\][a-zA-Z_$]\\w*)" },
];

for (const { name, pattern } of parts) {
  try {
    new RegExp(pattern, "g");
    console.log("OK:", name);
  } catch(e) {
    console.log("FAIL:", name, "-", e.message);
  }
}
