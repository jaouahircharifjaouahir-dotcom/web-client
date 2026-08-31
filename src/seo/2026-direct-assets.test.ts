import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GUIDE_POSTS } from "../../src/content/posts.ts";
import worker from "../../workers/11tik-edge.js";
import {
  article2026HtmlTrailingSlashRedirect,
  handlePrimary2026PathRequest,
  isPrimary2026Path,
  isSpaFallbackHtml,
} from "../../workers/article-2026-path.js";
import { parseSitemapLocs, SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";
import { SITEMAP_CANONICAL_URL, SITEMAP_PAGES_PATH } from "../../workers/sitemap-pages-redirect.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst, readWranglerConfig } from "./test-helpers/run-worker-first.ts";

const SAMPLE_ARTICLE = "/2026/08/how-to-download-youtube-thumbnail.html";
const SAMPLE_EXTENSIONLESS = "/2026/08/how-to-download-youtube-thumbnail";
const MISSING_HTML = "/2026/08/this-page-does-not-exist-unique-test.html";
const MISSING_EXTENSIONLESS = "/2026/08/this-page-does-not-exist-unique-test";

const GUIDE_PATHS = GUIDE_POSTS.map((post) => new URL(post.href).pathname);

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

describe("Phase 6D — /2026 static coverage", () => {
  const staged = getStagedStaticSite();

  it("A. 19/19 canonical article assets exist under staged static", () => {
    expect(GUIDE_PATHS).toHaveLength(19);
    for (const path of GUIDE_PATHS) {
      const rel = path.replace(/^\//, "");
      expect(existsSync(join(staged, rel)), path).toBe(true);
    }
  });

  it("helpers scope root /2026 only", () => {
    expect(isPrimary2026Path(SAMPLE_ARTICLE)).toBe(true);
    expect(isPrimary2026Path("/l/fr/2026/08/x.html")).toBe(false);
    expect(
      article2026HtmlTrailingSlashRedirect(new URL(`${SITE_ORIGIN}${SAMPLE_ARTICLE}/`)),
    ).toBe(`${SITE_ORIGIN}${SAMPLE_ARTICLE}`);
  });
});

describe("Phase 6D — Worker routing", () => {
  const wrangler = readWranglerConfig();
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("H. keeps /2026/* in RWF; English articles Worker-first, localized .html asset-first (Phase 7B)", () => {
    expect(wrangler.assets.run_worker_first).toContain("/2026/*");
    expect(matchesRunWorkerFirst(SAMPLE_ARTICLE)).toBe(true);
    expect(matchesRunWorkerFirst("/l/fr/2026/08/how-to-download-youtube-thumbnail.html")).toBe(false);
  });

  it("B. valid .html → 200 static article", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request(`${SITE_ORIGIN}${SAMPLE_ARTICLE}`), env);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('rel="canonical"');
    expect(body).toContain(SAMPLE_ARTICLE);
    expect(body).not.toMatch(/id=["']yte-root["']/);
    expect(body).not.toContain("blogger.com");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("C. valid extensionless → 301 .html", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request(`${SITE_ORIGIN}${SAMPLE_EXTENSIONLESS}`), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${SITE_ORIGIN}${SAMPLE_ARTICLE}`);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("D. missing .html → 404", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request(`${SITE_ORIGIN}${MISSING_HTML}`), env);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain("404 Not Found");
    expect(body).not.toMatch(/id=["']yte-root["']/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("E. missing extensionless → 404", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request(`${SITE_ORIGIN}${MISSING_EXTENSIONLESS}`), env);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("404 Not Found");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("F. trailing slash .html/ → 301 clean .html", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request(`${SITE_ORIGIN}${SAMPLE_ARTICLE}/`), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${SITE_ORIGIN}${SAMPLE_ARTICLE}`);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("G. SPA fallback HTML is detected", () => {
    const spa = readFileSync(join(staged, "index.html"), "utf8");
    expect(isSpaFallbackHtml(spa)).toBe(true);
    expect(isSpaFallbackHtml(readFileSync(join(staged, SAMPLE_ARTICLE.slice(1)), "utf8"))).toBe(false);
  });

  it("handlePrimary2026PathRequest returns null outside /2026", async () => {
    const url = new URL(`${SITE_ORIGIN}/p/about.html`);
    expect(await handlePrimary2026PathRequest(url, env)).toBeNull();
  });
});

describe("Phase 6D — regressions", () => {
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("K. localized article unchanged (200, not 404)", async () => {
    const res = await worker.fetch(
      new Request("https://www.11tik.com/l/fr/2026/08/how-to-download-youtube-thumbnail.html"),
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("/l/fr/2026/08/how-to-download-youtube-thumbnail.html");
  });

  it("localized missing keeps existing SPA passthrough", async () => {
    const res = await worker.fetch(
      new Request("https://www.11tik.com/l/fr/2026/08/this-page-does-not-exist-unique-test.html"),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/id=["']yte-root["']/);
  });

  it("/feeds/pages/default returns 410 (Phase 6E.2)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(new Request("https://www.11tik.com/feeds/pages/default"), env);
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("410 Gone");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("/search → 410 and /sitemap-pages.xml → 301", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const search = await worker.fetch(new Request("https://www.11tik.com/search"), env);
    expect(search.status).toBe(410);
    const sitemapPages = await worker.fetch(new Request(`https://www.11tik.com${SITEMAP_PAGES_PATH}`), env);
    expect(sitemapPages.status).toBe(301);
    expect(sitemapPages.headers.get("location")).toBe(SITEMAP_CANONICAL_URL);
    const feed = await worker.fetch(new Request("https://www.11tik.com/feeds/posts/default"), env);
    expect(feed.status).toBe(200);
    expect(await feed.text()).toContain("<feed");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("J. sitemap remains 1096 with all English guides", () => {
    const locs = parseSitemapLocs(readFileSync(join(staged, "sitemap.xml"), "utf8"));
    expect(locs).toHaveLength(1096);
    for (const path of GUIDE_PATHS) {
      expect(locs).toContain(`${SITE_ORIGIN}${path}`);
    }
  });
});
