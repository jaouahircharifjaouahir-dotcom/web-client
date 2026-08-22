import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: process.env.VITE_BASE || (command === "build" ? "/web-client/" : "/"),
  build: {
    target: "es2022",
    cssMinify: true,
    minify: "esbuild",
    sourcemap: false,
    modulePreload: { polyfill: false },
  },
  esbuild: {
    drop: ["debugger"],
    legalComments: "none",
  },
  server: {
    proxy: {
      "/blogger-api": {
        target: "http://127.0.0.1:8788",
      },
    },
  },
}));
