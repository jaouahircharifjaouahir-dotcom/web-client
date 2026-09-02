import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { renderEnglishStaticHtml } from "../../scripts/i18n/render-english-static.mjs";
import { STANDARD_ARTICLE_PAGE_CSS } from "../../scripts/i18n/render-localized.mjs";
import {
  assertEnglishStaticCoverage,
  assessShadowSitemap,
  countHreflangOnHtml,
  writeEnglishStaticPages,
} from "../../scripts/i18n/write-english-static.mjs";
import { englishStaticAssetRel } from "../../scripts/i18n/render-english-static.mjs";
import { INDEXABLE_UTILITY_PATHS, loadGuidePostHrefsFromFile } from "../../workers/sitemap-canonicals.js";

/** Former Blogger-full-export sources that previously leaked theme CSS into English static HTML. */
const FORMER_THEME_DUMP_SLUGS = [
  "youtube-shorts-thumbnail-download",
  "highest-quality-youtube-thumbnail",
  "original-youtube-thumbnail-image",
];

describe("English static shadow generation", () => {
  const inventory = buildContentInventory();
  const items = localizableContent(inventory);
  const postsTs = readFileSync(join(process.cwd(), "src/content/posts.ts"), "utf8");
  const postHrefs = loadGuidePostHrefsFromFile(postsTs);

  it("inventories 19 guides + 6 utilities (study EN-only)", () => {
    expect(postHrefs.length).toBe(19);
    expect(INDEXABLE_UTILITY_PATHS.length).toBe(6);
    expect(items.filter((i) => i.type === "article").length).toBe(18);
    expect(items.filter((i) => i.type === "utility").length).toBe(6);
    expect(items.length).toBe(24);
  });

  it("renders English HTML at www canonical with en + x-default hreflang", () => {
    const article = items.find((i) => i.type === "article");
    expect(article).toBeTruthy();
    const html = renderEnglishStaticHtml(article!, {
      alternates: [
        { locale: "en", url: article!.canonicalUrl },
        { locale: "fr", url: `https://fr.11tik.com/l/fr${article!.canonicalPath}` },
      ],
    });
    expect(html).toContain(`<link rel="canonical" href="${article!.canonicalUrl}"/>`);
    expect(html).not.toContain("/l/en/");
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain('hreflang="fr"');
    expect(html).toContain('name="robots" content="index,follow"');
    expect(html).toMatch(/<h1\b/i);
    expect(html).toContain("application/ld+json");
    expect(html).toContain('rel="icon"');
    expect(html).toContain('id="yte-site-header"');
    expect(html).toContain("/web-client/site-header.js");
  });

  it("uses shared 720px article column CSS for every English page including former theme dumps", () => {
    expect(STANDARD_ARTICLE_PAGE_CSS).toMatch(/\.yte-page\{[^}]*max-width:720px/);
    expect(STANDARD_ARTICLE_PAGE_CSS).toMatch(/\.yte-hero\{[^}]*max-width:100%/);
    for (const item of items.filter((i) => i.type === "article")) {
      const html = renderEnglishStaticHtml(item, { alternates: [{ locale: "en", url: item.canonicalUrl }] });
      expect(html, item.contentId).toContain("max-width:720px");
      expect(html, item.contentId).toMatch(/class="yte-page"/);
      // Must not ship Blogger theme shell CSS that blows out the reading column.
      expect(html, item.contentId).not.toMatch(/max-width:\s*none/);
      expect(html, item.contentId).not.toContain(".yte-seo");
      // Header chrome may use min(920px); article column stays 720.
      expect(html, item.contentId).toMatch(/\.yte-page\{[^}]*max-width:720px/);
      expect(html, item.contentId).toContain('id="yte-site-header"');
    }
    for (const slug of FORMER_THEME_DUMP_SLUGS) {
      const item = items.find((i) => i.contentId === slug);
      expect(item, slug).toBeTruthy();
      const html = renderEnglishStaticHtml(item!, { alternates: [{ locale: "en", url: item!.canonicalUrl }] });
      expect(html).toContain("max-width:720px");
      expect(html).toMatch(/\.yte-page\{[^}]*max-width:720px/);
      expect(html).not.toMatch(/max-width:\s*none/);
      expect(html).toContain('id="yte-site-header"');
    }
  });

  it("writes all English files and passes coverage assert", () => {
    const dir = mkdtempSync(join(tmpdir(), "en-static-"));
    try {
      const writeOk = (path: string, contents: string) => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, contents);
      };
      const result = writeEnglishStaticPages(writeOk, dir, inventory);
      expect(result.missingSource).toEqual([]);
      expect(result.written.length).toBe(25);
      assertEnglishStaticCoverage(dir, inventory);
      for (const item of items) {
        const rel = englishStaticAssetRel(item);
        expect(existsSync(join(dir, rel)), rel).toBe(true);
        expect(rel.startsWith("l/en")).toBe(false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("shadow sitemap counts 19 English guide URLs + 6 utilities plus homepage", () => {
    const shadow = assessShadowSitemap(inventory, []);
    expect(shadow.articleCount).toBe(19);
    expect(shadow.utilityCount).toBe(6);
    expect(shadow.englishCanonicalCount).toBe(1 + 19 + 6);
  });

  it("countHreflangOnHtml tallies alternates", () => {
    const html = `
      <link hreflang="en" href="https://www.11tik.com/x"/>
      <link hreflang="x-default" href="https://www.11tik.com/x"/>
      <link hreflang="fr" href="https://fr.11tik.com/l/fr/x"/>
    `;
    expect(countHreflangOnHtml(html)).toEqual({ en: 1, xDefault: 1, all: 3, otherLocales: 1 });
  });
});
