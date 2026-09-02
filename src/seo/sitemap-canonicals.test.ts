import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_POSTS } from "../content/posts";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import { POST_DESCRIPTIONS } from "../../workers/post-descriptions.js";
import {
  INDEXABLE_UTILITY_PATHS,
  LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP,
  SITE_ORIGIN,
  buildSitemapXml,
  collectCanonicalSitemapLocs,
  collectLocaleHomeSitemapLocs,
  loadGuidePostHrefsFromFile,
  normalizeLocaleHomeSitemapLoc,
  normalizeSitemapLoc,
  normalizeTrustedLocaleSitemapLoc,
  parseSitemapLocs,
} from "../../workers/sitemap-canonicals.js";
import { ISO6391 } from "../../workers/iso6391.js";

function locsFromGeneratedSite() {
  const dir = getStagedStaticSite();
  return parseSitemapLocs(readFileSync(join(dir, "sitemap.xml"), "utf8"));
}

describe("sitemap canonical inventory", () => {
  it("normalizes only https www.11tik.com paths without query or hash", () => {
    expect(normalizeSitemapLoc("https://www.11tik.com/")).toBe(`${SITE_ORIGIN}/`);
    expect(normalizeSitemapLoc("https://www.11tik.com/p/about.html")).toBe(`${SITE_ORIGIN}/p/about.html`);
    expect(normalizeSitemapLoc("http://www.11tik.com/p/about.html")).toBeNull();
    expect(normalizeSitemapLoc("https://ar.11tik.com/l/ar/")).toBeNull();
    expect(normalizeSitemapLoc("https://www.11tik.com/p/about.html?x=1")).toBeNull();
    expect(normalizeSitemapLoc("https://www.11tik.com/p/about.html#x")).toBeNull();
  });

  it("normalizes trusted locale article locs only", () => {
    expect(
      normalizeTrustedLocaleSitemapLoc(
        "https://fr.11tik.com/l/fr/11tik-share-links-thumb-vs-youtube",
      ),
    ).toBe("https://fr.11tik.com/l/fr/11tik-share-links-thumb-vs-youtube");
    expect(normalizeTrustedLocaleSitemapLoc("https://fr.11tik.com/l/fr/")).toBeNull();
    expect(normalizeTrustedLocaleSitemapLoc("https://example.com/l/fr/11tik-share-links-thumb-vs-youtube")).toBeNull();
  });

  it("normalizes and collects every non-English locale home", () => {
    expect(normalizeLocaleHomeSitemapLoc("https://fr.11tik.com/l/fr/")).toBe("https://fr.11tik.com/l/fr/");
    expect(normalizeLocaleHomeSitemapLoc("https://fr.11tik.com/l/fr")).toBe("https://fr.11tik.com/l/fr/");
    expect(normalizeLocaleHomeSitemapLoc("https://www.11tik.com/")).toBeNull();
    expect(normalizeLocaleHomeSitemapLoc("https://en.11tik.com/l/en/")).toBeNull();
    expect(
      normalizeLocaleHomeSitemapLoc("https://fr.11tik.com/l/fr/2026/08/how-to-download-youtube-thumbnail.html"),
    ).toBeNull();
    const homes = collectLocaleHomeSitemapLocs();
    expect(homes).toHaveLength(ISO6391.length - 1);
    expect(homes).toContain("https://fr.11tik.com/l/fr/");
    expect(homes).toContain("https://ar.11tik.com/l/ar/");
    expect(homes.some((loc) => loc.includes("en.11tik.com"))).toBe(false);
  });

  it("does not treat POST_DESCRIPTIONS keys as sitemap membership", () => {
    for (const path of LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP) {
      expect(POST_DESCRIPTIONS[path], `expected legacy meta key ${path}`).toBeTruthy();
    }
    const locs = collectCanonicalSitemapLocs({
      postHrefs: GUIDE_POSTS.map((post) => post.href),
    });
    for (const path of LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP) {
      expect(locs).not.toContain(`${SITE_ORIGIN}${path}`);
    }
    expect(Object.keys(POST_DESCRIPTIONS).length).toBeGreaterThan(locs.length - 1);
  });

  it("never emits known legacy /p/ guide URLs", () => {
    const locs = locsFromGeneratedSite();
    for (const path of LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP) {
      expect(locs.some((loc) => loc.includes(path))).toBe(false);
    }
  });

  it("includes homepage exactly once, all GUIDE_POSTS, and the utility allowlist", () => {
    const locs = locsFromGeneratedSite();
    expect(locs.filter((loc) => loc === `${SITE_ORIGIN}/`)).toHaveLength(1);
    for (const post of GUIDE_POSTS) {
      expect(locs).toContain(post.href);
    }
    for (const path of INDEXABLE_UTILITY_PATHS) {
      expect(locs).toContain(`${SITE_ORIGIN}${path}`);
    }
    expect(locs).toContain(`${SITE_ORIGIN}/keyword-tools`);
  });

  it("has no duplicates; includes locale homes and all ready localized article URLs", () => {
    const locs = locsFromGeneratedSite();
    const manifest = scanPublishability();
    const homes = collectLocaleHomeSitemapLocs();
    expect(new Set(locs).size).toBe(locs.length);
    for (const home of homes) {
      expect(locs).toContain(home);
    }
    const localeArticleLocs = locs.filter(
      (loc) => /^https:\/\/[a-z]{2}\.11tik\.com\/l\/[a-z]{2}\/[a-z0-9][a-z0-9-]*$/.test(loc),
    );
    expect(localeArticleLocs.length).toBe(manifest.counts.ready);
    // Ready count tracks inventory×locales minus stale/missing (not a frozen 851).
    expect(localeArticleLocs.length).toBeGreaterThan(0);
    for (const loc of localeArticleLocs) {
      expect(loc).toMatch(/^https:\/\/[a-z]{2}\.11tik\.com\/l\/[a-z]{2}\//);
      expect(loc.includes("?")).toBe(false);
    }
    for (const loc of locs.filter((l) => l.startsWith("https://www.11tik.com"))) {
      expect(loc.includes("?")).toBe(false);
    }
  });

  it("loads blog hrefs from posts.ts and matches GUIDE_POSTS", () => {
    const fromFile = loadGuidePostHrefsFromFile(readFileSync(join(process.cwd(), "src/content/posts.ts"), "utf8"));
    expect(fromFile).toEqual(GUIDE_POSTS.map((post) => post.href));
  });

  it("builds stable sorted XML from collected locs", () => {
    const locs = collectCanonicalSitemapLocs({
      postHrefs: ["https://www.11tik.com/2026/08/youtube-thumbnail-url.html"],
      utilityPaths: ["/p/about.html"],
    });
    const xml = buildSitemapXml(locs);
    expect(xml).toContain("<urlset");
    expect(parseSitemapLocs(xml)).toEqual(locs);
  });
});
