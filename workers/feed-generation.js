/**
 * Build-time Atom/RSS feeds for /feeds/posts/default from src/content/posts.ts.
 * Canonical post URLs match workers/sitemap-canonicals.js (GUIDE_POSTS hrefs).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractStructuredSource } from "../scripts/i18n/extract-source.mjs";
import {
  buildContentInventory,
  resolveArticleSourceRel,
} from "../scripts/i18n/content-inventory.mjs";
import { loadGuidePostHrefsFromFile, normalizeSitemapLoc, SITE_ORIGIN } from "./sitemap-canonicals.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const FEED_POSTS_PATH = "/feeds/posts/default";
export const FEED_POSTS_ATOM_URL = `${SITE_ORIGIN}${FEED_POSTS_PATH}`;
export const FEED_POSTS_RSS_URL = `${FEED_POSTS_ATOM_URL}?alt=rss`;
/** Static asset path for RSS body (?alt=rss cannot be a filename). */
export const FEED_POSTS_RSS_ASSET_PATH = "/feeds/posts/default.rss";

export const FEED_SITE_TITLE = "11tik";
export const FEED_SITE_HOME = `${SITE_ORIGIN}/`;
export const FEED_AUTHOR_NAME = "11tik";
export const FEED_AUTHOR_URI = `${SITE_ORIGIN}/about`;

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function unescapePostsTsString(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/** Parse GUIDE_POSTS title/summary/href from posts.ts without importing TS. */
export function parseGuidePostsFromFile(contents) {
  const posts = [];
  const blockRe =
    /\{\s*title:\s*"((?:\\.|[^"\\])*)"\s*,\s*href:\s*"((?:\\.|[^"\\])*)"\s*,\s*summary:\s*"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = blockRe.exec(String(contents || "")))) {
    posts.push({
      title: unescapePostsTsString(match[1]),
      href: unescapePostsTsString(match[2]),
      summary: unescapePostsTsString(match[3]),
    });
  }
  return posts;
}

function contentIdFromPathname(pathname) {
  const base = String(pathname || "")
    .replace(/\/+$/, "")
    .split("/")
    .pop();
  return base.replace(/\.html$/i, "");
}

function readArticleSourceHtml(contentId, canonicalPath, rootDir = ROOT) {
  const rel =
    resolveArticleSourceRel(contentId, canonicalPath) ||
    `docs/blogger-pages/blog/${contentId}.html`;
  const abs = join(rootDir, rel);
  if (!existsSync(abs)) {
    throw new Error(`Feed source HTML missing for ${canonicalPath}: ${rel}`);
  }
  return readFileSync(abs, "utf8");
}

function toAtomTimestamp(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`Invalid feed timestamp: ${raw}`);
  return new Date(parsed).toISOString();
}

function toRssPubDate(raw) {
  const iso = toAtomTimestamp(raw);
  return new Date(iso).toUTCString();
}

function compareEntriesNewestFirst(a, b) {
  const pubA = Date.parse(a.published);
  const pubB = Date.parse(b.published);
  if (pubB !== pubA) return pubB - pubA;
  const modA = Date.parse(a.updated);
  const modB = Date.parse(b.updated);
  if (modB !== modA) return modB - modA;
  return a.link.localeCompare(b.link);
}

/**
 * @param {{ postsTsContents?: string, rootDir?: string, readSource?: (contentId: string, path: string) => string }} [options]
 */
export function loadFeedPostEntries(options = {}) {
  const rootDir = options.rootDir ?? ROOT;
  const postsTs =
    options.postsTsContents ?? readFileSync(join(rootDir, "src", "content", "posts.ts"), "utf8");
  const parsed = parseGuidePostsFromFile(postsTs);
  const hrefs = loadGuidePostHrefsFromFile(postsTs);
  if (parsed.length !== hrefs.length) {
    throw new Error(`Feed posts.ts parse count (${parsed.length}) != href count (${hrefs.length})`);
  }

  const entries = [];
  for (const post of parsed) {
    const link = normalizeSitemapLoc(post.href);
    if (!link) throw new Error(`Invalid feed post href: ${post.href}`);
    const pathname = new URL(link).pathname;
    const contentId = contentIdFromPathname(pathname);
    const readSource =
      options.readSource ??
      ((id, path) => readArticleSourceHtml(id, path, rootDir));
    const html = readSource(contentId, pathname);
    const structured = extractStructuredSource(html, { contentType: "article" });
    const published = toAtomTimestamp(structured.datePublished);
    const updated = toAtomTimestamp(structured.dateModified || structured.datePublished);
    if (!published || !updated) {
      throw new Error(`Missing published/updated date for feed entry: ${link}`);
    }
    entries.push({
      id: link,
      link,
      title: post.title,
      summary: post.summary || structured.description || "",
      published,
      updated,
    });
  }

  entries.sort(compareEntriesNewestFirst);
  return entries;
}

