/**
 * Periodically submit all public 11tik URLs to IndexNow (Bing and partners).
 * Google does not use IndexNow. Never run this in the visitor browser.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const KEY = process.env.INDEXNOW_KEY || "9f3a7c1e4b8d2f06a5c9e3b7d1f48a26";
const HOST = "www.11tik.com";
const STAMP = process.env.SEARCH_PING_STAMP || ".search-ping-stamp";
const ENDPOINTS = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];
const STATIC_URLS = [
  "https://www.11tik.com/",
  "https://www.11tik.com/sitemap.xml",
  "https://www.11tik.com/p/about.html",
  "https://www.11tik.com/p/privacy.html",
  "https://www.11tik.com/p/contact.html",
];

const force = process.argv.includes("--force");
const submitAll = process.argv.includes("--all") || force;

function readState() {
  if (!existsSync(STAMP)) return { feedUpdated: "" };
  try {
    return JSON.parse(readFileSync(STAMP, "utf8"));
  } catch {
    return { feedUpdated: "" };
  }
}

function cleanHostUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.hostname !== HOST || url.searchParams.has("m")) return null;
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

function feedUpdated(xml) {
  return xml.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? "";
}

async function readXml(url) {
  const response = await fetch(url, { headers: { accept: "application/xml,text/xml,application/atom+xml" } });
  if (!response.ok) return "";
  return response.text();
}

const postsXml = await readXml(`https://${HOST}/feeds/posts/default?alt=atom&max-results=150`);
const pagesXml = await readXml(`https://${HOST}/feeds/pages/default?alt=atom&max-results=50`);
const sitemapXml = await readXml(`https://${HOST}/sitemap.xml`);
const updated = `${feedUpdated(postsXml)}|${feedUpdated(pagesXml)}`;
const prev = readState();

if (!submitAll && updated && updated === prev.feedUpdated) {
  console.log("No feed change. Skip. Use --all for a full IndexNow submit.");
  process.exit(0);
}

const urlList = [
  ...new Set([
    ...STATIC_URLS,
    ...entryUrls(postsXml),
    ...entryUrls(pagesXml),
    ...sitemapUrls(sitemapXml),
  ]),
].slice(0, 1000);

if (!urlList.length) {
  console.error("No URLs collected.");
  process.exit(1);
}

const body = JSON.stringify({
  host: HOST,
  key: KEY,
  keyLocation: `https://jaouahircharifjaouahir-dotcom.github.io/web-client/${KEY}.txt`,
  urlList,
});

let ok = 0;
for (const endpoint of ENDPOINTS) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body,
  });
  const text = await response.text();
  if (response.ok || response.status === 202) {
    ok += 1;
    console.log(`${endpoint} → ${response.status}`);
  } else {
    console.error(`${endpoint} → ${response.status} ${text.slice(0, 300)}`);
  }
}

if (!ok) {
  console.error("IndexNow rejected every endpoint.");
  process.exit(1);
}

writeFileSync(STAMP, JSON.stringify({ feedUpdated: updated, count: urlList.length, at: Date.now() }, null, 2));
console.log(`Submitted ${urlList.length} URL(s) via IndexNow (Bing/partners, not Google).`);
