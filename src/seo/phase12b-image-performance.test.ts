import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderEnglishStaticHtml } from "../../scripts/i18n/render-english-static.mjs";
import { renderLocalizedHtml, LOCALIZED_PAGE_ICONS } from "../../scripts/i18n/render-localized.mjs";
import { loadTranslationArtifact } from "../../scripts/i18n/translation-store.mjs";
import { SITE } from "./site";

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, "public", "images", "blog");
const HEADERS = path.join(ROOT, "scripts", "stage-worker-assets.mjs");

const DOWNLOAD_ARTICLE = {
  contentId: "how-to-download-youtube-thumbnail",
  type: "article",
  canonicalPath: "/2026/08/how-to-download-youtube-thumbnail.html",
  canonicalUrl: "https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html",
  sourceRel: "docs/blogger-pages/blog/how-to-download-youtube-thumbnail.html",
};

describe("Phase 12B image & static delivery", () => {
  it("generates WebP sibling for every blog PNG", () => {
    const pngs = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".png"));
    expect(pngs.length).toBeGreaterThan(0);
    for (const png of pngs) {
      const webp = path.join(BLOG_DIR, png.replace(/\.png$/i, ".webp"));
      expect(fs.existsSync(webp), `${png} → .webp`).toBe(true);
      expect(fs.statSync(webp).size).toBeLessThan(fs.statSync(path.join(BLOG_DIR, png)).size);
    }
  });

  it("uses 30-day cache for /web-client/images/* in staged _headers", () => {
    const src = readFileSync(HEADERS, "utf8");
    expect(src).toMatch(/\/web-client\/images\/\*\s*\n\s*Cache-Control: public, max-age=2592000/);
  });

  it("English article HTML wraps blog heroes in picture with WebP source", () => {
    const html = renderEnglishStaticHtml(DOWNLOAD_ARTICLE);
    expect(html).toContain('<source type="image/webp"');
    expect(html).toContain("/web-client/images/blog/youtube-thumbnail-download-workflow.webp");
    expect(html).toContain('src="https://www.11tik.com/web-client/images/blog/youtube-thumbnail-download-workflow.png"');
    expect(html).not.toContain("blogger.googleusercontent.com");
    expect(html).toContain('loading="eager"');
    expect(html).toMatch(/"url":"https:\/\/www\.11tik\.com\/web-client\/images\/blog\/[^"]+\.png"/);
  });

  it("embed utility uses eager hero loading", () => {
    const html = renderEnglishStaticHtml({
      contentId: "embed",
      type: "utility",
      canonicalPath: "/p/embed.html",
      canonicalUrl: "https://www.11tik.com/p/embed.html",
      sourceRel: "docs/blogger-pages/embed.html",
    });
    expect(html).toContain('loading="eager"');
    expect(html).toContain("/web-client/images/social/og-image-1200x630.png");
    expect(html).not.toContain("blogger.googleusercontent.com");
  });

  it("localized article keeps PNG in JSON-LD but serves picture in body", () => {
    const artifact = loadTranslationArtifact("how-to-download-youtube-thumbnail", "fr");
    expect(artifact?.status).toBe("ready");
    const html = renderLocalizedHtml(DOWNLOAD_ARTICLE, artifact!, {
      alternates: [
        { locale: "en", url: DOWNLOAD_ARTICLE.canonicalUrl },
        { locale: "fr", url: "https://fr.11tik.com/l/fr/2026/08/how-to-download-youtube-thumbnail.html" },
      ],
    });
    expect(html).toContain("<picture>");
    expect(html).toContain(".webp");
    expect(html).toMatch(/"url":"https:\/\/www\.11tik\.com\/web-client\/images\/blog\/[^"]+\.png"/);
    expect(html).toContain(`href="${LOCALIZED_PAGE_ICONS.png32}"`);
    expect(LOCALIZED_PAGE_ICONS.png32).toBe(SITE.icons.png32);
    expect(html).not.toContain("blogger.googleusercontent.com");
  });

  it("SPA shell index.html uses self-hosted favicons", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    expect(html).toContain("/web-client/icons/favicon-32.png");
    expect(html).not.toMatch(/rel="icon"[^>]+blogger\.googleusercontent\.com/);
    expect(html).not.toMatch(/rel="apple-touch-icon"[^>]+blogger\.googleusercontent\.com/);
  });

  it("self-hosted favicon files exist on disk", () => {
    for (const rel of ["public/icons/favicon-16.png", "public/icons/favicon-32.png", "public/icons/apple-touch-icon-180.png"]) {
      expect(fs.existsSync(join(ROOT, rel)), rel).toBe(true);
      expect(fs.statSync(join(ROOT, rel)).size).toBeGreaterThan(100);
    }
  });
});
