import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Workers Static Assets routing", () => {
  const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));

  it("uses official SPA fallback and Worker-first Blogger paths only", () => {
    expect(wrangler.assets.not_found_handling).toBe("single-page-application");
    expect(wrangler.assets.run_worker_first).toEqual([
      "/2026/*",
      "/p/*",
      "/feeds/*",
      "/sitemap-pages.xml",
      "/search",
      "/search/*",
      "/about",
      "/privacy",
      "/terms",
      "/contact",
    ]);
    expect(wrangler.assets.run_worker_first).not.toContain("/*");
    expect(wrangler.assets.run_worker_first).not.toContain("/thumb/*");
    expect(wrangler.kv_namespaces).toBeUndefined();
    expect(wrangler.triggers).toBeUndefined();
  });
});
