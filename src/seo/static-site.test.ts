import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_POSTS } from "../content/posts";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import {
  LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP,
  collectCanonicalSitemapLocs,
  collectLocaleHomeSitemapLocs,
  parseSitemapLocs,
} from "../../workers/sitemap-canonicals.js";

describe("build-time static site", () => {
  it("writes locale shells, robots, and sitemap without thumb redirects", () => {
    const dir = getStagedStaticSite();
    const home = readFileSync(join(dir, "index.html"), "utf8");
      const ar = readFileSync(join(dir, "l", "ar", "index.html"), "utf8");
      const fr = readFileSync(join(dir, "l", "fr", "index.html"), "utf8");
      const robots = readFileSync(join(dir, "robots.txt"), "utf8");
      const sitemap = readFileSync(join(dir, "sitemap.xml"), "utf8");
      const locs = parseSitemapLocs(sitemap);
      const manifest = scanPublishability();
      const englishLocs = collectCanonicalSitemapLocs({
        postHrefs: GUIDE_POSTS.map((post) => post.href),
      });

      expect(home).toContain('lang="en"');
      expect(home).toContain('rel="canonical" href="https://www.11tik.com/"');
      expect(home).toMatch(/<div id="yte-root"><h1>[^<]+<\/h1><p>/);
      expect(home).toContain("<h1>YouTube Thumbnail Extractor</h1>");
      expect(home).toContain("yte-shell-guides");
      expect(ar).toContain('lang="ar"');
      expect(ar).toContain('dir="rtl"');
      expect(ar).toContain('rel="canonical" href="https://ar.11tik.com/l/ar/"');
      expect(ar).toContain('hreflang="ar" href="https://ar.11tik.com/l/ar/"');
      expect(ar).toMatch(/<div id="yte-root"><h1>[^<]+<\/h1><p>/);
      expect(fr).toContain('lang="fr"');
      expect(fr).toContain('rel="canonical" href="https://fr.11tik.com/l/fr/"');
      expect(fr).not.toContain('rel="canonical" href="https://fr.11tik.com/"');
      expect(fr).toContain("<h1>Extracteur de miniatures YouTube</h1>");
      expect(fr).toContain("yte-shell-guides");
      expect(robots).toContain("User-agent: *");
      expect(robots).toContain("Allow: /");
      expect(robots).toContain("Disallow: /search");
      expect(robots).toContain("Disallow: /feeds/");
      expect(robots).toContain("Disallow: /hold-queue");
      expect(robots).toContain("Disallow: /web-client/hold-queue.json");
      expect(robots).toContain("Disallow: /web-client/__extracts.json");
      expect(robots).toContain("User-agent: GPTBot");
      expect(robots).toContain("User-agent: DeepseekBot");
      expect(robots).toContain("User-agent: anthropic-ai");
      expect(robots).toContain("User-agent: xAI-Bot");
      expect(robots).toContain("User-agent: Amazonbot");
      expect(robots).toMatch(/^User-agent: Amazonbot\r?\nAllow: \//m);
      expect(robots).toContain("Content-Signal: search=yes,ai-train=no,use=reference");
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
      expect(sitemap).toContain("https://fr.11tik.com/l/fr/2026/08/11tik-share-links-thumb-vs-youtube.html");
      expect(sitemap).toContain("https://ar.11tik.com/l/ar/2026/08/how-to-download-youtube-thumbnail.html");
      expect(locs).toHaveLength(englishLocs.length + manifest.counts.ready + collectLocaleHomeSitemapLocs().length);
      expect(locs.filter((loc) => /https:\/\/[a-z]{2}\.11tik\.com\/l\/[a-z]{2}\/.+\.html$/.test(loc))).toHaveLength(
        manifest.counts.ready,
      );
      expect(locs).toContain("https://fr.11tik.com/l/fr/");
      expect(locs).toContain("https://ar.11tik.com/l/ar/");
      expect(existsSync(join(dir, "l", "fr", "2026", "08", "11tik-share-links-thumb-vs-youtube.html"))).toBe(
        true,
      );
      for (const path of LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP) {
        expect(sitemap).not.toContain(path);
      }
      expect(existsSync(join(dir, "_redirects"))).toBe(true);
      const redirects = readFileSync(join(dir, "_redirects"), "utf8");
      expect(redirects).toContain(
        "/2026/08/youtube-thumbnail-url /2026/08/youtube-thumbnail-url.html 301",
      );
      expect(existsSync(join(dir, "thumb", "index.html"))).toBe(false);
      expect(existsSync(join(dir, "utility", "thumb", "index.html"))).toBe(false);
  });
});
