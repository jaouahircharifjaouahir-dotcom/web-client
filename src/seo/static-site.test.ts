import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_POSTS } from "../content/posts";
import { generateStaticSite } from "../../scripts/generate-static-site.mjs";
import {
  INDEXABLE_UTILITY_PATHS,
  LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP,
  parseSitemapLocs,
} from "../../workers/sitemap-canonicals.js";

describe("build-time static site", () => {
  it("writes locale shells, robots, and sitemap without thumb redirects", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-static-"));
    try {
      generateStaticSite(dir);
      const home = readFileSync(join(dir, "index.html"), "utf8");
      const ar = readFileSync(join(dir, "l", "ar", "index.html"), "utf8");
      const fr = readFileSync(join(dir, "l", "fr", "index.html"), "utf8");
      const robots = readFileSync(join(dir, "robots.txt"), "utf8");
      const sitemap = readFileSync(join(dir, "sitemap.xml"), "utf8");
      const locs = parseSitemapLocs(sitemap);
      expect(home).toContain('lang="en"');
      expect(home).toContain('rel="canonical" href="https://www.11tik.com/"');
      expect(ar).toContain('lang="ar"');
      expect(ar).toContain('dir="rtl"');
      expect(ar).toContain('rel="canonical" href="https://ar.11tik.com/l/ar/"');
      expect(ar).toContain('hreflang="ar" href="https://ar.11tik.com/l/ar/"');
      expect(fr).toContain('lang="fr"');
      expect(fr).toContain('rel="canonical" href="https://fr.11tik.com/l/fr/"');
      expect(fr).not.toContain('rel="canonical" href="https://fr.11tik.com/"');
      expect(robots).toContain("User-agent: *");
      expect(robots).toContain("Allow: /");
      expect(robots).toContain("Disallow: /search");
      expect(robots).toContain("Disallow: /feeds/");
      expect(robots).toContain("Disallow: /hold-queue");
      expect(robots).toContain("Disallow: /web-client/hold-queue.json");
      expect(robots).toContain("Disallow: /web-client/__extracts.json");
      expect(robots).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
      expect(robots).not.toMatch(/^Host:/m);
      expect(robots).not.toContain("Disallow: /search?");
      expect(robots).not.toMatch(/^Disallow: \/web-client\/\s*$/m);
      expect(robots).not.toMatch(/^Disallow: \/thumb\//m);
      expect(robots).not.toMatch(/^Disallow: \/l\//m);
      expect(robots).not.toMatch(/^Disallow: \/2026\//m);
      expect(robots).not.toMatch(/^Disallow: \/p\/\s*$/m);
      expect(robots).not.toContain("Googlebot-Image");
      expect(robots).not.toContain("Googlebot-Video");
      expect(robots).not.toContain("sitemap-pages.xml");
      expect([...robots.matchAll(/^Sitemap:/gm)]).toHaveLength(1);
      expect(sitemap).toContain("https://www.11tik.com/");
      expect(sitemap).not.toContain("https://ar.11tik.com/");
      expect(locs).toHaveLength(1 + GUIDE_POSTS.length + INDEXABLE_UTILITY_PATHS.length);
      for (const path of LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP) {
        expect(sitemap).not.toContain(path);
      }
      expect(existsSync(join(dir, "_redirects"))).toBe(false);
      expect(existsSync(join(dir, "thumb", "index.html"))).toBe(false);
      expect(existsSync(join(dir, "utility", "thumb", "index.html"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
