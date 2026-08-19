/**
 * Signal search engines after a real publish, at most once per hour.
 * Never call this from the public page on each visitor load.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const MIN_INTERVAL_MS = 60 * 60 * 1000;
const KEY = process.env.INDEXNOW_KEY || "9f3a7c1e4b8d2f06a5c9e3b7d1f48a26";
const HOST = "www.11tik.com";
const STAMP = process.env.SEARCH_PING_STAMP || ".search-ping-stamp";
const URLS = [
  "https://www.11tik.com/",
  "https://www.11tik.com/sitemap.xml",
  "https://www.11tik.com/p/about.html",
  "https://www.11tik.com/p/privacy.html",
  "https://www.11tik.com/p/contact.html",
];

const force = process.argv.includes("--force");

function lastPingMs() {
  if (!existsSync(STAMP)) return 0;
  const n = Number(readFileSync(STAMP, "utf8").trim());
  return Number.isFinite(n) ? n : 0;
}

const now = Date.now();
const elapsed = now - lastPingMs();
if (!force && elapsed < MIN_INTERVAL_MS) {
  const waitMin = Math.ceil((MIN_INTERVAL_MS - elapsed) / 60000);
  console.log(`Skip search ping (${waitMin} min left in the 1-hour cap).`);
  process.exit(0);
}

const body = JSON.stringify({
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList: URLS,
});

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body,
});

const text = await response.text();
if (!response.ok && response.status !== 202) {
  console.error(`IndexNow ${response.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}

writeFileSync(STAMP, String(now));
console.log(`IndexNow accepted (${response.status}). Next ping after 1 hour.`);
