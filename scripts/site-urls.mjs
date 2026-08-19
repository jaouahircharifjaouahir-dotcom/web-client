import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "www.11tik.com";

export const SITE_HOST = HOST;

const STATIC_URLS = [
  "https://www.11tik.com/",
  "https://www.11tik.com/p/about.html",
  "https://www.11tik.com/p/privacy.html",
  "https://www.11tik.com/p/contact.html",
  "https://www.11tik.com/p/embed.html",
];

/** UX-only keyword chips. Do not IndexNow / sitemap these as ranking URLs (doorway risk). */
export function keywordLandingUrls() {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/content/keywordLandings.ts"), "utf8");
  return [...source.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => `https://${HOST}/?k=${match[1]}`);
}

function cleanHostUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.hostname !== HOST || url.searchParams.has("m")) return null;
    // Drop thin query variants from crawl submissions
    if (url.searchParams.has("k") || url.searchParams.has("v") || url.searchParams.has("vimeo") || url.searchParams.has("embed")) {
      return null;
    }
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

function entryUrls(xml) {
  const found = [];
  const re = /<link[^>]*rel=['"]alternate['"][^>]*href=['"]([^'"]+)['"]/gi;
  for (const match of xml.matchAll(re)) {
    const url = cleanHostUrl(match[1]);
    if (url) found.push(url);
  }
  return found;
}

function sitemapUrls(xml) {
  const found = [];
  for (const match of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    const url = cleanHostUrl(match[1].trim());
    if (url) found.push(url);
  }
  return found;
}

export function feedUpdated(xml) {
  return xml.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? "";
}

async function readXml(url) {
  const response = await fetch(url, { headers: { accept: "application/xml,text/xml,application/atom+xml" } });
  if (!response.ok) return "";
  return response.text();
}

export async function collectSiteUrls() {
  const postsXml = await readXml(`https://${HOST}/feeds/posts/default?alt=atom&max-results=150`);
  const pagesXml = await readXml(`https://${HOST}/feeds/pages/default?alt=atom&max-results=50`);
  const sitemapXml = await readXml(`https://${HOST}/sitemap.xml`);
  const urlList = [
    ...new Set([...STATIC_URLS, ...entryUrls(postsXml), ...entryUrls(pagesXml), ...sitemapUrls(sitemapXml)]),
  ].slice(0, 1000);
  return {
    urlList,
    updated: `${feedUpdated(postsXml)}|${feedUpdated(pagesXml)}`,
  };
}
