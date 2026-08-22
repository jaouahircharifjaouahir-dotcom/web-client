import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  esbuild: {
    drop: ["debugger"],
    legalComments: "none",
  },
  build: {
    emptyOutDir: false,
    cssCodeSplit: false,
    target: "es2022",
    cssMinify: true,
    minify: "esbuild",
    sourcemap: false,
    lib: {
      entry: resolve(root, "src/embed-entry.tsx"),
      name: "YTE",
      formats: ["iife"],
      fileName: () => "blogger-app.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: "blogger-app.css",
        inlineDynamicImports: true,
        footer: "\n//# sourceMappingURL=blogger-app.js.map\n",
      },
    },
  },
});
