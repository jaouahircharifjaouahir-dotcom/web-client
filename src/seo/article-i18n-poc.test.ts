import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
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
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import { normalizeTrustedLocaleSitemapLoc, parseSitemapLocs } from "../../workers/sitemap-canonicals.js";

const FR_URL = "https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html";
const FR_REL = "l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html";

describe("POC French share-links article i18n (regression)", () => {
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
    expect(resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "aa", hash).reason).toBe("missing");
    // Publishability is driven by artifact vs English source file hash (not a caller override).
    const locs = collectPublishableLocaleArticleLocs(hash);
    expect(locs).toContain(FR_URL);
    expect(locs.every((loc) => loc.includes(".11tik.com/l/"))).toBe(true);
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
    const dir = getStagedStaticSite();
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
      expect(html).toMatch(/alt="[^"]+"/);
      expect(html).toContain("yte-hero");
      expect(html).not.toContain("noindex");
      expect(localeArticlePublicUrl(SHARE_LINKS_ARTICLE_ID, "fr")).toBe(FR_URL);
      expect(FR_URL.startsWith("https://www.")).toBe(false);
      expect(FR_URL).toContain("fr.11tik.com/l/fr/");
      const manifest = JSON.parse(readFileSync(join(dir, "web-client/i18n/poc-share-links-fr.json"), "utf8"));
      expect(manifest).toEqual(buildPocFrReadinessManifest(true, readEnglishSourceHash()));
  });

  it("includes ready locale sitemap locs with matching generated files", () => {
    const dir = getStagedStaticSite();
    const locs = parseSitemapLocs(readFileSync(join(dir, "sitemap.xml"), "utf8"));
      const frLocs = locs.filter((loc) => loc === FR_URL);
      expect(frLocs).toHaveLength(1);
      expect(locs).toContain(SHARE_LINKS_EN_HREF);
      const ready = scanPublishability().counts.ready;
      expect(locs.filter((loc) => loc.includes("/l/")).length).toBeGreaterThanOrEqual(ready);
      assertLocaleSitemapLocsHaveFiles(
        dir,
        locs.filter((loc) => loc.includes("/l/")),
      );
      expect(localeArticleLocToAssetRel(FR_URL)).toBe(FR_REL);
      expect(existsSync(join(dir, FR_REL))).toBe(true);
      for (const loc of frLocs) {
        const html = readFileSync(join(dir, localeArticleLocToAssetRel(loc)), "utf8");
        expect(html).toContain(`hreflang="fr" href="${loc}"`);
      }
    expect(hashArticleSource("x")).not.toBe(readEnglishSourceHash());
  });

  it("writes ready:false manifest helpers and rejects orphan sitemap locs", () => {
    const dir = getStagedStaticSite();
    const staleHash = "0".repeat(64);
      expect(resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "fr", staleHash).reason).toBe("stale");
      const manifest = buildPocFrReadinessManifest(false, staleHash);
      expect(manifest.ready).toBe(false);
      expect(manifest.url).toBeNull();
      const themeNotReady = buildBloggerPocThemeFragment(false);
      expect(themeNotReady).not.toContain("publishability.json");
      expect(themeNotReady).not.toContain("yte-i18n-redir");
      expect(themeNotReady).toContain("https://fr.11tik.com/");
      expect(() => assertLocaleSitemapLocsHaveFiles(dir, [FR_URL.replace("youtube", "missing")])).toThrow(
        /without generated files/,
      );
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

  it("keeps Blogger theme fragment aligned with compact publishability manifest (local only)", () => {
    const theme = readFileSync(join(process.cwd(), "docs/blogger-theme.xml"), "utf8");
    const hash = readEnglishSourceHash();
    const ready = resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "fr", hash).publishable;
    expect(ready).toBe(true);
    const synced = applyBloggerPocTheme(theme, ready);
    expect(synced).toContain("publishability.json");
    expect(synced).toContain("fetch('/web-client/i18n/publishability.json'");
    expect(synced).not.toContain("https://www.11tik.com/web-client/i18n/publishability.json");
    expect(synced).toContain("yte-i18n-redir");
    expect(synced).toContain("YTE-POC-SHARE-LINKS-I18N:BEGIN");
    expect(synced).toContain("Googlebot");
    expect(synced).toContain("/^\\/l\\//");
    const notReady = applyBloggerPocTheme(theme, false);
    expect(notReady).not.toContain("publishability.json");
    expect(buildBloggerPocThemeFragment(true)).toContain("publishability.json");
    expect(buildBloggerPocThemeFragment(false)).not.toContain("publishability.json");
  });

  it("documents Worker-first /l/* for locale directory homes; articles passthrough ASSETS", () => {
    const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
    expect(wrangler.assets.not_found_handling).toBe("404-page");
    expect(wrangler.assets.html_handling).toBe("none");
    expect(wrangler.assets.run_worker_first).toContain("/2026/*");
    expect(wrangler.assets.run_worker_first).not.toContain("/2026/*.html");
    // Phase 2B: /p/* Worker-first with six utility .html exclusions → direct Assets.
    expect(wrangler.assets.run_worker_first).toContain("/p/*");
    expect(wrangler.assets.run_worker_first).toContain("!/p/about.html");
    // Locale directory homes (/l/fr/) need Worker before Assets SPA fallback; explicit
    // /l/fr/2026/*.html still reach ASSETS via Worker passthrough (not locale-home rewrite).
    expect(wrangler.assets.run_worker_first).toContain("/l/*");
    expect(wrangler.assets.run_worker_first).not.toContain("/l/*/2026/*.html");
    expect(wrangler.kv_namespaces).toBeUndefined();
    expect(wrangler.triggers).toBeUndefined();
  });
});
