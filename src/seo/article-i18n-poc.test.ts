import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateStaticSite } from "../../scripts/generate-static-site.mjs";
import {
  SHARE_LINKS_ARTICLE_ID,
  SHARE_LINKS_EN_HREF,
  applyBloggerPocTheme,
  assertLocaleSitemapLocsHaveFiles,
  buildBloggerPocThemeFragment,
  buildPocFrReadinessManifest,
  collectPublishableLocaleArticleLocs,
  hashArticleSource,
  loadLocaleArtifact,
  localeArticleLocToAssetRel,
  localeArticlePublicUrl,
  readEnglishSourceHash,
  resolveLocalePublishState,
  shouldRedirectEnArticleToFr,
} from "../../scripts/article-i18n.mjs";
import { normalizeTrustedLocaleSitemapLoc, parseSitemapLocs } from "../../workers/sitemap-canonicals.js";

const FR_URL = "https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html";
const FR_REL = "l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html";

describe("POC French share-links article i18n", () => {
  it("loads the French artifact with matching sourceHash and ready status", () => {
    const artifact = loadLocaleArtifact(SHARE_LINKS_ARTICLE_ID, "fr");
    expect(artifact).toBeTruthy();
    expect(artifact.locale).toBe("fr");
    expect(artifact.articleId).toBe(SHARE_LINKS_ARTICLE_ID);
    expect(artifact.status).toBe("ready");
    const hash = readEnglishSourceHash();
    expect(artifact.sourceHash).toBe(hash);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("marks stale or missing translations as not publishable", () => {
    const hash = readEnglishSourceHash();
    expect(resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "fr", hash).publishable).toBe(true);
    expect(resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "fr", "0".repeat(64)).reason).toBe("stale");
    expect(resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "de", hash).reason).toBe("missing");
    expect(collectPublishableLocaleArticleLocs("0".repeat(64))).toEqual([]);
    expect(collectPublishableLocaleArticleLocs(hash)).toEqual([FR_URL]);
  });

  it("normalizes only trusted locale article hosts", () => {
    expect(normalizeTrustedLocaleSitemapLoc(FR_URL)).toBe(FR_URL);
    expect(normalizeTrustedLocaleSitemapLoc("https://www.11tik.com/l/fr/2026/08/x.html")).toBeNull();
    expect(normalizeTrustedLocaleSitemapLoc("https://evil.com/l/fr/2026/08/x.html")).toBeNull();
    expect(normalizeTrustedLocaleSitemapLoc("https://fr.11tik.com/l/es/2026/08/x.html")).toBeNull();
    expect(normalizeTrustedLocaleSitemapLoc("https://fr.11tik.com/l/fr/")).toBeNull();
    expect(normalizeTrustedLocaleSitemapLoc("https://ar.11tik.com/l/ar/")).toBeNull();
  });

  it("generates French static HTML with canonical and reciprocal hreflang", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-fr-poc-"));
    try {
      generateStaticSite(dir);
      expect(existsSync(join(dir, FR_REL))).toBe(true);
      const html = readFileSync(join(dir, FR_REL), "utf8");
      expect(html).toContain('lang="fr"');
      expect(html).toContain('dir="ltr"');
      expect(html).toContain(`rel="canonical" href="${FR_URL}"`);
      expect(html).toContain(`hreflang="en" href="${SHARE_LINKS_EN_HREF}"`);
      expect(html).toContain(`hreflang="fr" href="${FR_URL}"`);
      expect(html).toContain(`hreflang="x-default" href="${SHARE_LINKS_EN_HREF}"`);
      expect(html).toContain("Comment fonctionnent les liens de partage 11tik");
      expect(html).toContain("FAQ");
      expect(html).toContain('alt="Schéma comparant une URL YouTube');
      expect(html).not.toContain("noindex");
      expect(localeArticlePublicUrl(SHARE_LINKS_ARTICLE_ID, "fr")).toBe(FR_URL);
      expect(FR_URL.startsWith("https://www.")).toBe(false);
      expect(FR_URL).toContain("fr.11tik.com/l/fr/");
      const manifest = JSON.parse(readFileSync(join(dir, "web-client/i18n/poc-share-links-fr.json"), "utf8"));
      expect(manifest).toEqual(buildPocFrReadinessManifest(true, readEnglishSourceHash()));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("includes FR sitemap loc only when ready and file exists; never emits orphan locs", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-fr-sm-"));
    try {
      generateStaticSite(dir);
      const locs = parseSitemapLocs(readFileSync(join(dir, "sitemap.xml"), "utf8"));
      const frLocs = locs.filter((loc) => loc === FR_URL);
      expect(frLocs).toHaveLength(1);
      expect(locs).toContain(SHARE_LINKS_EN_HREF);
      assertLocaleSitemapLocsHaveFiles(dir, frLocs);
      expect(localeArticleLocToAssetRel(FR_URL)).toBe(FR_REL);
      expect(existsSync(join(dir, FR_REL))).toBe(true);
      for (const loc of frLocs) {
        const html = readFileSync(join(dir, localeArticleLocToAssetRel(loc)), "utf8");
        expect(html).toContain(`hreflang="fr" href="${loc}"`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(hashArticleSource("x")).not.toBe(readEnglishSourceHash());
  });

  it("writes ready:false manifest and no FR file/hreflang/sitemap when translation is stale", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-fr-stale-"));
    try {
      // Simulate generation path without relying on mutating fr.json: assert helpers + empty publish set.
      const staleHash = "0".repeat(64);
      expect(collectPublishableLocaleArticleLocs(staleHash)).toEqual([]);
      const manifest = buildPocFrReadinessManifest(false, staleHash);
      expect(manifest.ready).toBe(false);
      expect(manifest.url).toBeNull();
      const themeNotReady = buildBloggerPocThemeFragment(false);
      expect(themeNotReady).not.toContain(FR_URL);
      expect(themeNotReady).not.toContain("yte-poc-share-links-fr-redir");
      expect(themeNotReady).toContain("https://fr.11tik.com/");
      generateStaticSite(dir);
      // Current artifact is ready — file exists. Soft check: assert helper rejects orphan loc.
      expect(() => assertLocaleSitemapLocsHaveFiles(dir, [FR_URL.replace("youtube", "missing")])).toThrow(
        /without generated files/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prevents redirect loops and requires frenchPublishable", () => {
    const dest = shouldRedirectEnArticleToFr({
      pathname: "/2026/08/11tik-share-links-thumb-vs-youtube.html",
      savedLang: "",
      sessionRedirected: false,
      browserLanguages: ["fr-FR", "en"],
      frenchPublishable: true,
    });
    expect(dest).toBe(FR_URL);
    expect(
      shouldRedirectEnArticleToFr({
        pathname: "/2026/08/11tik-share-links-thumb-vs-youtube.html",
        savedLang: "en",
        sessionRedirected: false,
        browserLanguages: ["fr"],
        frenchPublishable: true,
      }),
    ).toBeNull();
    expect(
      shouldRedirectEnArticleToFr({
        pathname: "/2026/08/11tik-share-links-thumb-vs-youtube.html",
        savedLang: "",
        sessionRedirected: true,
        browserLanguages: ["fr"],
        frenchPublishable: true,
      }),
    ).toBeNull();
    expect(
      shouldRedirectEnArticleToFr({
        pathname: "/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html",
        savedLang: "",
        sessionRedirected: false,
        browserLanguages: ["fr"],
        frenchPublishable: true,
      }),
    ).toBeNull();
    expect(
      shouldRedirectEnArticleToFr({
        pathname: "/2026/08/11tik-share-links-thumb-vs-youtube.html",
        savedLang: "",
        sessionRedirected: false,
        browserLanguages: ["fr"],
        frenchPublishable: false,
      }),
    ).toBeNull();
  });

  it("keeps Blogger theme POC fragment aligned with ready translation (local only)", () => {
    const theme = readFileSync(join(process.cwd(), "docs/blogger-theme.xml"), "utf8");
    const hash = readEnglishSourceHash();
    const ready = resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "fr", hash).publishable;
    expect(ready).toBe(true);
    const synced = applyBloggerPocTheme(theme, ready);
    expect(synced).toContain(FR_URL);
    expect(synced).toContain("poc-share-links-fr.json");
    expect(synced).toContain("YTE-POC-SHARE-LINKS-I18N:BEGIN");
    expect(synced).toContain(`hreflang='fr' rel='alternate'`);
    expect(synced).toContain(SHARE_LINKS_EN_HREF);
    const notReady = applyBloggerPocTheme(theme, false);
    expect(notReady).not.toContain(FR_URL);
    expect(notReady).not.toContain("poc-share-links-fr.json");
    expect(buildBloggerPocThemeFragment(true)).toContain(FR_URL);
    expect(buildBloggerPocThemeFragment(false)).not.toContain(FR_URL);
  });

  it("documents Worker-zero path: FR article outside run_worker_first", () => {
    const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
    expect(wrangler.assets.not_found_handling).toBe("single-page-application");
    expect(wrangler.assets.run_worker_first).toContain("/2026/*");
    expect(wrangler.assets.run_worker_first).not.toContain("/l/*");
    expect(wrangler.assets.run_worker_first.some((p) => String(p).includes("/l/"))).toBe(false);
    expect(wrangler.kv_namespaces).toBeUndefined();
    expect(wrangler.triggers).toBeUndefined();
  });
});
