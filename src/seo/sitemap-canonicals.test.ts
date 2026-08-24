import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_POSTS } from "../content/posts";
import { generateStaticSite } from "../../scripts/generate-static-site.mjs";
import { POST_DESCRIPTIONS } from "../../workers/post-descriptions.js";
import {
  INDEXABLE_UTILITY_PATHS,
  LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP,
  SITE_ORIGIN,
  buildSitemapXml,
  collectCanonicalSitemapLocs,
  loadGuidePostHrefsFromFile,
  normalizeSitemapLoc,
  normalizeTrustedLocaleSitemapLoc,
  parseSitemapLocs,
} from "../../workers/sitemap-canonicals.js";

function locsFromGeneratedSite() {
  const dir = mkdtempSync(join(tmpdir(), "11tik-sitemap-"));
  try {
    generateStaticSite(dir);
    return parseSitemapLocs(readFileSync(join(dir, "sitemap.xml"), "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
        "https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html",
      ),
    ).toBe("https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html");
    expect(normalizeTrustedLocaleSitemapLoc("https://fr.11tik.com/l/fr/")).toBeNull();
    expect(normalizeTrustedLocaleSitemapLoc("https://example.com/l/fr/2026/08/x.html")).toBeNull();
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
    expect(locs).toContain(`${SITE_ORIGIN}/p/keyword-tools.html`);
  });

  it("has no duplicates; allows only the ready French POC locale article host", () => {
    const locs = locsFromGeneratedSite();
    expect(new Set(locs).size).toBe(locs.length);
    const localeLocs = locs.filter((loc) => /^https:\/\/[a-z]{2}\.11tik\.com\//.test(loc));
    expect(localeLocs).toEqual([
      "https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html",
    ]);
    for (const loc of locs) {
      expect(loc.includes("?")).toBe(false);
      if (!loc.startsWith("https://www.11tik.com")) {
        expect(loc).toBe("https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html");
      }
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
