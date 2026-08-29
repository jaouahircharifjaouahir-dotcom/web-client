import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { renderLocalizedHtml } from "../../scripts/i18n/render-localized.mjs";
import { localeHomeUrl, renderSiteHeaderHtml } from "../../scripts/i18n/site-header.mjs";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

const BRAND_ARIA = "11tik — YouTube Thumbnail Extractor home";
const PREVIEW_SRC = "og-image-640x336.webp";
const OG_IMAGE = "og-image-1200x630.png";

function extractBrand(html: string) {
  const m = html.match(/<a class="yte-brand"([^>]*)>([\s\S]*?)<\/a>/);
  if (!m) return null;
  const href = (m[1].match(/\bhref="([^"]+)"/) || [])[1] || "";
  const aria = (m[1].match(/\baria-label="([^"]+)"/) || [])[1] || "";
  const inner = m[2];
  const direct = inner
    .replace(/<span class="yte-mark"[\s\S]*?<\/span>/i, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { href, aria, direct, inner };
}

function assertBrand(html: string, homeHref: string) {
  const brands = [...html.matchAll(/<a class="yte-brand"/g)];
  expect(brands.length, "single brand anchor").toBe(1);
  const brand = extractBrand(html);
  expect(brand).not.toBeNull();
  expect(brand!.href).toBe(homeHref);
  expect(brand!.aria).toBe(BRAND_ARIA);
  expect(brand!.direct).toBe("11tik");
  expect(brand!.inner).toMatch(/<span class="yte-mark"[^>]*aria-hidden="true">11<\/span>/);
  expect(brand!.inner).not.toMatch(/<span>\s*11tik\s*<\/span>/);
}

describe("site header locale home + homepage preview", () => {
  const localeCases = [
    ["en", "https://www.11tik.com/"],
    ["fr", "https://fr.11tik.com/l/fr/"],
    ["ar", "https://ar.11tik.com/l/ar/"],
    ["es", "https://es.11tik.com/l/es/"],
    ["de", "https://de.11tik.com/l/de/"],
  ] as const;

  for (const [locale, home] of localeCases) {
    it(`${locale} brand href = ${home}`, () => {
      const html = renderSiteHeaderHtml({ locale, variant: "spa-shell" });
      assertBrand(html, home);
      expect(html).toContain(`data-yte-home="${home}"`);
    });
  }

  it("localized article uses same-locale home even if homeUrl override is wrong", () => {
    const inventory = buildContentInventory();
    const article = localizableContent(inventory).find((i) => i.type === "article")!;
    const html = renderLocalizedHtml(article, {
      locale: "fr",
      title: "Titre",
      description: "Description assez longue pour les tests meta sur cette page traduite.",
      h1: "H1",
      sections: [{ heading: "S", html: "<p>Corps</p>" }],
      faq: [],
      images: [],
      conclusionHtml: "",
      bioHtml: "",
    }, {
      alternates: [
        { locale: "en", url: article.canonicalUrl },
        { locale: "fr", url: `https://fr.11tik.com/l/fr${article.canonicalPath}` },
      ],
    });
    assertBrand(html, "https://fr.11tik.com/l/fr/");
  });

  it("brand ignores mistaken www homeUrl override on localized header", () => {
    const html = renderSiteHeaderHtml({
      locale: "fr",
      homeUrl: "https://www.11tik.com/",
      variant: "static",
    });
    assertBrand(html, "https://fr.11tik.com/l/fr/");
    expect(html).toContain('href="https://fr.11tik.com/l/fr/?posts=1"');
  });

  it("homepage has no visible preview img but keeps og:image", () => {
    const staged = getStagedStaticSite();
    const home = readFileSync(join(staged, "index.html"), "utf8");
    const frHome = readFileSync(join(staged, "l", "fr", "index.html"), "utf8");
    for (const html of [home, frHome]) {
      expect(html).not.toContain(PREVIEW_SRC);
      expect(html).not.toMatch(/class="yte-preview"/);
      expect(html).toContain(`property="og:image" content="https://www.11tik.com/web-client/images/social/${OG_IMAGE}"`);
      expect(html).toContain('id="yte-site-header"');
    }
  });

  it("localeHomeUrl helper matches expected hosts", () => {
    expect(localeHomeUrl("en")).toBe("https://www.11tik.com/");
    expect(localeHomeUrl("fr")).toBe("https://fr.11tik.com/l/fr/");
  });
});
