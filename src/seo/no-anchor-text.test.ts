import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { renderEnglishStaticHtml } from "../../scripts/i18n/render-english-static.mjs";
import { renderLocalizedHtml } from "../../scripts/i18n/render-localized.mjs";
import { renderSiteHeaderHtml } from "../../scripts/i18n/site-header.mjs";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

const SEMRUSH_ARTICLE_PAGES = [
  "2026/08/how-to-download-youtube-thumbnail.html",
  "2026/08/how-to-save-youtube-thumbnail-on-iphone.html",
  "2026/08/youtube-live-premiere-thumbnail-download.html",
  "2026/08/youtube-thumbnail-url.html",
];

const UTILITY_PAGES = ["p/about.html", "p/privacy.html", "p/terms-of-use.html"];

const BRAND_ARIA = "11tik — YouTube Thumbnail Extractor home";

function extractBrandAnchor(html: string) {
  const m = html.match(/<a class="yte-brand"([^>]*)>([\s\S]*?)<\/a>/);
  if (!m) return null;
  const attrs = m[1];
  const inner = m[2];
  const href = (attrs.match(/\bhref="([^"]+)"/) || [])[1] || "";
  const aria = (attrs.match(/\baria-label="([^"]+)"/) || [])[1] || "";
  return { href, aria, inner, full: m[0] };
}

/** Text nodes that are direct children of the brand anchor (Semrush-style). */
function brandDirectText(inner: string) {
  return inner
    .replace(/<span class="yte-mark"[\s\S]*?<\/span>/i, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function brandRecursiveText(inner: string) {
  return inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function assertBrandAnchor(html: string, homeHref = "https://www.11tik.com/") {
  const brands = [...html.matchAll(/<a class="yte-brand"/g)];
  expect(brands.length, "single homepage brand anchor").toBe(1);

  const brand = extractBrandAnchor(html);
  expect(brand, "yte-brand anchor").not.toBeNull();
  expect(brand!.href).toBe(homeHref);
  expect(brand!.aria).toBe(BRAND_ARIA);
  expect(brand!.inner).toMatch(/<span class="yte-mark"[^>]*aria-hidden="true"[^>]*>11<\/span>/);
  expect(brand!.inner).not.toMatch(/<span>\s*11tik\s*<\/span>/);

  const direct = brandDirectText(brand!.inner);
  const recursive = brandRecursiveText(brand!.inner);
  expect(direct).toBe("11tik");
  expect(recursive).toBe("11 11tik");
  return { direct, recursive, aria: brand!.aria };
}

describe("Semrush no-anchor-text brand link", () => {
  const inventory = buildContentInventory();
  const items = localizableContent(inventory);
  const article = items.find((i) => i.type === "article")!;

  it("shared header renders direct 11tik text node", () => {
    const html = renderSiteHeaderHtml({ locale: "en", contentPath: "/2026/08/youtube-thumbnail-url.html" });
    const { direct, recursive, aria } = assertBrandAnchor(html);
    expect(direct.length).toBeGreaterThan(0);
    expect(recursive).toContain("11tik");
    expect(aria).toBe(BRAND_ARIA);
  });

  it("English article static output passes", () => {
    const html = renderEnglishStaticHtml(article, {
      alternates: [{ locale: "en", url: article.canonicalUrl }],
    });
    assertBrandAnchor(html);
  });

  it("English utility static output passes", () => {
    for (const rel of UTILITY_PAGES) {
      const html = readFileSync(join(getStagedStaticSite(), rel), "utf8");
      assertBrandAnchor(html);
    }
  });

  it("localized ar/fr output passes", () => {
    for (const locale of ["ar", "fr"] as const) {
      const artifact = {
        locale,
        title: "T",
        description: "A description that is long enough for meta testing purposes here.",
        h1: "H1",
        sections: [{ heading: "S", html: "<p>Body</p>" }],
        faq: [],
        images: [],
        conclusionHtml: "",
        bioHtml: "",
      };
      const html = renderLocalizedHtml(article, artifact, {
        alternates: [
          { locale: "en", url: article.canonicalUrl },
          { locale, url: `https://${locale}.11tik.com/l/${locale}${article.canonicalPath}` },
        ],
      });
      assertBrandAnchor(html, `https://${locale}.11tik.com/l/${locale}/`);
    }
  });

  it("staged TRUE POSITIVE article pages pass", () => {
    const staged = getStagedStaticSite();
    for (const rel of SEMRUSH_ARTICLE_PAGES) {
      const html = readFileSync(join(staged, rel), "utf8");
      assertBrandAnchor(html);
    }
  });

  it("homepage shell passes", () => {
    const html = readFileSync(join(getStagedStaticSite(), "index.html"), "utf8");
    assertBrandAnchor(html);
  });
});
