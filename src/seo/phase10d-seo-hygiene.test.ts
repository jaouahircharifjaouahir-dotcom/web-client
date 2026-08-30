import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import worker from "../../workers/11tik-edge.js";
import {
  feedsCommentsOtherRetireResponse,
  isCommentsFeedPath,
  isOtherFeedPath,
} from "../../workers/feeds-comments-other-retire.js";
import {
  SITEMAP_IMAGES_RETIRE_BODY,
  isSitemapImagesPath,
  sitemapImagesRetireResponse,
} from "../../workers/sitemap-images-retire.js";
import { PAGES_FEED_RETIRE_BODY } from "../../workers/pages-feed-retire.js";
import { buildIndexNowSnapshot, INDEXNOW_COPYRIGHT_URL } from "../../scripts/i18n/indexnow-snapshot.mjs";
import { parseSitemapLocs } from "../../workers/sitemap-canonicals.js";
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

async function expectRetire410(url: string, env: { ASSETS: { fetch: (req: Request) => Promise<Response> } }) {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch must not run"));
  const res = await worker.fetch(new Request(url), env);
  expect(res.status).toBe(410);
  const body = await res.text();
  expect(body).toContain("410 Gone");
  expect(body).not.toContain('id="yte-root"');
  expect(body).not.toContain('rel="canonical"');
  expect(body).not.toContain("index,follow");
  expect(body).not.toMatch(/blogspot|ghs\.googlehosted/i);
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
}

describe("Phase 10D — sitemap-images retirement", () => {
  const wrangler = readWranglerConfig();
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("helper matches /sitemap-images.xml only", () => {
    expect(isSitemapImagesPath("/sitemap-images.xml")).toBe(true);
    expect(isSitemapImagesPath("/sitemap.xml")).toBe(false);
    expect(sitemapImagesRetireResponse("/sitemap-images.xml")?.status).toBe(410);
    expect(sitemapImagesRetireResponse("/sitemap-images.xml", { primaryHost: false })).toBeNull();
  });

  it("/sitemap-images.xml → 410 Gone (no SPA)", async () => {
    await expectRetire410("https://www.11tik.com/sitemap-images.xml", env);
    const res = await worker.fetch(new Request("https://www.11tik.com/sitemap-images.xml"), env);
    expect(await res.text()).toBe(SITEMAP_IMAGES_RETIRE_BODY);
  });

  it("RWF includes /sitemap-images.xml", () => {
    expect(wrangler.assets.run_worker_first).toContain("/sitemap-images.xml");
    expect(matchesRunWorkerFirst("/sitemap-images.xml")).toBe(true);
  });
});

describe("Phase 10D — feeds comments/other retirement", () => {
  const wrangler = readWranglerConfig();
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it("helpers match comments and other feed families", () => {
    expect(isCommentsFeedPath("/feeds/comments/default")).toBe(true);
    expect(isCommentsFeedPath("/feeds/comments/anything")).toBe(true);
    expect(isOtherFeedPath("/feeds/other/default")).toBe(true);
    expect(isOtherFeedPath("/feeds/other/foo/bar")).toBe(true);
    expect(feedsCommentsOtherRetireResponse("/feeds/posts/default")).toBeNull();
  });

  it.each([
    "https://www.11tik.com/feeds/comments/default",
    "https://www.11tik.com/feeds/comments/anything",
    "https://www.11tik.com/feeds/other/default",
    "https://www.11tik.com/feeds/other/foo",
  ])("%s → 410 Gone", async (url) => {
    await expectRetire410(url, env);
  });

  it("RWF includes /feeds/comments/* and /feeds/other/*", () => {
    expect(wrangler.assets.run_worker_first).toContain("/feeds/comments/*");
    expect(wrangler.assets.run_worker_first).toContain("/feeds/other/*");
    expect(matchesRunWorkerFirst("/feeds/comments/default")).toBe(true);
    expect(matchesRunWorkerFirst("/feeds/other/default")).toBe(true);
  });

  it("post feeds unchanged", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch must not run"));
    const atom = await worker.fetch(new Request("https://www.11tik.com/feeds/posts/default"), env);
    expect(atom.status).toBe(200);
    expect(await atom.text()).toContain("<feed");
    const rss = await worker.fetch(new Request("https://www.11tik.com/feeds/posts/default?alt=rss"), env);
    expect(rss.status).toBe(200);
    expect(await rss.text()).toContain("<rss");
    fetchSpy.mockRestore();
  });

  it("pages feed remains 410", async () => {
    const res = await worker.fetch(new Request("https://www.11tik.com/feeds/pages/default"), env);
    expect(res.status).toBe(410);
    expect(await res.text()).toBe(PAGES_FEED_RETIRE_BODY);
  });
});

describe("Phase 10D — copyright slash normalization", () => {
  const staged = getStagedStaticSite();
  const env = { ASSETS: stagedAssetFetch(staged) };

  it.each([
    ["https://www.11tik.com/copyright/", "https://www.11tik.com/copyright"],
    ["https://www.11tik.com/copyright/?m=1", "https://www.11tik.com/copyright"],
    ["https://www.11tik.com/copyright/?foo=1", "https://www.11tik.com/copyright"],
  ])("%s → 301 → %s", async (url, expected) => {
    const res = await worker.fetch(new Request(url), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(expected);
  });

  it("/copyright → 200 with self canonical", async () => {
    const res = await worker.fetch(new Request("https://www.11tik.com/copyright"), env);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('rel="canonical" href="https://www.11tik.com/copyright"');
    expect(body).not.toContain('id="yte-root"');
    expect(body).toContain("Copyright");
  });
});

describe("Phase 10D — IndexNow and sitemap policy", () => {
  const staged = getStagedStaticSite();

  it("sitemap remains 1095 without /copyright", () => {
    const locs = parseSitemapLocs(readFileSync(join(staged, "sitemap.xml"), "utf8"));
    expect(locs).toHaveLength(1095);
    expect(locs).not.toContain(INDEXNOW_COPYRIGHT_URL);
    expect(locs.some((loc) => loc.includes("sitemap-images"))).toBe(false);
    expect(locs.some((loc) => loc.includes("/feeds/"))).toBe(false);
  });

  it("IndexNow includes /copyright (1096 total)", () => {
    const snap = buildIndexNowSnapshot(staged);
    expect(snap.urlCount).toBe(1096);
    expect(snap.urls[INDEXNOW_COPYRIGHT_URL]).toMatch(/^[a-f0-9]{64}$/);
    expect(snap.urls["https://www.11tik.com/sitemap-images.xml"]).toBeUndefined();
    expect(snap.urls["https://www.11tik.com/feeds/comments/default"]).toBeUndefined();
  });
});

describe("Phase 10D — dead sitemap-images tooling", () => {
  it("google-indexing.mjs no longer references sitemap-images.xml", () => {
    const source = readFileSync(join(process.cwd(), "scripts/google-indexing.mjs"), "utf8");
    expect(source).not.toContain("sitemap-images.xml");
    expect(source).toContain("sitemap.xml");
  });

  it("site.ts no longer exports sitemapImages", () => {
    const source = readFileSync(join(process.cwd(), "src/seo/site.ts"), "utf8");
    expect(source).not.toContain("sitemapImages");
  });
});
