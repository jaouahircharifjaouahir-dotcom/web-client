import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    testTimeout: 120_000,
    globalSetup: ["src/seo/test-helpers/staged-static-site-global-setup.mjs"],
    setupFiles: ["src/seo/test-helpers/vitest-rpc-yield.setup.ts"],
  },
});
