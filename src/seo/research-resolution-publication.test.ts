import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const ARTICLE = join(ROOT, "docs/blogger-pages/blog/youtube-thumbnail-sizes-resolutions-study.html");
const PKG = join(ROOT, "docs/seo/research-resolution-publication-package.json");
const STATS = join(ROOT, "reports/research-resolution-2026-v1/article-statistics.json");
import { CONTEXTUAL_LINK_PLAN } from "../../scripts/i18n/contextual-internal-links.mjs";

const CANONICAL_LINKS = [
  "https://www.11tik.com/2026/08/youtube-thumbnail-size-resolution.html",
  "https://www.11tik.com/2026/08/what-is-maxresdefaultjpg-when-youtube.html",
  "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
  "https://www.11tik.com/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html",
  "https://www.11tik.com/2026/08/highest-quality-youtube-thumbnail.html",
  "https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html",
  "https://www.11tik.com/p/embed.html",
];

describe("Phase 18C publication package", () => {
  const html = readFileSync(ARTICLE, "utf8");
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const stats = JSON.parse(readFileSync(STATS, "utf8"));

  it("article file and package exist", () => {
    expect(existsSync(ARTICLE)).toBe(true);
    expect(existsSync(PKG)).toBe(true);
  });

  it("title, H1, slug, and canonical align", () => {
    expect(html).toContain("YouTube Thumbnail Sizes &amp; Resolutions: A 300-Video Study");
    expect(pkg.title).toBe("YouTube Thumbnail Sizes & Resolutions: 300-Video Study");
    expect(pkg.slug).toBe("youtube-thumbnail-sizes-resolutions-study.html");
    expect(pkg.canonical).toBe("https://www.11tik.com/2026/08/youtube-thumbnail-sizes-resolutions-study.html");
    expect(html).toContain(pkg.canonical);
  });

  it("meta description is unique and sample-scoped", () => {
    expect(pkg.metaDescription.length).toBeGreaterThanOrEqual(40);
    expect(pkg.metaDescription.length).toBeLessThanOrEqual(160);
    expect(pkg.metaDescription).toMatch(/Sample-only|this sample/i);
    expect(html).toContain("Sample-only");
  });

  it("includes validated headline statistics", () => {
    expect(html).toMatch(/286\/300/);
    expect(html).toMatch(/95\.33%/);
    expect(html).toMatch(/2,400/);
    expect(html).toMatch(/2,341/);
    expect(html).toMatch(/141,111/);
    expect(html).toMatch(/60,345/);
    expect(html).toMatch(/57\.2%/);
    expect(html).toMatch(/853/);
  });

  it("statistics match article-statistics.json", () => {
    expect(stats.maxresAvailability.numerator).toBe(286);
    expect(stats.webpComparison.relativeDifferencePercent).toBe(57.24);
    expect(stats.totals.validImages.value).toBe(2341);
  });

  it("has five production tables", () => {
    expect(html).toMatch(/Table A/i);
    expect(html).toMatch(/Table B/i);
    expect(html).toMatch(/Table C/i);
    expect(html).toMatch(/Table D/i);
    expect(html).toMatch(/Table E/i);
  });

  it("Article and BreadcrumbList schema only — no FAQ or Dataset", () => {
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).not.toContain('"@type":"FAQPage"');
    expect(html).not.toContain('"@type":"Dataset"');
    expect(html).not.toContain('"@type":"AggregateRating"');
  });

  it("has exactly one H1", () => {
    expect((html.match(/<h1\b/gi) || []).length).toBe(1);
  });

  it("no internal filesystem references in public HTML", () => {
    expect(html).not.toMatch(/docs\/seo\//);
    expect(html).not.toMatch(/reports\//);
    expect(html).not.toMatch(/content-differentiation-map/);
    expect(html).not.toMatch(/article-statistics\.json/);
    expect(html).not.toMatch(/article-citation-map/);
  });

  it("internal links are valid canonical targets", () => {
    const links = [...html.matchAll(/href="(https:\/\/www\.11tik\.com[^"]+)"/g)].map((m) => m[1]);
    const unique = [...new Set(links.filter((u) => u.includes("/2026/08/") || u.includes("/p/embed")))];
    for (const href of unique) {
      expect(CANONICAL_LINKS.includes(href), href).toBe(true);
    }
    expect(unique.some((u) => u.includes("youtube-thumbnail-size-resolution"))).toBe(true);
  });

  it("no junk or retired routes", () => {
    expect(html).not.toMatch(/\/music\//);
    expect(html).not.toMatch(/\/backlink\//);
  });

  it("OG and hero images exist locally", () => {
    expect(existsSync(join(ROOT, "public/images/blog/youtube-thumbnail-sizes-resolutions-study-og.png"))).toBe(true);
    expect(existsSync(join(ROOT, "public/images/blog/youtube-thumbnail-sizes-resolutions-study-og.webp"))).toBe(true);
    expect(existsSync(join(ROOT, "public/images/blog/youtube-thumbnail-resolution-ladder-study.png"))).toBe(true);
    expect(html).toContain("youtube-thumbnail-sizes-resolutions-study-og.png");
    expect(html).toContain("youtube-thumbnail-resolution-ladder-study.webp");
    expect(html).toMatch(/width="1200"/);
    expect(html).toMatch(/height="630"/);
  });

  it("fallback labeled as inferred sample strategy", () => {
    expect(html).toMatch(/practical strategy derived from the observed sample/i);
    expect(html).not.toMatch(/YouTube recommends/i);
  });

  it("reciprocal link planned for existing size-resolution guide (build-time nav)", () => {
    const siblings = CONTEXTUAL_LINK_PLAN["youtube-thumbnail-size-resolution"]?.siblings || [];
    expect(siblings.some((s) => s.path.includes("youtube-thumbnail-sizes-resolutions-study"))).toBe(true);
  });

  it("anti-cannibalization — does not own download intent", () => {
    expect(html).not.toMatch(/<h1[^>]*>.*download/i);
    expect(pkg.differentiation.strategy).toMatch(/no merge/i);
  });

  it("picture/webp delivery for heroes", () => {
    expect(html).toContain("<picture>");
    expect(html).toContain('type="image/webp"');
    expect(html).toContain('loading="eager"');
  });
});
