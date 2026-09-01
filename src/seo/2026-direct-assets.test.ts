import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GUIDE_POSTS } from "../../src/content/posts.ts";
import worker from "../../workers/11tik-edge.js";
import {
  article2026HtmlTrailingSlashRedirect,
  handleLocalized2026PathRequest,
  handlePrimary2026PathRequest,
  isLocalized2026Path,
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
const MISSING_LOCALIZED_HTML = "/l/fr/2026/08/this-page-does-not-exist-unique-test.html";
const EN_ONLY_STUDY = "/2026/08/youtube-thumbnail-sizes-resolutions-study.html";
const EN_ONLY_STUDY_FR = "/l/fr/2026/08/youtube-thumbnail-sizes-resolutions-study.html";
const EN_ONLY_STUDY_AR = "/l/ar/2026/08/youtube-thumbnail-sizes-resolutions-study.html";
const LOCALIZED_SAMPLE = "/l/fr/2026/08/how-to-download-youtube-thumbnail.html";
const LOCALIZED_SAMPLE_AR = "/l/ar/2026/08/how-to-download-youtube-thumbnail.html";

const GUIDE_PATHS = GUIDE_POSTS.map((post) => new URL(post.href).pathname);

function stagedAssetFetch(staged: string) {
  return {
    fetch(req: Request) {
      let path = new URL(req.url).pathname;
      if (path === "/" || path === "") path = "/index.html";
      const file = join(staged, path.replace(/^\//, ""));
      try {
        const body = readFileSync(file, "utf8");
        return Promise.resolve(new Response(body, { status: 200 }));
      } catch {
        return Promise.resolve(new Response("Not Found", { status: 404 }));
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
    expect(isLocalized2026Path("/l/fr/2026/08/x.html")).toBe(true);
    expect(isLocalized2026Path("/l/xx/2026/08/x.html")).toBe(true);
    expect(
      article2026HtmlTrailingSlashRedirect(new URL(`${SITE_ORIGIN}${SAMPLE_ARTICLE}/`)),
    ).toBe(`${SITE_ORIGIN}${SAMPLE_ARTICLE}`);
  });
});

describe("Phase 6D — Worker routing", () => {
  const wrangler = readWranglerConfig();
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("H. keeps /2026/* in RWF; English and localized .html articles Worker-first (Phase R1)", () => {
    expect(wrangler.assets.run_worker_first).toContain("/2026/*");
    expect(matchesRunWorkerFirst(SAMPLE_ARTICLE)).toBe(true);
    expect(matchesRunWorkerFirst("/l/fr/2026/08/how-to-download-youtube-thumbnail.html")).toBe(true);
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

describe("Phase R1 — localized /l/{locale}/2026/* hard 404", () => {
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("existing localized FR article → 200", async () => {
    const res = await worker.fetch(new Request(`https://fr.11tik.com${LOCALIZED_SAMPLE}`), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(LOCALIZED_SAMPLE);
  });

  it("existing localized AR article → 200", async () => {
    const res = await worker.fetch(new Request(`https://ar.11tik.com${LOCALIZED_SAMPLE_AR}`), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(LOCALIZED_SAMPLE_AR);
  });

  it("missing localized article → 404", async () => {
    const res = await worker.fetch(
      new Request(`https://fr.11tik.com/l/fr/2026/08/definitely-missing-article.html`),
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("404 Not Found");
  });

  it("EN-only study primary → 200", async () => {
    const res = await worker.fetch(new Request(`${SITE_ORIGIN}${EN_ONLY_STUDY}`), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("youtube-thumbnail-sizes-resolutions-study");
  });

  it("EN-only study localized FR/AR/de → 404", async () => {
    for (const path of [
      EN_ONLY_STUDY_FR,
      EN_ONLY_STUDY_AR,
      "/l/de/2026/08/youtube-thumbnail-sizes-resolutions-study.html",
    ]) {
      const res = await worker.fetch(new Request(`https://www.11tik.com${path}`), env);
      expect(res.status, path).toBe(404);
      expect(await res.text(), path).toContain("404 Not Found");
    }
  });

  it("invalid locale in localized 2026 path → 404", async () => {
    const res = await worker.fetch(
      new Request("https://www.11tik.com/l/xx/2026/08/example.html"),
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("404 Not Found");
  });

  it("does not intercept homepage or web-client assets", async () => {
    expect(await handleLocalized2026PathRequest(new URL(`${SITE_ORIGIN}/`), env)).toBeNull();
    expect(await handleLocalized2026PathRequest(new URL(`${SITE_ORIGIN}/l/fr/`), env)).toBeNull();
    expect(
      await handleLocalized2026PathRequest(new URL(`${SITE_ORIGIN}/web-client/assets/foo.js`), env),
    ).toBeNull();
  });
});

describe("Phase 6D — regressions", () => {
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("K. localized article unchanged (200, not 404)", async () => {
    const res = await worker.fetch(
      new Request(`https://www.11tik.com${LOCALIZED_SAMPLE}`),
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(LOCALIZED_SAMPLE);
  });

  it("localized missing → 404 (Phase R1)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const res = await worker.fetch(
      new Request(`https://www.11tik.com${MISSING_LOCALIZED_HTML}`),
      env,
    );
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain("404 Not Found");
    expect(body).not.toMatch(/id=["']yte-root["']/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
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

describe("Phase R2 — global SPA fallback removed (opt-in homepage + thumb only)", () => {
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("wrangler not_found_handling is 404-page", () => {
    expect(readWranglerConfig().assets.not_found_handling).toBe("404-page");
  });

  const junk404: Array<[string, string]> = [
    ["https://www.11tik.com/random-garbage", "/random-garbage"],
    ["https://www.11tik.com/music/test-video-id", "/music/test-video-id"],
    ["https://www.11tik.com/definitely-not-a-page", "/definitely-not-a-page"],
    ["https://www.11tik.com/foo/bar/baz", "/foo/bar/baz"],
    ["https://fr.11tik.com/l/fr/random-garbage", "/l/fr/random-garbage"],
    ["https://ar.11tik.com/l/ar/random-garbage", "/l/ar/random-garbage"],
    ["https://fr.11tik.com/l/fr/random.html", "/l/fr/random.html"],
    ["https://fr.11tik.com/l/fr/2026/08/missing.html", "/l/fr/2026/08/missing.html"],
    ["https://ar.11tik.com/l/ar/2026/08/missing.html", "/l/ar/2026/08/missing.html"],
    ["https://www.11tik.com/web-client/assets/missing-file-xyz.css", "/web-client/assets/missing-file-xyz.css"],
  ];

  for (const [url, label] of junk404) {
    it(`${label} → 404`, async () => {
      const res = await worker.fetch(new Request(url), env);
      expect(res.status, label).toBe(404);
      const body = await res.text();
      expect(body, label).toContain("404 Not Found");
      expect(body, label).not.toMatch(/id=["']yte-root["']/);
    });
  }

  it("/ → 200 English homepage SPA", async () => {
    const res = await worker.fetch(new Request(`${SITE_ORIGIN}/`), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/id=["']yte-root["']/);
  });

  it("/l/fr/ and /l/ar/ → 200 localized homepages", async () => {
    for (const url of ["https://fr.11tik.com/l/fr/", "https://ar.11tik.com/l/ar/"]) {
      const res = await worker.fetch(new Request(url), env);
      expect(res.status, url).toBe(200);
      expect(await res.text(), url).toMatch(/id=["']yte-root["']/);
    }
  });

  it("/thumb/{id} → 200 explicit English SPA shell", async () => {
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(true);
    const res = await worker.fetch(new Request(`${SITE_ORIGIN}/thumb/dQw4w9WgXcQ`), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/id=["']yte-root["']/);
  });
});
