import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import worker from "../../workers/11tik-edge.js";
import { GUIDE_POSTS } from "../content/posts.ts";
import { buildIndexNowSnapshot } from "../../scripts/i18n/indexnow-snapshot.mjs";
import { INDEXABLE_UTILITY_PATHS, parseSitemapLocs, SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";
import {
  PAGES_FEED_RETIRE_BODY,
  isPagesFeedPath,
  pagesFeedRetireResponse,
} from "../../workers/pages-feed-retire.js";
import { SITEMAP_CANONICAL_URL, SITEMAP_PAGES_PATH } from "../../workers/sitemap-pages-redirect.js";
import { SEARCH_RETIRE_BODY } from "../../workers/search-retire.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst, readWranglerConfig } from "./test-helpers/run-worker-first.ts";

const GUIDE_PATHS = GUIDE_POSTS.map((post) => new URL(post.href).pathname);

const PAGES_FEED_URLS = [
  "https://www.11tik.com/feeds/pages/default",
  "https://www.11tik.com/feeds/pages/default?alt=atom",
  "https://www.11tik.com/feeds/pages/default?max-results=50",
  "https://www.11tik.com/feeds/pages/anything",
  "https://www.11tik.com/feeds/pages/foo/bar",
];

function stagedAssetFetch(staged: string) {
  return {
    fetch(req: Request) {
      const path = new URL(req.url).pathname.replace(/^\//, "");
      const file = join(staged, path);
      try {
        const body = readFileSync(file, "utf8");
        return Promise.resolve(new Response(body, { status: 200 }));
      } catch {
        const index = join(staged, "index.html");
        const body = readFileSync(index, "utf8");
        return Promise.resolve(new Response(body, { status: 200 }));
      }
    },
  };
}

describe("Phase 6E.2 — pages feed retirement", () => {
  const wrangler = readWranglerConfig();
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("helper matches pages feed paths and returns 410 on primary host only", () => {
    expect(isPagesFeedPath("/feeds/pages/default")).toBe(true);
    expect(isPagesFeedPath("/feeds/pages/anything")).toBe(true);
    expect(isPagesFeedPath("/feeds/posts/default")).toBe(false);
    expect(isPagesFeedPath("/feeds/comments/default")).toBe(false);

    const res = pagesFeedRetireResponse("/feeds/pages/default");
    expect(res?.status).toBe(410);
    expect(res?.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(pagesFeedRetireResponse("/feeds/pages/default", { primaryHost: false })).toBeNull();
  });

  it.each(PAGES_FEED_URLS)("%s → 410 Gone", async (url) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request(url), env);
    expect(res.status).toBe(410);
    const body = await res.text();
    expect(body).toBe(PAGES_FEED_RETIRE_BODY);
    expect(body).not.toContain("blogger.com");
    expect(body).not.toContain("ghs.googlehosted");
    expect(body).not.toContain('rel="canonical"');
    expect(body).not.toContain("index,follow");
    expect(body).not.toContain("yte-root");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("keeps /feeds/pages/* in RWF so Worker 410 runs before SPA fallback", () => {
    expect(wrangler.assets.run_worker_first).toContain("/feeds/pages/*");
    expect(matchesRunWorkerFirst("/feeds/pages/default")).toBe(true);
    expect(matchesRunWorkerFirst("/feeds/pages/anything")).toBe(true);
  });

  it("locale host /feeds/pages/default does not enter primary-host 410 branch", async () => {
    const res = await worker.fetch(new Request("https://fr.11tik.com/feeds/pages/default"), env);
    expect(res.status).not.toBe(410);
  });

  it("post feeds stay static (no fetchBlogger)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const atom = await worker.fetch(new Request("https://www.11tik.com/feeds/posts/default"), env);
    expect(atom.status).toBe(200);
    expect(await atom.text()).toContain("<feed");
    const rss = await worker.fetch(new Request("https://www.11tik.com/feeds/posts/default?alt=rss"), env);
    expect(rss.status).toBe(200);
    expect(await rss.text()).toContain("<rss");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("/sitemap-pages.xml remains 301 to canonical sitemap", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request(`https://www.11tik.com${SITEMAP_PAGES_PATH}`), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(SITEMAP_CANONICAL_URL);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("/search remains 410", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request("https://www.11tik.com/search"), env);
    expect(res.status).toBe(410);
    expect(await res.text()).toBe(SEARCH_RETIRE_BODY);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("/2026/* static article and unknown hard 404", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const article = await worker.fetch(
      new Request("https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html"),
      env,
    );
    expect(article.status).toBe(200);
    expect(await article.text()).not.toMatch(/id=["']yte-root["']/);

    const unknown = await worker.fetch(
      new Request("https://www.11tik.com/2026/08/this-page-does-not-exist-unique-test.html"),
      env,
    );
    expect(unknown.status).toBe(404);
    expect(await unknown.text()).toContain("404 Not Found");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("locale home /l/fr/ unchanged", async () => {
    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/"), env);
    expect(res.status).toBe(200);
  });

  it("utility pages unchanged", async () => {
    for (const path of INDEXABLE_UTILITY_PATHS) {
      const res = await worker.fetch(new Request(`https://www.11tik.com${path}`), env);
      expect(res.status, path).toBe(200);
      expect(await res.text()).toContain("<html");
    }
  });

  it("sitemap remains 1095 locs with no /search or feed URLs", () => {
    const locs = parseSitemapLocs(readFileSync(join(staged, "sitemap.xml"), "utf8"));
    expect(locs).toHaveLength(1095);
    expect(locs.some((loc) => loc.includes("/search"))).toBe(false);
    expect(locs.some((loc) => loc.includes("/feeds/"))).toBe(false);
    for (const path of GUIDE_PATHS) {
      expect(locs).toContain(`${SITE_ORIGIN}${path}`);
    }
    for (const path of INDEXABLE_UTILITY_PATHS) {
      expect(locs).toContain(`${SITE_ORIGIN}${path}`);
    }
  });

  it("IndexNow snapshot remains 1095 URLs", () => {
    expect(buildIndexNowSnapshot(staged).urlCount).toBe(1095);
  });

  it("robots.txt disallows /feeds/ and advertises only sitemap.xml", async () => {
    const res = await worker.fetch(new Request("https://www.11tik.com/robots.txt"), env);
    const body = await res.text();
    expect(body).toContain("Disallow: /feeds/");
    expect(body).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
    expect(body).not.toContain("sitemap-pages.xml");
  });
});

describe("Phase 6E.2 — Blogger runtime dependency guard", () => {
  const workerSource = readFileSync(join(process.cwd(), "workers/11tik-edge.js"), "utf8");

  it("production worker source has zero Blogger origin proxy symbols", () => {
    const codeOnly = workerSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/function fetchBlogger\b/);
    expect(codeOnly).not.toMatch(/\bfetchBlogger\s*\(/);
    expect(codeOnly).not.toMatch(/function polishBloggerHtml\b/);
    expect(codeOnly).not.toMatch(/\bpolishBloggerHtml\s*\(/);
    expect(codeOnly).not.toMatch(/function isBloggerContentPath\b/);
    expect(codeOnly).not.toMatch(/function bloggerRuntimeStubs\b/);
    expect(codeOnly).not.toContain("x-11tik-pass");
    expect(codeOnly).not.toContain("ghs.googlehosted.com");
    expect(codeOnly).not.toContain("resolveOverride");
  });

  it("no primary-host route invokes global fetch (Blogger proxy)", async () => {
    const staged = getStagedStaticSite();
    const env = { ASSETS: stagedAssetFetch(staged) };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));

    const routes = [
      "https://www.11tik.com/",
      "https://www.11tik.com/?posts=1",
      "https://www.11tik.com/?bulk=1",
      "https://www.11tik.com/p/about.html",
      "https://www.11tik.com/p/random.html",
      "https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html",
      "https://www.11tik.com/2026/08/unknown-test.html",
      "https://www.11tik.com/feeds/pages/default",
      "https://www.11tik.com/feeds/posts/default",
      "https://www.11tik.com/feeds/posts/default?alt=rss",
      "https://www.11tik.com/search",
      `https://www.11tik.com${SITEMAP_PAGES_PATH}`,
      "https://www.11tik.com/robots.txt",
      "https://www.11tik.com/sitemap.xml",
      "https://www.11tik.com/llms.txt",
      "https://www.11tik.com/thumb/dQw4w9WgXcQ",
      "https://fr.11tik.com/l/fr/",
    ];

    for (const url of routes) {
      await worker.fetch(new Request(url), env);
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("Phase 6E.2 — site-urls cleanup", () => {
  it("site-urls.mjs no longer fetches Blogger pages feed or exports collectSiteUrls", () => {
    const source = readFileSync(join(process.cwd(), "scripts/site-urls.mjs"), "utf8");
    expect(source).not.toContain("collectSiteUrls");
    expect(source).not.toContain("/feeds/pages/default");
    expect(source).not.toContain("readXml");
  });

  it("keywordLandingUrls still builds keyword sitemap URLs", async () => {
    const { keywordLandingUrls } = await import("../../scripts/site-urls.mjs");
    const urls = keywordLandingUrls();
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => url.startsWith("https://www.11tik.com/?k="))).toBe(true);
  });
});
