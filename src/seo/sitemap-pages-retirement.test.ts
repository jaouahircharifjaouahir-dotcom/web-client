import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import worker from "../../workers/11tik-edge.js";
import { INDEXABLE_UTILITY_PATHS } from "../../workers/sitemap-canonicals.js";
import {
  SITEMAP_CANONICAL_URL,
  SITEMAP_PAGES_PATH,
  isSitemapPagesPath,
  sitemapPagesRedirectResponse,
} from "../../workers/sitemap-pages-redirect.js";
import { parseSitemapLocs, SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";
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

describe("Phase 6C.1 — sitemap-pages.xml retirement", () => {
  const wrangler = readWranglerConfig();
  const staged = getStagedStaticSite();

  it("redirect helper returns 301 to canonical sitemap with query stripped", () => {
    expect(isSitemapPagesPath(SITEMAP_PAGES_PATH)).toBe(true);
    expect(isSitemapPagesPath("/sitemap.xml")).toBe(false);
    const res = sitemapPagesRedirectResponse(SITEMAP_PAGES_PATH);
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe(SITEMAP_CANONICAL_URL);
    expect(sitemapPagesRedirectResponse("/sitemap.xml")).toBeNull();
    expect(sitemapPagesRedirectResponse(SITEMAP_PAGES_PATH, { primaryHost: false })).toBeNull();
  });

  it("keeps /sitemap-pages.xml in RWF so Worker 301 runs before SPA fallback", () => {
    expect(wrangler.assets.run_worker_first).toContain("/sitemap-pages.xml");
    expect(matchesRunWorkerFirst("/sitemap-pages.xml")).toBe(true);
    expect(matchesRunWorkerFirst("/sitemap.xml")).toBe(false);
  });

  it("worker returns 301 for /sitemap-pages.xml without calling fetch (Blogger)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const env = { ASSETS: stagedAssetFetch(staged) };

    const clean = await worker.fetch(new Request(`https://www.11tik.com${SITEMAP_PAGES_PATH}`), env);
    expect(clean.status).toBe(301);
    expect(clean.headers.get("location")).toBe(SITEMAP_CANONICAL_URL);
    expect(clean.headers.get("link")).toBeNull();

    const withQuery = await worker.fetch(
      new Request(`https://www.11tik.com${SITEMAP_PAGES_PATH}?x=1`),
      env,
    );
    expect(withQuery.status).toBe(301);
    expect(withQuery.headers.get("location")).toBe(SITEMAP_CANONICAL_URL);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("serves /sitemap.xml as static asset 200", async () => {
    const env = { ASSETS: stagedAssetFetch(staged) };
    const res = await worker.fetch(new Request("https://www.11tik.com/sitemap.xml"), env);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).not.toContain("blogger.com");
  });

  it("utility URLs remain in static sitemap after removing sitemap-pages source", () => {
    const locs = parseSitemapLocs(readFileSync(join(staged, "sitemap.xml"), "utf8"));
    expect(locs).toHaveLength(1096);
    expect(locs.some((loc) => loc.includes("/index.html"))).toBe(false);
    for (const path of INDEXABLE_UTILITY_PATHS) {
      expect(locs).toContain(`${SITE_ORIGIN}${path}`);
    }
  });

  it("robots.txt advertises only sitemap.xml", () => {
    const robots = readFileSync(join(staged, "robots.txt"), "utf8");
    expect(robots).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
    expect(robots).not.toContain("sitemap-pages.xml");
  });
});

describe("Phase 6C.1 — regression routing matrix", () => {
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("/feeds/pages/default returns 410 (Phase 6E.2; no fetchBlogger)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request("https://www.11tik.com/feeds/pages/default"), env);
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("410 Gone");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("/search returns 410 (Phase 6C.2; no fetchBlogger)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request("https://www.11tik.com/search"), env);
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("410 Gone");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("/feeds/posts/default stays static (no fetchBlogger)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request("https://www.11tik.com/feeds/posts/default"), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<feed");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("/p/about.html and /l/fr/ and /thumb/ unchanged (static/asset passthrough)", async () => {
    const about = await worker.fetch(new Request("https://www.11tik.com/p/about.html"), env);
    expect(about.status).toBe(200);
    expect(await about.text()).toContain("<html");

    const locale = await worker.fetch(new Request("https://fr.11tik.com/l/fr/"), env);
    expect(locale.status).toBe(200);

    const thumb = await worker.fetch(new Request("https://www.11tik.com/thumb/dQw4w9WgXcQ"), env);
    expect(thumb.status).toBe(200);
  });

  it("/robots.txt unchanged direct asset", async () => {
    const res = await worker.fetch(new Request("https://www.11tik.com/robots.txt"), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
  });
});

describe("Phase 6C.1 — live-safety expected matrix (pre-deploy)", () => {
  it("documents expected production behavior after deploy", () => {
    expect({
      "/sitemap-pages.xml": { status: 301, location: SITEMAP_CANONICAL_URL },
      "/sitemap-pages.xml?x=1": { status: 301, location: SITEMAP_CANONICAL_URL },
      "/sitemap.xml": { status: 200, type: "static-xml" },
      "/feeds/pages/default": { status: 410, source: "worker" },
    }).toMatchObject({
      "/sitemap-pages.xml": { status: 301 },
      "/sitemap.xml": { status: 200 },
    });
  });
});
