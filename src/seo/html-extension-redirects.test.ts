import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildHtmlExtensionRedirects } from "../../scripts/html-extension-redirects.mjs";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { extensionlessPPathToHtml } from "../../workers/11tik-edge.js";
import { LEGACY_P_REDIRECTS } from "../../workers/sitemap-canonicals.js";

describe("html extension redirects (Phase 53 atomic legacy → clean)", () => {
  it("emits only atomic legacy→clean rules (no extensionless walk)", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-redir-"));
    try {
      mkdirSync(join(dir, "l", "fr"), { recursive: true });
      writeFileSync(join(dir, "l", "fr", "contact.html"), "<html></html>");
      writeFileSync(join(dir, "contact.html"), "<html></html>");
      writeFileSync(join(dir, "youtube-thumbnail-url.html"), "<html></html>");

      const body = buildHtmlExtensionRedirects(dir);
      expect(body).toContain("/p/contact.html /contact 301");
      expect(body).toContain("/2026/08/youtube-thumbnail-url.html /youtube-thumbnail-url 301");
      expect(body).toContain("/l/fr/p/contact.html /l/fr/contact 301");
      expect(body).not.toContain("/l/fr/index");
      expect(body).not.toMatch(/:slug|:page|:locale/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Worker extensionlessPPathToHtml maps legacy indexable utilities only (Phase 2B)", () => {
    expect(extensionlessPPathToHtml("/p/about")).toBe("/p/about.html");
    expect(extensionlessPPathToHtml("/p/contact.html")).toBe("");
    expect(extensionlessPPathToHtml("/p/random")).toBe("");
    expect(extensionlessPPathToHtml("/2026/08/x")).toBe("");
  });

  it("generateStaticSite writes _redirects with one-hop legacy → clean rules", () => {
    const dir = getStagedStaticSite();
    const body = readFileSync(join(dir, "_redirects"), "utf8");
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain("/2026/08/youtube-thumbnail-url /youtube-thumbnail-url 301");
    expect(body).toMatch(
      /\/l\/[a-z]{2}\/2026\/08\/youtube-thumbnail-url \/l\/[a-z]{2}\/youtube-thumbnail-url 301/,
    );
    expect(body).toContain("/p/youtube-thumbnail-url.html /youtube-thumbnail-url 301");
    expect(body).toContain("/p/youtube-thumbnail-extractor / 301");
    expect(body).toContain("/p/copyright.html /copyright 301");
    expect(body).not.toContain("/2026/08/youtube-thumbnail-url.html 301");
    const legacySources = new Set(LEGACY_P_REDIRECTS.map((r) => r.from));
    const lines = body.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
    expect(lines.length).toBeGreaterThan(50);
    for (const line of lines) {
      const [src, dest] = line.split(/\s+/);
      if (legacySources.has(src!)) continue;
      expect(dest!.startsWith("/2026/"), line).toBe(false);
      expect(dest!.startsWith("/p/"), line).toBe(false);
      expect(dest!.includes("/2026/"), line).toBe(false);
    }
  });
});
