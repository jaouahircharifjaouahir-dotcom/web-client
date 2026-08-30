import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GUIDE_POSTS } from "../content/posts";
import worker from "../../workers/11tik-edge.js";
import {
  FEED_ATOM_CONTENT_TYPE,
  FEED_POSTS_ATOM_ASSET,
  FEED_POSTS_PATH,
  FEED_POSTS_RSS_ASSET,
  FEED_RSS_CONTENT_TYPE,
  handlePostsFeedRequest,
  isPostsFeedPath,
  postsFeedAssetPath,
  postsFeedContentType,
  resolvePostsFeedVariant,
} from "../../workers/posts-feed.js";
import {
  FEED_POSTS_ATOM_URL,
  FEED_POSTS_RSS_ASSET_PATH,
  FEED_POSTS_RSS_URL,
} from "../../workers/feed-generation.js";
import { parseSitemapLocs, SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst, readWranglerConfig } from "./test-helpers/run-worker-first.ts";

const BLOGGER_MARKERS = [/ghs\.googlehosted\.com/i, /schemas\.google\.com\/blogger/i, /blogger\.googleusercontent/i];

function stagedAssetFetch(staged: string) {
  return {
    fetch(req: Request) {
      const path = new URL(req.url).pathname.replace(/^\//, "");
      const file = join(staged, path);
      const body = readFileSync(file, "utf8");
      return Promise.resolve(new Response(body, { status: 200 }));
    },
  };
}

function extractAtomEntryLinks(xml: string) {
  return [...xml.matchAll(/<entry>[\s\S]*?<link rel="alternate" type="text\/html" href="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

function extractRssItemLinks(xml: string) {
  return [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((match) => match[1]);
}

describe("posts-feed variant resolution", () => {
  it("resolves query combinations per Phase 6B spec", () => {
    expect(resolvePostsFeedVariant(new URLSearchParams(""))).toBe("atom");
    expect(resolvePostsFeedVariant(new URLSearchParams("alt=rss"))).toBe("rss");
    expect(resolvePostsFeedVariant(new URLSearchParams("alt=RSS"))).toBe("atom");
    expect(resolvePostsFeedVariant(new URLSearchParams("foo=1"))).toBe("atom");
    expect(resolvePostsFeedVariant(new URLSearchParams("alt=rss&foo=1"))).toBe("rss");
    expect(resolvePostsFeedVariant(new URLSearchParams("alt=atom&max-results=150"))).toBe("atom");
  });

  it("maps variants to static asset paths and content types", () => {
    expect(postsFeedAssetPath("atom")).toBe(FEED_POSTS_ATOM_ASSET);
    expect(postsFeedAssetPath("rss")).toBe(FEED_POSTS_RSS_ASSET);
    expect(postsFeedContentType("atom")).toBe(FEED_ATOM_CONTENT_TYPE);
    expect(postsFeedContentType("rss")).toBe(FEED_RSS_CONTENT_TYPE);
  });
});

describe("Phase 6B — posts feed routing", () => {
  const wrangler = readWranglerConfig();
  const staged = getStagedStaticSite();

  it("narrows RWF from /feeds/* to pages + posts default only", () => {
    expect(wrangler.assets.run_worker_first).not.toContain("/feeds/*");
    expect(wrangler.assets.run_worker_first).toContain("/feeds/pages/*");
    expect(wrangler.assets.run_worker_first).toContain("/feeds/posts/default");
    expect(matchesRunWorkerFirst("/feeds/pages/default")).toBe(true);
    expect(matchesRunWorkerFirst("/feeds/posts/default")).toBe(true);
    expect(matchesRunWorkerFirst("/feeds/other/default")).toBe(false);
  });

  it("confirms staged static feed assets exist with 18 entries each", () => {
    const atom = readFileSync(join(staged, "feeds/posts/default"), "utf8");
    const rss = readFileSync(join(staged, "feeds/posts/default.rss"), "utf8");
    expect(atom.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(extractAtomEntryLinks(atom)).toHaveLength(18);
    expect(extractRssItemLinks(rss)).toHaveLength(18);
    for (const marker of BLOGGER_MARKERS) {
      expect(atom).not.toMatch(marker);
      expect(rss).not.toMatch(marker);
    }
    const sitemapBlog = parseSitemapLocs(readFileSync(join(staged, "sitemap.xml"), "utf8")).filter((loc) =>
      loc.startsWith(`${SITE_ORIGIN}/2026/08/`),
    );
    expect(sitemapBlog).toHaveLength(GUIDE_POSTS.length);
    for (const loc of sitemapBlog) {
      expect(extractAtomEntryLinks(atom)).toContain(loc);
      expect(extractRssItemLinks(rss)).toContain(loc);
    }
  });

  it("serves clean Atom via static asset passthrough (no Blogger)", async () => {
    const url = new URL(FEED_POSTS_ATOM_URL);
    const res = await handlePostsFeedRequest(url, { ASSETS: stagedAssetFetch(staged) });
    expect(res?.status).toBe(200);
    const body = await res!.text();
    expect(res?.headers.get("content-type")).toBe(FEED_ATOM_CONTENT_TYPE);
    expect(body).toContain(`<id>${FEED_POSTS_ATOM_URL}</id>`);
    expect(body).not.toMatch(BLOGGER_MARKERS[0]);
    expect(extractAtomEntryLinks(body)).toHaveLength(18);
  });

  it("serves RSS for ?alt=rss with RSS content type (no Blogger)", async () => {
    const url = new URL(FEED_POSTS_RSS_URL);
    const res = await handlePostsFeedRequest(url, { ASSETS: stagedAssetFetch(staged) });
    expect(res?.status).toBe(200);
    const body = await res!.text();
    expect(res?.headers.get("content-type")).toBe(FEED_RSS_CONTENT_TYPE);
    expect(body).toContain("<rss");
    expect(body).toContain(`href="${FEED_POSTS_RSS_URL}"`);
    expect(extractRssItemLinks(body)).toHaveLength(18);
  });

  it("never calls global fetch (fetchBlogger) for post feed variants", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const env = { ASSETS: stagedAssetFetch(staged) };

    await handlePostsFeedRequest(new URL(FEED_POSTS_ATOM_URL), env);
    await handlePostsFeedRequest(new URL(FEED_POSTS_RSS_URL), env);
    await handlePostsFeedRequest(new URL(`${FEED_POSTS_ATOM_URL}?alt=RSS`), env);
    await handlePostsFeedRequest(new URL(`${FEED_POSTS_ATOM_URL}?foo=1`), env);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("worker fetch routes post feeds before Blogger and never fetches Blogger", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetchBlogger must not run"));
    const env = { ASSETS: stagedAssetFetch(staged) };

    const atomRes = await worker.fetch(new Request(FEED_POSTS_ATOM_URL), env);
    expect(atomRes.status).toBe(200);
    expect(atomRes.headers.get("content-type")).toBe(FEED_ATOM_CONTENT_TYPE);
    expect(await atomRes.text()).toContain("<feed");

    const rssRes = await worker.fetch(new Request(FEED_POSTS_RSS_URL), env);
    expect(rssRes.status).toBe(200);
    expect(rssRes.headers.get("content-type")).toBe(FEED_RSS_CONTENT_TYPE);
    expect(await rssRes.text()).toContain("<rss");

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("documents query safety outcomes", async () => {
    const env = { ASSETS: stagedAssetFetch(staged) };
    const cases = [
      { url: FEED_POSTS_RSS_URL, variant: "rss", type: FEED_RSS_CONTENT_TYPE },
      { url: `${FEED_POSTS_ATOM_URL}?alt=RSS`, variant: "atom", type: FEED_ATOM_CONTENT_TYPE },
      { url: `${FEED_POSTS_ATOM_URL}?foo=1`, variant: "atom", type: FEED_ATOM_CONTENT_TYPE },
      { url: `${FEED_POSTS_ATOM_URL}?alt=rss&foo=1`, variant: "rss", type: FEED_RSS_CONTENT_TYPE },
    ] as const;

    for (const testCase of cases) {
      const res = await handlePostsFeedRequest(new URL(testCase.url), env);
      const body = await res!.text();
      expect(res?.headers.get("content-type"), testCase.url).toBe(testCase.type);
      if (testCase.variant === "rss") expect(body).toContain("<rss");
      else expect(body).toContain("<feed");
    }
  });

  it("keeps Blogger paths on isPostsFeedPath exclusion", () => {
    expect(isPostsFeedPath(FEED_POSTS_PATH)).toBe(true);
    expect(isPostsFeedPath("/feeds/pages/default")).toBe(false);
  });

  it("does not add feed URLs to sitemap", () => {
    const locs = parseSitemapLocs(readFileSync(join(staged, "sitemap.xml"), "utf8"));
    expect(locs.some((loc) => loc.includes("/feeds/"))).toBe(false);
  });

  it("documents _headers sidecar path for RSS asset", () => {
    expect(FEED_POSTS_RSS_ASSET_PATH).toBe("/feeds/posts/default.rss");
    expect(readFileSync(join(staged, "feeds/posts/default.rss"), "utf8")).toContain("<rss");
  });
});

describe("Phase 6B — feed regression (RWF unchanged for non-post paths)", () => {
  it("preserves Worker-first for remaining Blogger routes", () => {
    expect(matchesRunWorkerFirst("/feeds/pages/default")).toBe(true);
    expect(matchesRunWorkerFirst("/search")).toBe(true);
    expect(matchesRunWorkerFirst("/search/label/foo")).toBe(true);
    expect(matchesRunWorkerFirst("/sitemap-pages.xml")).toBe(true);
    expect(matchesRunWorkerFirst("/p/about.html")).toBe(false);
    expect(matchesRunWorkerFirst("/l/fr/")).toBe(true);
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(false);
    expect(matchesRunWorkerFirst("/robots.txt")).toBe(false);
    expect(matchesRunWorkerFirst("/sitemap.xml")).toBe(false);
  });
});
