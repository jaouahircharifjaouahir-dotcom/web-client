import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Workers Static Assets routing", () => {
  const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));

  it("uses hard 404 asset fallback and Worker-first retirement paths", () => {
    expect(wrangler.assets.not_found_handling).toBe("404-page");
    // Canonical URLs are *.html (sitemap/hreflang/internal links). Do not 307 strip .html.
    // File 1 / File 22 root fix: html_handling none — no Worker-first for /2026/*.html.
    expect(wrangler.assets.html_handling).toBe("none");
    expect(wrangler.assets.run_worker_first).toEqual([
      "/",
      "/thumb/*",
      "/feeds/pages/*",
      "/feeds/comments/*",
      "/feeds/other/*",
      "/feeds/posts/default",
      "/sitemap-images.xml",
      "/sitemap-pages.xml",
      "/search",
      "/search/*",
      "/copyright*",
      "/p/*",
      "!/p/about.html",
      "!/p/privacy.html",
      "!/p/terms-of-use.html",
      "!/p/contact.html",
      "!/p/embed.html",
      "!/p/keyword-tools.html",
      "/2026/*",
      "/l/*",
      "!/l/*/p/*.html",
    ]);
    expect(wrangler.assets.run_worker_first).toContain("/l/*");
    expect(wrangler.assets.run_worker_first).toContain("!/l/*/p/*.html");
    expect(wrangler.assets.run_worker_first).not.toContain("!/l/*/2026/*/*.html");
    // Phase R1: localized 2026 .html is Worker-first for hard 404 on miss.
    expect(
      wrangler.assets.run_worker_first.filter((r: string) => r === "/l/*" || r.startsWith("!/l/")),
    ).toEqual(["/l/*", "!/l/*/p/*.html"]);
    expect(wrangler.assets.run_worker_first).not.toContain("!/l/*/2026/*");
    expect(wrangler.assets.run_worker_first).not.toContain("!/l/*/p/*");
    // Phase 2B: /p/* Worker-first with six utility .html exclusions → direct Assets.
    expect(wrangler.assets.run_worker_first).toContain("/p/*");
    expect(wrangler.assets.run_worker_first).toContain("!/p/about.html");
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
    // Phase 6D: English /2026/* Worker-first for hard 404 on miss (no SPA soft-200).
    expect(wrangler.assets.run_worker_first).toContain("/2026/*");
    expect(wrangler.assets.run_worker_first).not.toContain("/2026/*.html");
    expect(wrangler.assets.run_worker_first).not.toContain("!/l/*/2026/*/*.html");
    expect(wrangler.assets.run_worker_first).not.toContain("/l/*/2026/*.html");
    expect(wrangler.assets.run_worker_first).toContain("/p/*");
    expect(wrangler.assets.run_worker_first).toContain("!/p/about.html");
    expect(wrangler.assets.run_worker_first).not.toContain("/*");
    expect(wrangler.assets.run_worker_first).toContain("/thumb/*");
    // Exact routes omit query-string URLs; trailing * is required (CF routes docs).
    // Otherwise /copyright?m=1 falls through to Blogger and 404s.
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
