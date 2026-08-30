import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import worker from "../../workers/11tik-edge.js";
import { INDEXABLE_UTILITY_PATHS, parseSitemapLocs, SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";
import { SITEMAP_CANONICAL_URL, SITEMAP_PAGES_PATH } from "../../workers/sitemap-pages-redirect.js";
import {
  SEARCH_RETIRE_BODY,
  isSearchPath,
  searchRetireResponse,
} from "../../workers/search-retire.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst, readWranglerConfig } from "./test-helpers/run-worker-first.ts";

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

const SEARCH_URLS = [
  "https://www.11tik.com/search",
  "https://www.11tik.com/search?q=thumbnail",
  "https://www.11tik.com/search?q=anything",
  "https://www.11tik.com/search?updated-max=2026-08-01",
  "https://www.11tik.com/search/label/YouTube",
  "https://www.11tik.com/search/label/unknown",
];

describe("Phase 6C.2 — search retirement", () => {
  const wrangler = readWranglerConfig();
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("helper matches search paths and returns 410 on primary host only", () => {
    expect(isSearchPath("/search")).toBe(true);
    expect(isSearchPath("/search/label/YouTube")).toBe(true);
    expect(isSearchPath("/searching")).toBe(false);
    expect(isSearchPath("/")).toBe(false);

    const res = searchRetireResponse("/search");
    expect(res?.status).toBe(410);
    expect(res?.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res?.headers.get("cache-control")).toBe("public, max-age=3600, must-revalidate");
    expect(searchRetireResponse("/search", { primaryHost: false })).toBeNull();
    expect(searchRetireResponse("/")).toBeNull();
  });

  it.each(SEARCH_URLS)("%s → 410 Gone", async (url) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request(url), env);
    expect(res.status).toBe(410);
    const body = await res.text();
    expect(body).toBe(SEARCH_RETIRE_BODY);
    expect(body).not.toContain("blogger.com");
    expect(body).not.toContain("ghs.googlehosted");
    expect(body).not.toContain('rel="canonical"');
    expect(body).not.toContain("index,follow");
    expect(body).not.toContain("yte-root");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("keeps /search and /search/* in RWF so Worker 410 runs before SPA fallback", () => {
    expect(wrangler.assets.run_worker_first).toContain("/search");
    expect(wrangler.assets.run_worker_first).toContain("/search/*");
    expect(matchesRunWorkerFirst("/search")).toBe(true);
    expect(matchesRunWorkerFirst("/search/label/youtube")).toBe(true);
  });

  it("locale host /search does not enter primary-host 410 branch", async () => {
    const res = await worker.fetch(new Request("https://fr.11tik.com/search"), env);
    expect(res.status).not.toBe(410);
  });

  it("locale home /l/fr/ unchanged", async () => {
    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/"), env);
    expect(res.status).toBe(200);
  });

  it("/feeds/pages/default returns 410 (Phase 6E.2)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request("https://www.11tik.com/feeds/pages/default"), env);
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("410 Gone");
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

  it("sitemap remains 1095 locs with no /search URLs", () => {
    const locs = parseSitemapLocs(readFileSync(join(staged, "sitemap.xml"), "utf8"));
    expect(locs).toHaveLength(1095);
    expect(locs.some((loc) => loc.includes("/search"))).toBe(false);
    for (const path of INDEXABLE_UTILITY_PATHS) {
      expect(locs).toContain(`${SITE_ORIGIN}${path}`);
    }
  });
});

describe("Phase 6C.2 — core regression matrix", () => {
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("homepage and query shells unchanged", async () => {
    for (const url of ["https://www.11tik.com/", "https://www.11tik.com/?posts=1", "https://www.11tik.com/?bulk=1"]) {
      const res = await worker.fetch(new Request(url), env);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("<html");
    }
  });

  it("/p/about.html and /p/random.html unchanged", async () => {
    const about = await worker.fetch(new Request("https://www.11tik.com/p/about.html"), env);
    expect(about.status).toBe(200);
    expect(await about.text()).toContain("<html");

    const random = await worker.fetch(new Request("https://www.11tik.com/p/random.html"), env);
    expect(random.status).toBe(404);
  });

  it("/thumb/, /robots.txt, /sitemap.xml unchanged", async () => {
    const thumb = await worker.fetch(new Request("https://www.11tik.com/thumb/dQw4w9WgXcQ"), env);
    expect(thumb.status).toBe(200);

    const robots = await worker.fetch(new Request("https://www.11tik.com/robots.txt"), env);
    expect(robots.status).toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("Disallow: /search");
    expect(robotsBody).toContain("Sitemap: https://www.11tik.com/sitemap.xml");

    const sitemap = await worker.fetch(new Request("https://www.11tik.com/sitemap.xml"), env);
    expect(sitemap.status).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });
});
