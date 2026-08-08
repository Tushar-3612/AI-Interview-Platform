import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["@monaco-editor/react"],
    // Monaco ships its own worker entry-points that must not be pre-bundled.
    exclude: ["monaco-editor"],
  },
  ssr: {
    noExternal: ["@monaco-editor/react"],
  },
});
