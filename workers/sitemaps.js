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

export function childSitemapUrls(kind, count) {
  const prefix = kind === "images" ? "sitemap-images" : "sitemap";
  const n = Math.max(1, count);
  const urls = [];
  for (let i = 1; i <= n; i += 1) urls.push(`${SITE_ORIGIN}/${prefix}-${i}.xml`);
  return urls;
}

export function allPublicSitemapUrls(urlShards = 1, imageShards = 1) {
  const urls = [`${SITE_ORIGIN}/sitemap.xml`, `${SITE_ORIGIN}/image-sitemap.xml`, `${SITE_ORIGIN}/sitemap-pages.xml`];
  if (urlShards > 1) urls.push(...childSitemapUrls("pages", urlShards));
  if (imageShards > 1) {
    urls.push(`${SITE_ORIGIN}/sitemap-images.xml`, ...childSitemapUrls("images", imageShards));
  }
  return urls;
}

export function robotsTxt({ urlShards = 1, imageShards = 1, host = "www.11tik.com" } = {}) {
  const sitemaps = [...new Set(allPublicSitemapUrls(urlShards, imageShards))];
  const sitemapLines = sitemaps.map((loc) => `Sitemap: ${loc}`).join("\n");
  return `# 11tik robots.txt
# https://www.11tik.com/
# Clear crawl rules for the YouTube Thumbnail Extractor.
# New sitemap files are listed here automatically when a file fills up.

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
Allow: /
Disallow: /search
Disallow: /search?
Disallow: /hold-queue
Disallow: /web-client/hold-queue.json
Disallow: /web-client/__extracts.json

Host: ${host}

${sitemapLines}
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
