import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** Outlinks from Ahrefs File 22 that still 307 in production. */
const BLOCKER_HTML = [
  "/2026/08/how-to-download-youtube-thumbnail.html",
  "/2026/08/youtube-thumbnail-size-resolution.html",
  "/2026/08/youtube-thumbnail-url.html",
] as const;

describe("Links to redirect (Ahrefs File 22) — File 1 root fix only", () => {
  it("keeps html_handling none; Phase 6D Worker-first /2026/* for hard 404 on miss", () => {
    const wrangler = JSON.parse(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
    expect(wrangler.assets.html_handling).toBe("none");
    expect(wrangler.assets.run_worker_first).toContain("/2026/*");
    expect(wrangler.assets.run_worker_first).not.toContain("/2026/*.html");
    expect(wrangler.assets.run_worker_first).not.toContain("/l/*/2026/*.html");
  });

  it("keyword-tools + sitemap already point at canonical *.html guides", () => {
    const kw = readFileSync(join(ROOT, "docs/blogger-pages/keyword-tools.html"), "utf8");
    for (const path of BLOCKER_HTML) {
      expect(kw).toContain(`https://www.11tik.com${path}`);
      expect(kw).not.toContain(`https://www.11tik.com${path.replace(/\.html$/, "")}"`);
    }

    const sitemapCandidates = [
      join(ROOT, "dist-assets/sitemap.xml"),
      join(ROOT, "dist-assets-pilot/sitemap.xml"),
    ];
    const sitemapPath = sitemapCandidates.find((p) => existsSync(p));
    expect(sitemapPath, "dist-assets sitemap present").toBeTruthy();
    const sitemap = readFileSync(sitemapPath!, "utf8");
    for (const path of BLOCKER_HTML) {
      expect(sitemap).toContain(`https://www.11tik.com${path}`);
    }
  });

  it("staged article *.html assets exist for Assets (Worker-zero) serving", () => {
    for (const path of BLOCKER_HTML) {
      const file = join(ROOT, "dist-assets", ...path.split("/").filter(Boolean));
      expect(existsSync(file), file).toBe(true);
    }
  });
});
