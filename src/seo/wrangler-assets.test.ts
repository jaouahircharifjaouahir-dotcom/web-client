import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PHASE53_RUN_WORKER_FIRST } from "./test-helpers/cloudflare-run-worker-first.ts";
import { matchesRunWorkerFirst } from "./test-helpers/run-worker-first.ts";

describe("Workers Static Assets routing", () => {
  const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));

  it("uses hard 404 asset fallback and Worker-first retirement paths", () => {
    expect(wrangler.assets.not_found_handling).toBe("404-page");
    // Canonical URLs are *.html (sitemap/hreflang/internal links). Do not 307 strip .html.
    expect(wrangler.assets.html_handling).toBe("none");
    expect(wrangler.assets.run_worker_first).toEqual([...PHASE53_RUN_WORKER_FIRST]);
    expect(wrangler.assets.run_worker_first.filter((r: string) => r.startsWith("!/l/"))).toEqual([]);
    expect(wrangler.assets.run_worker_first).not.toContain("!/l/*/2026/*");
    expect(wrangler.assets.run_worker_first).not.toContain("!/l/*/p/*");
    expect(wrangler.assets.run_worker_first).not.toContain("!/p/about.html");
    // Phase 4A: robots/llms/sitemap/IndexNow are direct Assets (zone HSTS); zone routes remain.
    expect(wrangler.routes.some((r) => r.pattern === "www.11tik.com/robots.txt")).toBe(true);
    expect(wrangler.routes.some((r) => r.pattern === "www.11tik.com/llms.txt")).toBe(true);
    expect(wrangler.assets.run_worker_first).not.toContain("/robots.txt");
    expect(wrangler.assets.run_worker_first).not.toContain("/llms.txt");
    expect(wrangler.assets.run_worker_first).not.toContain("/sitemap.xml");
    expect(wrangler.assets.run_worker_first).not.toContain("/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt");
    expect(
      wrangler.routes.some((r) => r.pattern === "www.11tik.com/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt"),
    ).toBe(true);
    expect(wrangler.assets.binding).toBe("ASSETS");
    // Phase 53: catch-all /* Worker-first; legacy/clean/locale paths verified by matcher.
    expect(matchesRunWorkerFirst("/2026/08/youtube-thumbnail-url.html")).toBe(true);
    expect(matchesRunWorkerFirst("/p/about.html")).toBe(true);
    expect(matchesRunWorkerFirst("/l/fr/about")).toBe(true);
    expect(matchesRunWorkerFirst("/about")).toBe(true);
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(true);
    expect(matchesRunWorkerFirst("/")).toBe(true);
    expect(matchesRunWorkerFirst("/web-client/index.html")).toBe(false);
    expect(matchesRunWorkerFirst("/robots.txt")).toBe(false);
    expect(matchesRunWorkerFirst("/sitemap.xml")).toBe(false);
    // Exact routes omit query-string URLs; trailing * is required (CF routes docs).
    expect(wrangler.routes.some((r) => r.pattern === "www.11tik.com/copyright*")).toBe(true);
    expect(wrangler.routes.some((r) => r.pattern === "www.11tik.com/copyright")).toBe(false);
    // Semrush HSTS: apex must hit Worker so 301→www carries Strict-Transport-Security.
    expect(wrangler.routes.some((r) => r.pattern === "11tik.com")).toBe(true);
    expect(wrangler.routes.some((r) => r.pattern === "11tik.com/*")).toBe(true);
    // Homepage query shells (/ ?bulk=1, ?posts=1, ?embed=1, ?m=1) need www.11tik.com/* route.
    expect(wrangler.routes.some((r) => r.pattern === "www.11tik.com/*")).toBe(true);
    expect(wrangler.kv_namespaces).toBeUndefined();
    expect(wrangler.triggers).toBeUndefined();
  });
});
