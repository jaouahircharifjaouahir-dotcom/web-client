import {
  aiSearchAllowRobotsBlock,
  aiTrainingRobotsBlock,
  contentSignalDirective,
} from "./ai-training-robots.js";

/** Sitemap protocol cap is 50_000 URLs. Stay under so a new file opens before Google rejects the old one. */
export const SITEMAP_PAGE_SIZE = 40000;
export const SITE_ORIGIN = "https://www.11tik.com";

export function chunkEntries(entries, size = SITEMAP_PAGE_SIZE) {
  const pages = [];
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return [[]];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages.length ? pages : [[]];
}

export function urlsetXml(entries) {
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const row of entries) {
    if (!row?.loc) continue;
    const mod = row.lastmod ? `<lastmod>${escapeXml(row.lastmod)}</lastmod>` : "";
    parts.push(`<url><loc>${escapeXml(row.loc)}</loc>${mod}</url>`);
  }
  parts.push("</urlset>");
  return parts.join("");
}

export function sitemapIndexXml(locs, lastmod) {
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const loc of locs) {
    const mod = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
    parts.push(`<sitemap><loc>${escapeXml(loc)}</loc>${mod}</sitemap>`);
  }
  parts.push("</sitemapindex>");
  return parts.join("");
}

export function originFromHost(_host) {
  return SITE_ORIGIN;
}

export function rewriteLoc(loc, _origin = SITE_ORIGIN) {
  const href = migrateExtractLoc(String(loc || ""));
  return href
    .replace(/^https?:\/\/(?:[a-z0-9-]+\.)?11tik\.com/i, SITE_ORIGIN)
    .replace("http://www.11tik.com", SITE_ORIGIN);
}

function migrateExtractLoc(loc) {
  try {
    const url = new URL(loc);
    const youtube = url.searchParams.get("v");
    if (youtube && /^[A-Za-z0-9_-]{11}$/.test(youtube)) return `${url.origin}/thumb/${youtube}`;
    return loc;
  } catch {
    return loc;
  }
}

export function childSitemapUrls(kind, count, origin = SITE_ORIGIN) {
  const prefix = kind === "images" ? "sitemap-images" : "sitemap";
  const n = Math.max(1, count);
  const urls = [];
  for (let i = 1; i <= n; i += 1) urls.push(`${origin}/${prefix}-${i}.xml`);
  return urls;
}

export function allPublicSitemapUrls(urlShards = 1, imageShards = 1, origin = SITE_ORIGIN) {
  // Single canonical page sitemap only (https). Do not also list sitemap-pages.xml —
  // it duplicates /p/* locs and Ahrefs flags "page in multiple sitemaps".
  const urls = [`${origin}/sitemap.xml`];
  if (imageShards >= 1) urls.push(`${origin}/image-sitemap.xml`);
  if (urlShards > 1) urls.push(...childSitemapUrls("pages", urlShards, origin));
  if (imageShards > 1) {
    urls.push(`${origin}/sitemap-images.xml`, ...childSitemapUrls("images", imageShards, origin));
  }
  return urls;
}

export function robotsTxt({ urlShards = 1, imageShards = 1 } = {}) {
  const sitemaps = [...new Set(allPublicSitemapUrls(urlShards, imageShards, SITE_ORIGIN))];
  const sitemapLines = sitemaps.map((loc) => `Sitemap: ${loc}`).join("\n");
  return `# 11tik robots.txt
# https://www.11tik.com/
# Clear crawl rules for the YouTube Thumbnail Extractor.
# New sitemap files are listed here automatically when a file fills up.

${aiTrainingRobotsBlock()}
${aiSearchAllowRobotsBlock()}
User-agent: Googlebot
Allow: /
Disallow: /search
Disallow: /search?
Disallow: /hold-queue
Disallow: /web-client/hold-queue.json
Disallow: /web-client/__extracts.json

User-agent: Googlebot-Image
Allow: /

User-agent: Googlebot-Video
Allow: /

User-agent: Bingbot
Allow: /
Disallow: /search
Disallow: /search?
Disallow: /hold-queue
Disallow: /web-client/hold-queue.json

User-agent: *
${contentSignalDirective()}
Allow: /
Disallow: /search
Disallow: /search?
Disallow: /hold-queue
Disallow: /web-client/hold-queue.json
Disallow: /web-client/__extracts.json

Host: www.11tik.com

${sitemapLines}
`;
}

export function localeHostRobotsTxt() {
  return `# Language hosts are UI only. Index https://www.11tik.com/
User-agent: *
Disallow: /

Host: www.11tik.com
Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

export function parseSitemapPath(pathname) {
  if (pathname === "/sitemap.xml") return { kind: "pages", role: "index" };
  if (pathname === "/sitemap-images.xml" || pathname === "/image-sitemap.xml") {
    return { kind: "images", role: pathname === "/image-sitemap.xml" ? "legacy" : "index" };
  }
  const pages = /^\/sitemap-(\d+)\.xml$/.exec(pathname);
  if (pages) return { kind: "pages", role: "page", page: Number(pages[1]) };
  const images = /^\/sitemap-images-(\d+)\.xml$/.exec(pathname);
  if (images) return { kind: "images", role: "page", page: Number(images[1]) };
  return null;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
