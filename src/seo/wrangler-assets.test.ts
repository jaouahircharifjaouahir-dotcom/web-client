import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Workers Static Assets routing", () => {
  const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));

  it("uses official SPA fallback and Worker-first Blogger paths only", () => {
    expect(wrangler.assets.not_found_handling).toBe("single-page-application");
    // Canonical URLs are *.html (sitemap/hreflang/internal links). Do not 307 strip .html.
    // File 1 / File 22 root fix: html_handling none — no Worker-first for /2026/*.html.
    expect(wrangler.assets.html_handling).toBe("none");
    expect(wrangler.assets.run_worker_first).toEqual([
      "/",
      "/sitemap.xml",
      "/robots.txt",
      "/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt",
      "/p/*",
      "/feeds/*",
      "/sitemap-pages.xml",
      "/search",
      "/search/*",
      "/about",
      "/privacy",
      "/terms",
      "/contact",
      "/copyright*",
    ]);
    // File 8 root: /robots.txt must be Worker-first Assets (not Blogger origin).
    expect(wrangler.routes.some((r) => r.pattern === "www.11tik.com/robots.txt")).toBe(true);
    expect(
      wrangler.routes.some((r) => r.pattern === "www.11tik.com/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt"),
    ).toBe(true);
    expect(wrangler.assets.binding).toBe("ASSETS");
    // Phase A: English /2026/* articles are Static Assets (Worker-zero).
    expect(wrangler.assets.run_worker_first).not.toContain("/2026/*");
    expect(wrangler.assets.run_worker_first).not.toContain("/2026/*.html");
    expect(wrangler.assets.run_worker_first).not.toContain("/l/*/2026/*.html");
    expect(wrangler.assets.run_worker_first).toContain("/p/*");
    expect(wrangler.assets.run_worker_first).not.toContain("/*");
    expect(wrangler.assets.run_worker_first).not.toContain("/thumb/*");
    // Exact routes omit query-string URLs; trailing * is required (CF routes docs).
    // Otherwise /copyright?m=1 falls through to Blogger and 404s.
    expect(wrangler.routes.some((r) => r.pattern === "www.11tik.com/copyright*")).toBe(true);
    expect(wrangler.routes.some((r) => r.pattern === "www.11tik.com/copyright")).toBe(false);
    expect(wrangler.kv_namespaces).toBeUndefined();
    expect(wrangler.triggers).toBeUndefined();
  });
});
