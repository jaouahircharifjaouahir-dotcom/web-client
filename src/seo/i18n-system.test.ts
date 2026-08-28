import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { isSupportedLocale } from "../../scripts/i18n/translation-store.mjs";
import { scanPublishability, shouldRedirectToLocale } from "../../scripts/i18n/publish.mjs";
import { validateTranslationArtifact } from "../../scripts/i18n/validate-artifact.mjs";
import { loadTranslationArtifact } from "../../scripts/i18n/translation-store.mjs";
import { planTranslationWork } from "../../scripts/i18n/translate-pipeline.mjs";
import { rewriteInternalHref, classifyInternalLinksInHtml, buildPathLinkIndex } from "../../scripts/i18n/internal-links.mjs";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { normalizeTrustedLocaleSitemapLoc, parseSitemapLocs } from "../../workers/sitemap-canonicals.js";
import { ISO6391_CODES } from "../../workers/iso6391.js";
import {
  assertAllTargetsHaveGtxMapping,
  getTargetLocales,
  getTier1Locales,
  getTier2Locales,
  isTargetLocale,
} from "../../scripts/i18n/target-languages.mjs";
import { gtxCodeForLocale } from "../../translator/locale/gtx-locale-map.mjs";

describe("generalized multilingual i18n system (TARGET_LANGUAGES)", () => {
  it("inventories GUIDE_POSTS + utilities as localizable", () => {
    const inventory = buildContentInventory();
    const localizable = localizableContent(inventory);
    expect(localizable.filter((i) => i.type === "article")).toHaveLength(18);
    expect(localizable.filter((i) => i.type === "utility")).toHaveLength(6);
    expect(localizable.every((item) => item.localizable && item.indexable)).toBe(true);
    expect(inventory.some((item) => item.type === "homepage" && item.localizable === false)).toBe(true);
  });

  it("keeps ISO 639-1 host table intact but does not use it as translation targets", () => {
    expect(ISO6391_CODES.size).toBe(183);
    for (const code of ISO6391_CODES) {
      expect(isSupportedLocale(code)).toBe(true);
    }
    const targets = getTargetLocales();
    expect(targets.length).toBeGreaterThanOrEqual(30);
    expect(targets.length).toBeLessThan(80);
    expect(targets).not.toContain("en");
    expect(targets.includes("aa")).toBe(false);
  });

  it("defines Tier 1 / Tier 2 target languages with GTX mappings", () => {
    assertAllTargetsHaveGtxMapping();
    const tier1 = getTier1Locales();
    const tier2 = getTier2Locales();
    expect(tier1).toContain("es");
    expect(tier1).toContain("fr");
    expect(tier1).toContain("ar");
    expect(tier1).toContain("zh");
    expect(tier2).toContain("sv");
    expect(tier2).toContain("no");
    expect(tier1.length + tier2.length).toBe(getTargetLocales().length);
    for (const code of getTargetLocales()) {
      expect(gtxCodeForLocale(code)).toBeTruthy();
      expect(isTargetLocale(code)).toBe(true);
    }
  });

  it("plans work only for TARGET_LANGUAGES", () => {
    const targets = getTargetLocales();
    const localizable = localizableContent(buildContentInventory());
    const plan = planTranslationWork({ locales: targets });
    expect(plan.localeCount).toBe(targets.length);
    expect(plan.theoretical).toBe(localizable.length * targets.length);
    expect(plan.theoretical).toBeLessThan(23 * 182);
  });

  it("publishability counts use TARGET_LANGUAGES only", () => {
    const manifest = scanPublishability();
    const targets = getTargetLocales();
    expect(manifest.localeCount).toBe(targets.length);
    expect(manifest.theoreticalPages).toBe(24 * targets.length);
    expect(manifest.contents["11tik-share-links-thumb-vs-youtube"].locales.fr).toBeTruthy();
    expect(manifest.contents["11tik-share-links-thumb-vs-youtube"].locales.aa).toBeUndefined();
  });

  it("validates FR artifact structure", () => {
    const artifact = loadTranslationArtifact("11tik-share-links-thumb-vs-youtube", "fr");
    const result = validateTranslationArtifact(artifact, {
      contentId: "11tik-share-links-thumb-vs-youtube",
      locale: "fr",
      currentSourceHash: artifact.sourceHash,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unsafe HTML in translation artifacts", () => {
    const artifact = loadTranslationArtifact("11tik-share-links-thumb-vs-youtube", "fr");
    const bad = {
      ...artifact,
      sections: [{ heading: "x", html: '<script>alert(1)</script>' }],
    };
    expect(validateTranslationArtifact(bad, { contentId: artifact.contentId, locale: "fr" }).ok).toBe(false);
  });

  it("normalizes locale article and utility locs; rejects homes and foreign hosts", () => {
    expect(
      normalizeTrustedLocaleSitemapLoc(
        "https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html",
      ),
    ).toBe("https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html");
    expect(normalizeTrustedLocaleSitemapLoc("https://fr.11tik.com/l/fr/p/about.html")).toBe(
      "https://fr.11tik.com/l/fr/p/about.html",
    );
    expect(normalizeTrustedLocaleSitemapLoc("https://fr.11tik.com/l/fr/")).toBeNull();
    expect(normalizeTrustedLocaleSitemapLoc("https://evil.com/l/fr/2026/08/x.html")).toBeNull();
  });

  it("generates ready localized pages for all target languages", () => {
    const dir = getStagedStaticSite();
    const manifest = scanPublishability();
      const frRel = "l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html";
      const arRel = "l/ar/2026/08/how-to-download-youtube-thumbnail.html";
      expect(existsSync(join(dir, frRel))).toBe(true);
      expect(existsSync(join(dir, arRel))).toBe(true);
      const pub = JSON.parse(readFileSync(join(dir, "web-client/i18n/publishability.json"), "utf8"));
      expect(Object.values(pub.contents).reduce((n, c) => n + Object.keys(c.locales).length, 0)).toBe(
        manifest.counts.ready,
      );
      const locs = parseSitemapLocs(readFileSync(join(dir, "sitemap.xml"), "utf8"));
      const localeArticleLocs = locs.filter((loc) =>
        /https:\/\/[a-z]{2}\.11tik\.com\/l\/[a-z]{2}\/.+\.html$/.test(loc),
      );
      expect(localeArticleLocs).toHaveLength(manifest.counts.ready);
      // Non-target ISO homes (e.g. aa) may appear as /l/aa/ shells, never as .html articles.
      expect(localeArticleLocs.some((loc) => loc.includes("/l/aa/"))).toBe(false);
      expect(locs).toContain("https://aa.11tik.com/l/aa/");
      expect(readFileSync(join(dir, "robots.txt"), "utf8")).toContain("Allow: /");
  });

  it("redirect helper prefers ready browser locale and preserves explicit choice", () => {
    const ready = {
      fr: "https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html",
      es: "https://es.11tik.com/l/es/2026/08/11tik-share-links-thumb-vs-youtube.html",
    };
    expect(
      shouldRedirectToLocale({
        pathname: "/2026/08/11tik-share-links-thumb-vs-youtube.html",
        browserLanguages: ["fr-FR", "en"],
        readyLocales: ready,
      }),
    ).toBe(ready.fr);
    expect(
      shouldRedirectToLocale({
        pathname: "/2026/08/11tik-share-links-thumb-vs-youtube.html",
        savedLang: "de",
        browserLanguages: ["fr"],
        readyLocales: ready,
      }),
    ).toBeNull();
    expect(
      shouldRedirectToLocale({
        pathname: "/2026/08/11tik-share-links-thumb-vs-youtube.html",
        browserLanguages: ["aa", "fr"],
        readyLocales: ready,
      }),
    ).toBe(ready.fr);
  });

  it("rewrites internal hrefs to localized URLs when ready", () => {
    const manifest = scanPublishability();
    const index = buildPathLinkIndex(manifest.contents);
    const href = rewriteInternalHref(
      "https://www.11tik.com/2026/08/11tik-share-links-thumb-vs-youtube.html",
      "fr",
      index,
    );
    expect(href).toBe("https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html");
    const withHash = rewriteInternalHref(
      "https://www.11tik.com/2026/08/11tik-share-links-thumb-vs-youtube.html#faq",
      "ar",
      index,
    );
    expect(withHash).toBe("https://ar.11tik.com/l/ar/2026/08/11tik-share-links-thumb-vs-youtube.html#faq");
  });

  it("localizes internal body links in generated HTML", () => {
    const dir = getStagedStaticSite();
    const manifest = scanPublishability();
      const pathIndex = buildPathLinkIndex(manifest.contents);
      const arHtml = readFileSync(
        join(dir, "l/ar/2026/08/how-to-download-youtube-thumbnail.html"),
        "utf8",
      );
      const audit = classifyInternalLinksInHtml(arHtml, "ar", pathIndex);
      expect(audit.total).toBeGreaterThan(0);
      expect(audit.localized).toBeGreaterThan(0);
      expect(audit.broken).toBe(0);
      expect(audit.incorrect).toBe(0);
      expect(arHtml).toContain("https://ar.11tik.com/l/ar/2026/08/youtube-thumbnail-url.html");
      expect(arHtml).not.toMatch(
        /<article[\s\S]*https:\/\/www\.11tik\.com\/2026\/08\/youtube-thumbnail-url\.html/,
      );
  });

  it("does not put localized article paths in run_worker_first", () => {
    const raw = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
    // Phase A: English guides are asset-first; do not reintroduce /2026/* Worker-first.
    expect(raw).not.toMatch(/"\/2026\/\*"/);
    expect(raw).toContain('"/p/*"');
    expect(raw).not.toMatch(/"\/l\/\*"/);
  });
});
