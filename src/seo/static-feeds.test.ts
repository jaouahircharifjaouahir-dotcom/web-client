import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_POSTS } from "../content/posts";
import {
  FEED_POSTS_ATOM_URL,
  FEED_POSTS_PATH,
  FEED_POSTS_RSS_ASSET_PATH,
  FEED_POSTS_RSS_URL,
  FEED_SITE_TITLE,
  buildPostsAtomFeed,
  buildPostsRssFeed,
  loadFeedPostEntries,
  parseGuidePostsFromFile,
} from "../../workers/feed-generation.js";
import { loadGuidePostHrefsFromFile, parseSitemapLocs, SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst } from "./test-helpers/run-worker-first.ts";

const POSTS_TS = readFileSync(join(process.cwd(), "src/content/posts.ts"), "utf8");
const BLOGGER_MARKERS = [/ghs\.googlehosted\.com/i, /schemas\.google\.com\/blogger/i, /blogger\.googleusercontent/i];

function readStagedFeed(relativePath: string) {
  return readFileSync(join(getStagedStaticSite(), relativePath.replace(/^\//, "")), "utf8");
}

function extractAtomEntryLinks(xml: string) {
  return [...xml.matchAll(/<entry>[\s\S]*?<link rel="alternate" type="text\/html" href="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

function extractRssItemLinks(xml: string) {
  return [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((match) => match[1]);
}

function blogPostLocsFromSitemap() {
  const xml = readFileSync(join(getStagedStaticSite(), "sitemap.xml"), "utf8");
  return parseSitemapLocs(xml).filter(
    (loc) => loc.startsWith(`${SITE_ORIGIN}/2026/08/`) && loc.endsWith(".html"),
  );
}

describe("Phase 6A — static posts feeds", () => {
  it("parses authoritative posts.ts fields", () => {
    const parsed = parseGuidePostsFromFile(POSTS_TS);
    expect(parsed).toHaveLength(GUIDE_POSTS.length);
    expect(parsed[0]?.title).toBe(GUIDE_POSTS[0]?.title);
    expect(parsed[0]?.href).toBe(GUIDE_POSTS[0]?.href);
  });

  it("loads feed entries with canonical links and timestamps", () => {
    const entries = loadFeedPostEntries({ postsTsContents: POSTS_TS });
    expect(entries).toHaveLength(GUIDE_POSTS.length);
    for (const entry of entries) {
      expect(entry.link).toMatch(/^https:\/\/www\.11tik\.com\/2026\/08\/[^/?#]+\.html$/);
      expect(entry.link).not.toContain("/index.html");
      expect(entry.published).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(entry.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.summary.length).toBeGreaterThan(0);
    }
  });

  it("builds valid Atom XML without Blogger references", () => {
    const entries = loadFeedPostEntries({ postsTsContents: POSTS_TS });
    const xml = buildPostsAtomFeed(entries);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(`<id>${FEED_POSTS_ATOM_URL}</id>`);
    expect(xml).toContain(`<title type="text">${FEED_SITE_TITLE}</title>`);
    expect(xml).toContain(`<link rel="self" type="application/atom+xml" href="${FEED_POSTS_ATOM_URL}"/>`);
    for (const marker of BLOGGER_MARKERS) {
      expect(xml).not.toMatch(marker);
    }
    const links = extractAtomEntryLinks(xml);
    expect(links).toHaveLength(GUIDE_POSTS.length);
    expect(new Set(links).size).toBe(GUIDE_POSTS.length);
  });

  it("builds valid RSS XML without Blogger references", () => {
    const entries = loadFeedPostEntries({ postsTsContents: POSTS_TS });
    const xml = buildPostsRssFeed(entries);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(`<atom:link href="${FEED_POSTS_RSS_URL}" rel="self"`);
    for (const marker of BLOGGER_MARKERS) {
      expect(xml).not.toMatch(marker);
    }
    const links = extractRssItemLinks(xml);
    expect(links).toHaveLength(GUIDE_POSTS.length);
    expect(new Set(links).size).toBe(GUIDE_POSTS.length);
  });

  it("matches sitemap blog URLs and authoritative inventory count", () => {
    const entries = loadFeedPostEntries({ postsTsContents: POSTS_TS });
    const feedLinks = new Set(entries.map((entry) => entry.link));
    const sitemapBlog = blogPostLocsFromSitemap();
    expect(sitemapBlog).toHaveLength(GUIDE_POSTS.length);
    for (const loc of sitemapBlog) {
      expect(feedLinks.has(loc)).toBe(true);
    }
    const hrefs = loadGuidePostHrefsFromFile(POSTS_TS);
    expect(hrefs).toHaveLength(GUIDE_POSTS.length);
  });

  it("writes staged Atom and RSS sidecar assets at build time", () => {
    const atom = readStagedFeed(FEED_POSTS_PATH);
    const rss = readStagedFeed(FEED_POSTS_RSS_ASSET_PATH);
    expect(atom).toContain(`<id>${FEED_POSTS_ATOM_URL}</id>`);
    expect(rss).toContain(`<atom:link href="${FEED_POSTS_RSS_URL}" rel="self"`);
    expect(extractAtomEntryLinks(atom)).toHaveLength(GUIDE_POSTS.length);
    expect(extractRssItemLinks(rss)).toHaveLength(GUIDE_POSTS.length);
  });

  describe("routing design (Phase 6B)", () => {
    it("uses narrow RWF: pages Worker-first, posts default for query RSS branch", () => {
      expect(matchesRunWorkerFirst("/feeds/pages/default")).toBe(true);
      expect(matchesRunWorkerFirst("/feeds/posts/default")).toBe(true);
      expect(matchesRunWorkerFirst("/feeds/other/default")).toBe(true);
      expect(matchesRunWorkerFirst("/feeds/comments/default")).toBe(true);
      expect(matchesRunWorkerFirst("/sitemap-images.xml")).toBe(true);
    });

    it("documents ?alt=rss: Worker serves static default.rss sidecar", () => {
      const sidecarExists = readStagedFeed(FEED_POSTS_RSS_ASSET_PATH).includes("<rss");
      expect(sidecarExists).toBe(true);
    });
  });

  describe("pages feed /feeds/pages/default", () => {
    it("is retired via Worker 410 (Phase 6E.2); site-urls no longer references it", () => {
      const siteUrlsSource = readFileSync(join(process.cwd(), "scripts/site-urls.mjs"), "utf8");
      expect(siteUrlsSource).not.toContain("/feeds/pages/default");
      expect(siteUrlsSource).not.toContain("collectSiteUrls");
    });
  });
});

describe("Phase 6A — feed metadata availability", () => {
  it("uses fields present in posts.ts and article HTML only", () => {
    const entries = loadFeedPostEntries({ postsTsContents: POSTS_TS });
    for (let i = 0; i < GUIDE_POSTS.length; i++) {
      expect(entries.some((entry) => entry.link === GUIDE_POSTS[i]?.href)).toBe(true);
    }
    expect(`${SITE_ORIGIN}/feeds/posts/default`).toBe(FEED_POSTS_ATOM_URL);
  });
});
