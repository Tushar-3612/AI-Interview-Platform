/**
 * Language registry — maps the platform's language ids to Monaco language ids,
 * file extensions, and provides IntelliSense (completion + hover) metadata.
 *
 * The Monaco JS/TS language service already provides rich IntelliSense for
 * JavaScript / TypeScript out of the box. For compiled/interpreted languages we
 * register lightweight "monaco.languages" providers (completion + hover) so the
 * editor still feels first class.
 */

export const LANGUAGE_META = {
  javascript: {
    label: "JavaScript",
    monacoId: "javascript",
    ext: "js",
    tmLanguage: "javascript",
    mime: "text/javascript",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
  typescript: {
    label: "TypeScript",
    monacoId: "typescript",
    ext: "ts",
    tmLanguage: "typescript",
    mime: "text/typescript",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
  python: {
    label: "Python",
    monacoId: "python",
    ext: "py",
    tmLanguage: "python",
    mime: "text/x-python",
    commentLine: "#",
    commentBlock: { start: '"""', end: '"""' },
  },
  java: {
    label: "Java",
    monacoId: "java",
    ext: "java",
    tmLanguage: "java",
    mime: "text/x-java",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
  c: {
    label: "C",
    monacoId: "c",
    ext: "c",
    tmLanguage: "c",
    mime: "text/x-c",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
  cpp: {
    label: "C++",
    monacoId: "cpp",
    ext: "cpp",
    tmLanguage: "cpp",
    mime: "text/x-c++",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
  csharp: {
    label: "C#",
    monacoId: "csharp",
    ext: "cs",
    tmLanguage: "csharp",
    mime: "text/x-csharp",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
  go: {
    label: "Go",
    monacoId: "go",
    ext: "go",
    tmLanguage: "go",
    mime: "text/x-go",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
  rust: {
    label: "Rust",
    monacoId: "rust",
    ext: "rs",
    tmLanguage: "rust",
    mime: "text/x-rust",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
  kotlin: {
    label: "Kotlin",
    monacoId: "kotlin",
    ext: "kt",
    tmLanguage: "kotlin",
    mime: "text/x-kotlin",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
  php: {
    label: "PHP",
    monacoId: "php",
    ext: "php",
    tmLanguage: "php",
    mime: "text/x-php",
    commentLine: "//",
    commentBlock: { start: "/*", end: "*/" },
  },
};

/** Language ids supported by the editor theme. */
export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_META);

/**
 * Snippets registered as a Monaco completion-item provider.
 * Each entry: { label, insertText, documentation, kind }
 */
export const LANGUAGE_SNIPPETS = {
  javascript: [
    { label: "for loop", insertText: "for (let i = 0; i < ${1:arr}.length; i++) {\n\t$0\n}", documentation: "for loop", kind: 9 },
    { label: "forEach", insertText: "${1:arr}.forEach((${2:item}) => {\n\t$0\n});", documentation: "forEach loop", kind: 9 },
    { label: "console.log", insertText: 'console.log(${1:"hello"});', documentation: "console.log()", kind: 9 },
    { label: "arrow function", insertText: "const ${1:fn} = (${2:params}) => {\n\t$0\n};", documentation: "Arrow function", kind: 9 },
  ],
  typescript: [
    { label: "for loop", insertText: "for (let i = 0; i < ${1:arr}.length; i++) {\n\t$0\n}", documentation: "for loop", kind: 9 },
    { label: "forEach", insertText: "${1:arr}.forEach((${2:item}) => {\n\t$0\n});", documentation: "forEach loop", kind: 9 },
    { label: "console.log", insertText: 'console.log(${1:"hello"});', documentation: "console.log()", kind: 9 },
    { label: "arrow function", insertText: "const ${1:fn} = (${2:params}): ${3:void} => {\n\t$0\n};", documentation: "Arrow function with return type", kind: 9 },
    { label: "interface", insertText: "interface ${1:Name} {\n\t$0\n}", documentation: "Interface declaration", kind: 9 },
    { label: "type", insertText: "type ${1:Name} = ${2:string};", documentation: "Type alias", kind: 9 },
  ],
  python: [
    { label: "for range", insertText: "for i in range(${1:n}):\n    $0", documentation: "for loop over range", kind: 9 },
    { label: "list comp", insertText: "${1:result} = [${2:x} for ${2:x} in ${3:arr} if ${4:True}]", documentation: "list comprehension", kind: 9 },
    { label: "print", insertText: "print(${1:'hello'})", documentation: "print()", kind: 9 },
    { label: "def", insertText: "def ${1:solution}(${2:*args}):\n    ${3:pass}", documentation: "function definition", kind: 9 },
  ],
  java: [
    { label: "println", insertText: "System.out.println(${1:result});", documentation: "System.out.println()", kind: 9 },
    { label: "for loop", insertText: "for (int i = 0; i < ${1:n}; i++) {\n    $0\n}", documentation: "for loop", kind: 9 },
    { label: "Scanner", insertText: "import java.util.Scanner;\nScanner sc = new Scanner(System.in);", documentation: "Scanner input", kind: 9 },
    { label: "ArrayList", insertText: "import java.util.ArrayList;\nArrayList<${1:Int}> ${2:list} = new ArrayList<>();", documentation: "ArrayList", kind: 9 },
  ],
  c: [
    { label: "printf", insertText: 'printf("${1:%d}\\n", ${2:value});', documentation: "printf()", kind: 9 },
    { label: "scanf", insertText: 'scanf("%d", &${1:value});', documentation: "scanf()", kind: 9 },
    { label: "for loop", insertText: "for (int i = 0; i < ${1:n}; i++) {\n    $0\n}", documentation: "for loop", kind: 9 },
    { label: "main", insertText: "int main() {\n    $0\n    return 0;\n}", documentation: "main function", kind: 9 },
  ],
  cpp: [
    { label: "cin cout", insertText: "cout << ${1:value} << endl;", documentation: "cout", kind: 9 },
    { label: "cin", insertText: "cin >> ${1:value};", documentation: "cin", kind: 9 },
    { label: "vector", insertText: "vector<${1:int}> ${2:v}(${3:n});", documentation: "vector", kind: 9 },
    { label: "for loop", insertText: "for (int i = 0; i < ${1:n}; i++) {\n    $0\n}", documentation: "for loop", kind: 9 },
    { label: "std::", insertText: "std::", documentation: "std namespace", kind: 9 },
  ],
  csharp: [
    { label: "WriteLine", insertText: "Console.WriteLine(${1:result});", documentation: "Console.WriteLine()", kind: 9 },
    { label: "for loop", insertText: "for (int i = 0; i < ${1:n}; i++) {\n    $0\n}", documentation: "for loop", kind: 9 },
    { label: "List<T>", insertText: "List<${1:int}> ${2:list} = new List<${1:int}>();", documentation: "List<T>", kind: 9 },
  ],
  go: [
    { label: "fmt.Println", insertText: "fmt.Println(${1:result})", documentation: "fmt.Println()", kind: 9 },
    { label: "for loop", insertText: "for i := 0; i < ${1:n}; i++ {\n    $0\n}", documentation: "for loop", kind: 9 },
    { label: "func", insertText: "func ${1:solution}(${2:args ...interface{}}) interface{} {\n    $0\n}", documentation: "function", kind: 9 },
  ],
  rust: [
    { label: "println", insertText: 'println!("{:?}", ${1:result});', documentation: "println!", kind: 9 },
    { label: "let", insertText: "let ${1:mut }${2:var} = ${3:value};", documentation: "let binding", kind: 9 },
    { label: "for loop", insertText: "for i in 0..${1:n} {\n    $0\n}", documentation: "for loop", kind: 9 },
    { label: "vec", insertText: "let ${1:v} = vec![${2:1, 2, 3}];", documentation: "vec! macro", kind: 9 },
  ],
  kotlin: [
    { label: "println", insertText: "println(${1:result})", documentation: "println()", kind: 9 },
    { label: "for loop", insertText: "for (i in 0..${1:n - 1}) {\n    $0\n}", documentation: "for loop", kind: 9 },
    { label: "fun", insertText: "fun ${1:solution}(${2:vararg args: Any}): Any? {\n    $0\n}", documentation: "function", kind: 9 },
    { label: "listOf", insertText: "val ${1:list} = listOf(${2:1, 2, 3})", documentation: "listOf", kind: 9 },
  ],
  php: [
    { label: "echo", insertText: 'echo ${1:"hello"} . PHP_EOL;', documentation: "echo", kind: 9 },
    { label: "for loop", insertText: "for ($i = 0; $i < ${1:n}; $i++) {\n    $0\n}", documentation: "for loop", kind: 9 },
    { label: "function", insertText: "function ${1:solution}(...$args) {\n    return $0;\n}", documentation: "function", kind: 9 },
  ],
};

/**
 * Hover documentation for common stdlib APIs per language.
 * Keys are matched as case-insensitive prefixes in completion.
 */
export const LANGUAGE_HOVER = {
  javascript: {
    "console.log": `console.log(...data)\n\nPrints one or more values to the console (stdout).`,
    "console.error": `console.error(...data)\n\nPrints an error message to stderr.`,
    "console.warn": `console.warn(...data)\n\nPrints a warning message.`,
    "String": `String([value])\n\nConverts a value to a string.`,
    "parseInt": `parseInt(string, radix)\n\nParses a string argument to an integer.`,
    "parseFloat": `parseFloat(string)\n\nParses a string argument to a float.`,
    "Array": `Array\n\nA collection of items. Common methods: push, pop, slice, map, filter, reduce.`,
  },
  typescript: {
    "console.log": `console.log(...data: any[]): void\n\nPrints one or more values to the console (stdout).`,
    "console.error": `console.error(...data: any[]): void\n\nPrints an error message to stderr.`,
    "Array": `Array<T>\n\nA collection of items. Common methods: push, pop, slice, map, filter, reduce.`,
    "Promise": `Promise<T>\n\nAn object representing the eventual completion or failure of an async operation.`,
    "Record": `Record<K, V>\n\nA utility type that constructs an object type with keys K and values V.`,
  },
  python: {
    "print": `print(*objects, sep=' ', end='\\n')\n\nPrints objects to the text stream file, separated by sep, ending with end.`,
    "len": `len(obj)\n\nReturns the length (the number of items) of an object.`,
    "range": `range(stop) / range(start, stop[, step])\n\nImmutable sequence of numbers.`,
    "list": `list([iterable])\n\nA mutable, sequence of objects.`,
    "dict": `dict()\n\nA mapping of unique immutable keys to mutable values.`,
    "str": `str([object])\n\nA string is an immutable sequence of characters.`,
    "int": `int([x])\n\nAn integer; an integral value.`,
  },
  java: {
    "System.out.println": `System.out.println(data)\n\nPrints a line to standard output.`,
    "System.out.print": `System.out.print(data)\n\nPrints to standard output without a newline.`,
    "Scanner": `java.util.Scanner\n\nA simple text scanner which can parse primitive types and strings.`,
    "ArrayList": `java.util.ArrayList<E>\n\nResizable-array implementation of the List interface.`,
    "HashMap": `java.util.HashMap<K,V>\n\nA hash table based implementation of Map interface.`,
    "Math": `java.lang.Math\n\nCommon math functions: max, min, abs, sqrt, pow.`,
  },
  c: {
    "printf": `int printf(const char *format, ...)\n\nPrints output to stdout.`,
    "scanf": `int scanf(const char *format, ...)\n\nReads formatted input from stdin.`,
    "strlen": `size_t strlen(const char *s)\n\nReturns the length of the string.`,
    "malloc": `void *malloc(size_t size)\n\nDynamically allocates memory.`,
    "stdlib": `<stdlib.h>\n\nMemory, rand, exit, atoi, stdio, etc.`,
  },
  cpp: {
    "cout": `std::cout\n\nCharacter output stream (used with <<).`,
    "cin": `std::cin\n\nCharacter input stream (used with >>).`,
    "vector": `std::vector<T>\n\nSequence container. Methods: push_back, pop_back, size, begin, end, at.`,
    "map": `std::map<K,V>\n\nSorted associative container.`,
    "string": `std::string\n\nA sequence of characters.`,
    "algorithm": `<algorithm>\n\nsort, lower_bound, upper_bound, find, etc.`,
    "endl": `std::endl\n\nInserts a newline and flushes the output buffer.`,
    "std::vector": `std::vector<T>\n\nDynamic array.`,
  },
  csharp: {
    "WriteLine": `Console.WriteLine(value)\n\nPrints a line to standard output.`,
    "List<T>": `List<T>\n\nResizable list. Add, Remove, Find, etc.`,
    "Math": `Math class\n\nmax, min, abs, Sqrt, Pow, etc.`,
    "String": `String\n\nImmutable string. Methods: Split, Trim, ToUpper, etc.`,
  },
  go: {
    "fmt.Println": `fmt.Println(a ...any)\n\nPrints to stdout with a newline.`,
    "fmt.Scan": `fmt.Scan(a ...any)\n\nScan reads from stdin.`,
    "len": `len(v)\n\nReturns the length of v.`,
    "append": `append(slice, elements...)\n\nAppends elements to a slice.`,
    "make": `make(T, size)\n\nCreates a slice/map/channel.`,
    "strconv": `strconv\n\nString conversions: Atoi, Itoa.`,
    "sort": `sort\n\nSorting: sort.Ints, sort.Strings, sort.Slice.`,
  },
  rust: {
    "println!": `println!(fmt, args...)\n\nPrints to stdout with newline.`,
    "vec!": `vec![...]\n\nCreates a Vec (growable array).`,
    "String": `String\n\nOwned, heap-allocated string.`,
    "Vec": `Vec<T>\n\nA growable array.`,
    "clone": `.clone()\n\nCreates a deep copy of a value.`,
  },
  kotlin: {
    "println": `println(value)\n\nPrints a line to stdout.`,
    "readln": `readln()\n\nReads a line from stdin.`,
    "listOf": `listOf(elements...)\n\nReturns an immutable List.`,
    "mutableListOf": `mutableListOf(elements...)\n\nReturns a mutable List.`,
    "mapOf": `mapOf(pairs)\n\nReturns a Map.`,
    "toInt": `.toInt()\n\nConverts to Int.`,
  },
  php: {
    "echo": `echo expr\n\nOutputs one or more strings.`,
    "PHP_EOL": `PHP_EOL\n\nThe platform-specific newline character.`,
    "strlen": `strlen(string)\n\nReturns the length of a string.`,
    "explode": `explode(delimiter, string)\n\nSplits a string by a delimiter.`,
    "implode": `implode(separator, array)\n\nJoins array elements into a string.`,
    "array": `array\n\nPHP arrays are ordered maps.`,
  },
};

/** Monaco completion item kinds mapped to symbols. */
export const COMPLETION_KINDS = {
  keyword: 14,
  function: 3,
  method: 2,
  variable: 13,
  class: 6,
  snippet: 9,
  property: 10,
};

/**
 * Token-ish keyword list used to build a small completion provider for the
 * non-JS languages. Returns suggestions that match what the user typed.
 */
export const LANGUAGE_KEYWORDS = {
  python: ["def", "if", "elif", "else", "for", "while", "try", "except", "finally", "with", "import", "from", "class", "return", "yield", "lambda", "pass", "break", "continue", "global", "nonlocal", "raise", "assert", "in", "not", "and", "or", "None", "True", "False", "is"],
  typescript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "class", "extends", "implements", "interface", "type", "enum", "import", "export", "from", "default", "public", "private", "protected", "static", "readonly", "abstract", "new", "this", "super", "typeof", "instanceof", "void", "null", "undefined", "true", "false", "any", "never", "unknown", "object", "string", "number", "boolean", "Promise", "Array", "Record"],
  java: ["class", "public", "private", "protected", "static", "final", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "return", "try", "catch", "finally", "throw", "throws", "import", "package", "new", "this", "super", "extends", "implements", "interface", "enum", "void", "int", "double", "float", "char", "boolean", "long", "short", "byte", "String", "null", "true", "false", "synchronized"],
  c: ["int", "char", "float", "double", "long", "short", "void", "unsigned", "signed", "const", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "return", "goto", "struct", "typedef", "union", "enum", "sizeof", "include", "define", "NULL", "true", "false", "static", "extern", "register", "volatile", "auto"],
  cpp: ["if", "else", "for", "while", "do", "switch", "case", "break", "continue", "return", "goto", "struct", "typedef", "union", "enum", "sizeof", "class", "public", "private", "protected", "virtual", "override", "new", "delete", "template", "typename", "namespace", "using", "auto", "const", "static", "friend", "virtual", "inline", "operator", "constexpr", "nullptr", "NULL", "string", "vector", "map", "set", "unordered_map", "unordered_set", "cin", "cout", "endl", "std", "include", "define"],
  csharp: ["class", "public", "private", "protected", "internal", "static", "readonly", "const", "if", "else", "for", "foreach", "while", "do", "switch", "case", "break", "continue", "return", "try", "catch", "finally", "throw", "using", "namespace", "using", "new", "this", "base", "virtual", "override", "abstract", "interface", "enum", "struct", "void", "int", "double", "float", "char", "bool", "string", "object", "long", "short", "decimal", "List", "Console", "Math", "null", "true", "false"],
  go: ["func", "if", "else", "for", "switch", "case", "default", "break", "continue", "return", "import", "package", "var", "const", "type", "struct", "interface", "map", "chan", "go", "select", "defer", "range", "nil", "true", "false", "make", "len", "cap", "append", "copy", "new"],
  rust: ["fn", "let", "if", "else", "match", "for", "while", "loop", "break", "continue", "return", "struct", "enum", "trait", "impl", "use", "mod", "pub", "static", "const", "mut", "ref", "move", "as", "in", "Box", "Vec", "String", "Option", "Some", "None", "Ok", "Err", "Self", "self", "crate", "true", "false", "let"],
  kotlin: ["fun", "val", "var", "if", "else", "when", "for", "while", "do", "return", "break", "continue", "class", "object", "interface", "trait", "enum", "data", "sealed", "open", "public", "private", "protected", "internal", "final", "abstract", "override", "import", "package", "as", "is", "in", "not", "null", "true", "false", "this", "super", "companion", "object", "by", "tailrec", "operator"],
  php: ["if", "else", "elseif", "while", "do", "for", "foreach", "switch", "case", "default", "break", "continue", "return", "function", "class", "public", "private", "protected", "static", "const", "abstract", "final", "interface", "extends", "implements", "trait", "use", "namespace", "new", "null", "true", "false", "array", "echo", "print", "isset", "empty", "isset"],
};

export default { LANGUAGE_META, SUPPORTED_LANGUAGES, LANGUAGE_SNIPPETS, LANGUAGE_HOVER, LANGUAGE_KEYWORDS, COMPLETION_KINDS };