function feedUpdatedTimestamp(entries) {
  if (!entries.length) return new Date(0).toISOString();
  return entries.reduce((max, entry) => {
    const candidate = entry.updated || entry.published;
    return candidate > max ? candidate : max;
  }, entries[0].updated);
}

export function buildPostsAtomFeed(entries, options = {}) {
  const feedId = options.feedId ?? FEED_POSTS_ATOM_URL;
  const feedTitle = options.feedTitle ?? FEED_SITE_TITLE;
  const feedUpdated = options.feedUpdated ?? feedUpdatedTimestamp(entries);
  const entryXml = entries
    .map(
      (entry) => `  <entry>
    <id>${xmlEscape(entry.id)}</id>
    <published>${xmlEscape(entry.published)}</published>
    <updated>${xmlEscape(entry.updated)}</updated>
    <title type="html">${xmlEscape(entry.title)}</title>
    <link rel="alternate" type="text/html" href="${xmlEscape(entry.link)}"/>
    <author>
      <name>${xmlEscape(FEED_AUTHOR_NAME)}</name>
      <uri>${xmlEscape(FEED_AUTHOR_URI)}</uri>
    </author>
    <summary type="html">${xmlEscape(entry.summary)}</summary>
  </entry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${xmlEscape(feedId)}</id>
  <title type="text">${xmlEscape(feedTitle)}</title>
  <link rel="alternate" type="text/html" href="${xmlEscape(FEED_SITE_HOME)}"/>
  <link rel="self" type="application/atom+xml" href="${xmlEscape(feedId)}"/>
  <updated>${xmlEscape(feedUpdated)}</updated>
  <author>
    <name>${xmlEscape(FEED_AUTHOR_NAME)}</name>
    <uri>${xmlEscape(FEED_AUTHOR_URI)}</uri>
  </author>
${entryXml}
</feed>
`;
}

export function buildPostsRssFeed(entries, options = {}) {
  const feedTitle = options.feedTitle ?? FEED_SITE_TITLE;
  const feedLink = options.feedLink ?? FEED_SITE_HOME;
  const feedSelf = options.feedSelf ?? FEED_POSTS_RSS_URL;
  const channelDescription =
    options.channelDescription ??
    "Free in-browser YouTube Thumbnail Extractor guides and updates from 11tik.";
  const itemXml = entries
    .map(
      (entry) => `    <item>
      <title>${xmlEscape(entry.title)}</title>
      <link>${xmlEscape(entry.link)}</link>
      <guid isPermaLink="true">${xmlEscape(entry.link)}</guid>
      <pubDate>${xmlEscape(toRssPubDate(entry.published))}</pubDate>
      <description>${xmlEscape(entry.summary)}</description>
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(feedTitle)}</title>
    <link>${xmlEscape(feedLink)}</link>
    <description>${xmlEscape(channelDescription)}</description>
    <atom:link href="${xmlEscape(feedSelf)}" rel="self" type="application/rss+xml"/>
${itemXml}
  </channel>
</rss>
`;
}

/**
 * Write Atom + RSS sidecar under staged dist-assets.
 * @param {(path: string, contents: string) => void} writeFile
 * @param {string} staged
 * @param {{ inventory?: ReturnType<typeof buildContentInventory> }} [options]
 */
export function writePostsFeeds(writeFile, staged, options = {}) {
  void options.inventory ?? buildContentInventory();
  const entries = loadFeedPostEntries();
  const atom = buildPostsAtomFeed(entries);
  const rss = buildPostsRssFeed(entries);
  writeFile(join(staged, "feeds", "posts", "default"), atom);
  writeFile(join(staged, "feeds", "posts", "default.rss"), rss);
  return { entryCount: entries.length, atom, rss };
}
