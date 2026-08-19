/**
 * WordPress-style IndexNow: ping when the Blogger feed shows a new or edited post.
 * Google does not consume IndexNow. Never run this in the visitor browser.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const KEY = process.env.INDEXNOW_KEY || "9f3a7c1e4b8d2f06a5c9e3b7d1f48a26";
const HOST = "www.11tik.com";
const STAMP = process.env.SEARCH_PING_STAMP || ".search-ping-stamp";
const FEED = "https://www.11tik.com/feeds/posts/default?alt=atom&max-results=25";
const ENDPOINTS = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];

const force = process.argv.includes("--force");

function readState() {
  if (!existsSync(STAMP)) return { feedUpdated: "", urls: [] };
  try {
    return JSON.parse(readFileSync(STAMP, "utf8"));
  } catch {
    return { feedUpdated: "", urls: [] };
  }
}

function feedUpdated(xml) {
  const match = xml.match(/<updated>([^<]+)<\/updated>/);
  return match?.[1] ?? "";
}

function entryUrls(xml) {
  const found = new Set();
  const re = /<link[^>]*rel=['"]alternate['"][^>]*href=['"]([^'"]+)['"]/gi;
  for (const match of xml.matchAll(re)) {
    try {
      const url = new URL(match[1]);
      if (url.hostname === HOST && !url.searchParams.has("m")) {
        url.hash = "";
        found.add(url.toString());
      }
    } catch {
      /* skip */
    }
  }
  return [...found];
}

const feedResponse = await fetch(FEED, { headers: { accept: "application/atom+xml,application/xml,text/xml" } });
if (!feedResponse.ok) {
  console.error(`Feed ${feedResponse.status}`);
  process.exit(1);
}
const xml = await feedResponse.text();
const updated = feedUpdated(xml);
const posts = entryUrls(xml);
const prev = readState();

if (!force && updated && updated === prev.feedUpdated) {
  console.log("No new or edited Blogger posts. Skip IndexNow.");
  process.exit(0);
}

const urlList = [...new Set(["https://www.11tik.com/", ...posts])].slice(0, 10);
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

writeFileSync(STAMP, JSON.stringify({ feedUpdated: updated, urls: urlList, at: Date.now() }, null, 2));
console.log(`Submitted ${urlList.length} URL(s).`);
