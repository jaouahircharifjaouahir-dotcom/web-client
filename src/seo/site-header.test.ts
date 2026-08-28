import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { renderEnglishStaticHtml } from "../../scripts/i18n/render-english-static.mjs";
import { renderLocalizedHtml } from "../../scripts/i18n/render-localized.mjs";
import {
  headerLanguageOptions,
  localeHomeUrl,
  renderSiteHeaderHtml,
  SITE_HEADER_CSS,
  siteHeaderScriptTag,
} from "../../scripts/i18n/site-header.mjs";
import { getTargetLocales } from "../../scripts/i18n/target-languages.mjs";
import { resolveLocaleDestination } from "../../src/i18n/publishability";
import { languageOptions } from "../../src/i18n/ui";

describe("global site header", () => {
  const inventory = buildContentInventory();
  const items = localizableContent(inventory);
  const article = items.find((i) => i.type === "article")!;
  const utility = items.find((i) => i.type === "utility")!;

  it("renders shared header chrome matching App controls", () => {
    const html = renderSiteHeaderHtml({ locale: "en", contentPath: article.canonicalPath });
    expect(html).toContain('id="yte-site-header"');
    expect(html).toContain('class="yte-mark"');
    expect(html).toContain(">11<");
    expect(html).toContain("11tik");
    expect(html).toContain('id="yte-posts-btn"');
    expect(html).toContain('id="yte-bulk-btn"');
    expect(html).toContain('id="yte-theme-btn"');
    expect(html).toContain('id="yte-lang-select"');
    expect(html).toContain("Posts");
    expect(html).toContain("Bulk");
    expect(html).toContain("Theme:");
    expect(html).toContain('value="en" selected');
    expect(html).toContain("English");
    expect(html).toContain("?posts=1");
    expect(html).toContain("?bulk=1");
  });

  it("shows native current language labels for ar/fr/es", () => {
    expect(renderSiteHeaderHtml({ locale: "ar" })).toContain("العربية");
    expect(renderSiteHeaderHtml({ locale: "ar" })).toContain('value="ar" selected');
    expect(renderSiteHeaderHtml({ locale: "fr" })).toContain("Français");
    expect(renderSiteHeaderHtml({ locale: "es" })).toContain("Español");
  });

  it("aligns SPA languageOptions with target-languages + English", () => {
    const fromHeader = headerLanguageOptions().map((x) => x.code).sort();
    const fromUi = languageOptions().map((x) => x.code).sort();
    expect(fromUi).toEqual(fromHeader);
    expect(fromUi).toContain("en");
    for (const code of getTargetLocales()) {
      expect(fromUi).toContain(code);
    }
  });

  it("includes header in English article and utility static HTML", () => {
    for (const item of [article, utility]) {
      const html = renderEnglishStaticHtml(item, {
        alternates: [{ locale: "en", url: item.canonicalUrl }],
      });
      expect(html, item.contentId).toContain('id="yte-site-header"');
      expect(html, item.contentId).toContain("/web-client/site-header.js");
      expect(html, item.contentId).toContain("max-width:720px");
      expect(html, item.contentId).toContain('class="yte-page"');
    }
  });

  it("includes header in Arabic and French localized HTML", () => {
    for (const locale of ["ar", "fr"]) {
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
      expect(html).toContain('id="yte-site-header"');
      expect(html).toContain(`data-yte-locale="${locale}"`);
      expect(html).toContain(localeHomeUrl(locale));
      expect(html).toContain("/web-client/site-header.js");
    }
  });

  it("maps language switch via publishability (ready URL or English fallback)", () => {
    const doc = {
      contents: {
        [article.contentId]: {
          path: article.canonicalPath,
          en: article.canonicalUrl,
          locales: {
            ar: `https://ar.11tik.com/l/ar${article.canonicalPath}`,
            fr: `https://fr.11tik.com/l/fr${article.canonicalPath}`,
          },
        },
      },
    };
    const fromEn = resolveLocaleDestination(article.canonicalUrl, "ar", doc, localeHomeUrl);
    expect(fromEn).toBe(`https://ar.11tik.com/l/ar${article.canonicalPath}`);
    const fromAr = resolveLocaleDestination(
      `https://ar.11tik.com/l/ar${article.canonicalPath}`,
      "fr",
      doc,
      localeHomeUrl,
    );
    expect(fromAr).toBe(`https://fr.11tik.com/l/fr${article.canonicalPath}`);
    const missing = resolveLocaleDestination(article.canonicalUrl, "xx" as string, doc, localeHomeUrl);
    // unknown locale still resolves entry; no ready URL → English canonical
    expect(missing).toBe(article.canonicalUrl);
  });

  it("mobile CSS stacks actions without fixed overflow width", () => {
    expect(SITE_HEADER_CSS).toContain("@media (max-width:700px)");
    expect(SITE_HEADER_CSS).toContain("flex-direction:column");
    expect(SITE_HEADER_CSS).toContain("overflow-x:clip");
  });

  it("ships site-header.js with Posts/Bulk anchors enhanced only via handshake", () => {
    const src = readFileSync(join(process.cwd(), "public/site-header.js"), "utf8");
    expect(src).toContain("publishability.json");
    expect(src).toContain("yte-theme");
    expect(src).toContain("__yteNavigateView");
    expect(src).toContain("posts");
    expect(src).toContain("bulk");
    // Must not block native <a> navigation when the SPA handshake is missing
    expect(src).toMatch(/typeof nav !== "function"/);
  });

  it("Posts/Bulk controls are real anchors with locale-preserving hrefs", () => {
    const en = renderSiteHeaderHtml({ locale: "en", variant: "spa-shell" });
    expect(en).toMatch(/<a class="yte-chip" id="yte-posts-btn"[^>]*href="https:\/\/www\.11tik\.com\/\?posts=1"/);
    expect(en).toMatch(/<a class="yte-chip" id="yte-bulk-btn"[^>]*href="https:\/\/www\.11tik\.com\/\?bulk=1"/);
    expect(en).not.toMatch(/id="yte-posts-btn"[^>]*disabled/);
    expect(en).not.toMatch(/id="yte-bulk-btn"[^>]*aria-disabled="true"/);

    const ar = renderSiteHeaderHtml({ locale: "ar", variant: "spa-shell" });
    expect(ar).toContain('href="https://ar.11tik.com/l/ar/?posts=1"');
    expect(ar).toContain('href="https://ar.11tik.com/l/ar/?bulk=1"');

    const fr = renderSiteHeaderHtml({ locale: "fr", variant: "spa-shell" });
    expect(fr).toContain('href="https://fr.11tik.com/l/fr/?posts=1"');
    expect(fr).toContain('href="https://fr.11tik.com/l/fr/?bulk=1"');
  });

  it("header CSS keeps chips pointer-interactive (no pointer-events:none)", () => {
    expect(SITE_HEADER_CSS).toContain("cursor:pointer");
    expect(SITE_HEADER_CSS).not.toMatch(/\.yte-chip\{[^}]*pointer-events:\s*none/);
    expect(SITE_HEADER_CSS).not.toMatch(/\.yte-actions\{[^}]*pointer-events:\s*none/);
  });

  it("bumps site-header.js cache version so CDN immutable entries refresh", () => {
    const src = readFileSync(join(process.cwd(), "scripts/i18n/site-header.mjs"), "utf8");
    expect(src).toMatch(/SITE_HEADER_ASSET_V\s*=\s*"4"/);
    expect(siteHeaderScriptTag()).toContain("site-header.js?v=4");
  });
});
