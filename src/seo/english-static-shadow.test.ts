import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { renderEnglishStaticHtml } from "../../scripts/i18n/render-english-static.mjs";
import {
  assertEnglishStaticCoverage,
  assessShadowSitemap,
  countHreflangOnHtml,
  writeEnglishStaticPages,
} from "../../scripts/i18n/write-english-static.mjs";
import { INDEXABLE_UTILITY_PATHS, loadGuidePostHrefsFromFile } from "../../workers/sitemap-canonicals.js";

describe("English static shadow generation", () => {
  const inventory = buildContentInventory();
  const items = localizableContent(inventory);
  const postsTs = readFileSync(join(process.cwd(), "src/content/posts.ts"), "utf8");
  const postHrefs = loadGuidePostHrefsFromFile(postsTs);

  it("inventories 18 guides + 6 utilities", () => {
    expect(postHrefs.length).toBe(18);
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
      expect(result.written.length).toBe(24);
      assertEnglishStaticCoverage(dir, inventory);
      for (const item of items) {
        const rel = item.canonicalPath.replace(/^\//, "");
        expect(existsSync(join(dir, rel)), rel).toBe(true);
        expect(rel.startsWith("l/en")).toBe(false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("shadow sitemap counts 24 English content URLs plus homepage", () => {
    const shadow = assessShadowSitemap(inventory, []);
    expect(shadow.articleCount).toBe(18);
    expect(shadow.utilityCount).toBe(6);
    expect(shadow.englishCanonicalCount).toBe(1 + 18 + 6);
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
