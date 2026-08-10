// Test what template literal produces
const template = `
    static String toJsonString(String s) {
        StringBuilder sb = new StringBuilder("\\\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\\\\\""); break;
                case '\\\\': sb.append("\\\\\\\\\\\\"); break;
                case '\\n': sb.append("\\\\\\n"); break;
                case '\\r': sb.append("\\\\\\r"); break;
                case '\\t': sb.append("\\\\\\t"); break;
                default:
                    if (c < 32) sb.append(String.format("\\\\\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append("\\\"").toString();
    }
`;

console.log("=== Generated Java ===");
console.log(template);
console.log("=== END ===");
