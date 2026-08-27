import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildContentInventory } from "../../scripts/i18n/content-inventory.mjs";
import {
  renderEnglishStaticHtml,
  stripArticleStructuredDataNoise,
} from "../../scripts/i18n/render-english-static.mjs";

const FLAGGED = [
  "how-to-save-youtube-thumbnail-on-iphone",
  "how-to-download-youtube-thumbnail",
  "how-to-extract-thumbnails-from-youtube",
  "youtube-thumbnail-size-resolution",
  "11tik-share-links-thumb-vs-youtube",
  "youtube-live-premiere-thumbnail-download",
  "how-to-use-youtube-thumbnail-as-blog",
  "webp-vs-jpeg-youtube-thumbnails-which",
  "youtube-thumbnail-url",
  "what-is-maxresdefaultjpg-when-youtube",
  "youtube-thumbnail-not-appearing-private",
];

function extractLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) blocks.push(JSON.parse(m[1]));
  return blocks;
}

function graphTypes(doc) {
  const graph = doc["@graph"] || [doc];
  return graph.map((n) => n["@type"]).filter(Boolean);
}

describe("English article structured data (Ahrefs File 16)", () => {
  it("strips nested JSON-LD and microdata from article HTML", () => {
    const raw = readFileSync("docs/blogger-pages/blog/how-to-download-youtube-thumbnail.html", "utf8");
    const article = /<article[\s\S]*<\/article>/i.exec(raw)?.[0] || "";
    expect(article).toMatch(/ld\+json/i);
    const cleaned = stripArticleStructuredDataNoise(article);
    expect(cleaned).not.toMatch(/ld\+json/i);
    expect(cleaned).not.toMatch(/itemscope|itemtype|itemprop/i);
    expect(cleaned).toContain("<h1");
  });

  it("emits a single head JSON-LD graph with dates and no duplicate types", () => {
    const inventory = buildContentInventory();
    for (const id of FLAGGED) {
      const item = inventory.find((row) => row.contentId === id);
      expect(item, id).toBeTruthy();
      const html = renderEnglishStaticHtml(item);
      const blocks = extractLdBlocks(html);
      expect(blocks.length, id).toBe(1);
      const types = graphTypes(blocks[0]);
      expect(types.filter((t) => t === "Article").length, id).toBe(1);
      expect(types.filter((t) => t === "FAQPage").length, id).toBeLessThanOrEqual(1);
      expect(types.filter((t) => t === "HowTo").length, id).toBeLessThanOrEqual(1);
      expect(types).toContain("BreadcrumbList");
      const article = (blocks[0]["@graph"] || []).find((n) => n["@type"] === "Article");
      expect(article?.datePublished, id).toBeTruthy();
      expect(article?.dateModified, id).toBeTruthy();
      expect(String(article?.headline || ""), id).not.toContain("&amp;");
      expect(html.match(/application\/ld\+json/gi)?.length, id).toBe(1);
    }
  });
});
