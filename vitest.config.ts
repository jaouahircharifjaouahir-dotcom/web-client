import { defineConfig } from "vitest/config";

/** vite-node leaves `#!/usr/bin/env node` in transformed scripts, which throws SyntaxError. */
function stripShebangPlugin() {
  return {
    name: "strip-shebang",
    transform(code: string, id: string) {
      if (id.includes("node_modules")) return null;
      if (!code.startsWith("#!")) return null;
      return { code: code.replace(/^#!.*\r?\n/, ""), map: null };
    },
  };
}

export default defineConfig({
  plugins: [stripShebangPlugin()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    testTimeout: 120_000,
    globalSetup: ["src/seo/test-helpers/staged-static-site-global-setup.mjs"],
    setupFiles: ["src/seo/test-helpers/vitest-rpc-yield.setup.ts"],
  },
});
