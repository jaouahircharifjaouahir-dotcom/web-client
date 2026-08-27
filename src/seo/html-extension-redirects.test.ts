import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildHtmlExtensionRedirects } from "../../scripts/html-extension-redirects.mjs";
import { generateStaticSite } from "../../scripts/generate-static-site.mjs";
import { extensionlessPPathToHtml } from "../../workers/11tik-edge.js";

describe("html extension redirects (Ahrefs File 15)", () => {
  it("maps extensionless asset paths to *.html without placeholder loops", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-redir-"));
    try {
      mkdirSync(join(dir, "l", "fr", "p"), { recursive: true });
      mkdirSync(join(dir, "2026", "08"), { recursive: true });
      writeFileSync(join(dir, "l", "fr", "p", "contact.html"), "<html></html>");
      writeFileSync(join(dir, "2026", "08", "youtube-thumbnail-url.html"), "<html></html>");
      writeFileSync(join(dir, "l", "fr", "index.html"), "<html></html>");
      mkdirSync(join(dir, "web-client"), { recursive: true });
      writeFileSync(join(dir, "web-client", "app.html"), "<html></html>");

      const body = buildHtmlExtensionRedirects(dir);
      expect(body).toContain("/l/fr/p/contact /l/fr/p/contact.html 301");
      expect(body).toContain("/2026/08/youtube-thumbnail-url /2026/08/youtube-thumbnail-url.html 301");
      expect(body).not.toContain("/l/fr/index");
      expect(body).not.toContain("web-client");
      expect(body).not.toMatch(/:slug|:page|:locale/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Worker consolidates /p/{slug} → /p/{slug}.html", () => {
    expect(extensionlessPPathToHtml("/p/about")).toBe("/p/about.html");
    expect(extensionlessPPathToHtml("/p/contact.html")).toBe("");
    expect(extensionlessPPathToHtml("/2026/08/x")).toBe("");
  });

  it("generateStaticSite writes _redirects covering Ahrefs File 15 shapes", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-f15-"));
    try {
      generateStaticSite(dir);
      const body = readFileSync(join(dir, "_redirects"), "utf8");
      expect(body.length).toBeGreaterThan(100);
      // English + localized articles (ready translations) get extensionless → .html rules.
      expect(body).toContain(
        "/2026/08/youtube-thumbnail-url /2026/08/youtube-thumbnail-url.html 301",
      );
      expect(body).toMatch(
        /\/l\/[a-z]{2}\/2026\/08\/youtube-thumbnail-url \/l\/[a-z]{2}\/2026\/08\/youtube-thumbnail-url\.html 301/,
      );
      // Never redirect an already-.html source (would loop).
      const lines = body.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
      expect(lines.length).toBeGreaterThan(50);
      for (const line of lines) {
        const src = line.split(/\s+/)[0];
        expect(src.endsWith(".html"), line).toBe(false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
