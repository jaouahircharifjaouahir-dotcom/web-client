import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
  build: {
    target: "es2022",
    cssMinify: true,
    modulePreload: { polyfill: false },
  },
  server: {
    proxy: {
      "/blogger-api": {
        target: "http://127.0.0.1:8788",
      },
    },
  },
});
