/**
 * Local-only Google Indexing API notify. Do not commit the service-account JSON.
 * Reads every <loc> from https://www.11tik.com/sitemap.xml (and sitemap-pages.xml)
 * and notifies Google Indexing API. Local only.
 *
 *   set GOOGLE_INDEXING_JSON=C:\Users\ADMIN\Desktop\secrets\google-indexing.json
 *   npm run google:index
 *   npm run google:index -- --url https://www.11tik.com/
 */
import { createSign } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SITEMAP_URLS = [
  "https://www.11tik.com/sitemap.xml",
  "https://www.11tik.com/sitemap-images.xml",
  "https://www.11tik.com/sitemap-pages.xml",
];

const DEFAULT_JSON = join(homedir(), "Desktop", "secrets", "google-indexing.json");
const jsonPath = process.env.GOOGLE_INDEXING_JSON || DEFAULT_JSON;
const urlFlag = process.argv.indexOf("--url");
const oneUrl = urlFlag >= 0 ? process.argv[urlFlag + 1] : "";

if (!existsSync(jsonPath)) {
  console.error(`Missing credentials file:\n${jsonPath}\nCopy your Google JSON there (not into git).`);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(jsonPath, "utf8"));
if (!sa.client_email || !sa.private_key) {
  console.error("JSON is not a Google service account key (need client_email and private_key).");
  process.exit(1);
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const jwt = `${unsigned}.${sign.sign(sa.private_key, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Token failed: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data.access_token;
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function locsFromXml(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => decodeXml(match[1].trim()));
}

async function fetchXml(url) {
  const response = await fetch(url, { headers: { accept: "application/xml,text/xml,*/*" } });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}

async function collectSitemapUrls() {
  const seen = new Set();
  const queue = [...SITEMAP_URLS];
  while (queue.length) {
    const sitemapUrl = queue.shift();
    let xml;
    try {
      xml = await fetchXml(sitemapUrl);
    } catch (error) {
      console.warn(`Skip ${sitemapUrl}: ${error.message}`);
      continue;
    }
    const locs = locsFromXml(xml);
    const isIndex = /<sitemapindex[\s>]/i.test(xml);
    for (const loc of locs) {
      let host = "";
      try {
        host = new URL(loc).hostname;
      } catch {
        continue;
      }
      if (host !== "11tik.com" && !host.endsWith(".11tik.com")) continue;
      if (isIndex) {
        if (!queue.includes(loc) && loc !== sitemapUrl) queue.push(loc);
        continue;
      }
      seen.add(loc);
    }
  }
  return [...seen].sort((a, b) => {
    const aw = a.includes("://www.11tik.com") ? 0 : 1;
    const bw = b.includes("://www.11tik.com") ? 0 : 1;
    return aw - bw || a.localeCompare(b);
  });
}

async function notify(token, url) {
  const response = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  const text = await response.text();
  return { status: response.status, text: text.slice(0, 400) };
}

const urlList = oneUrl ? [oneUrl] : await collectSitemapUrls();
if (!urlList.length) {
  console.error("No URLs found in sitemap.xml.");
  process.exit(1);
}

const token = await accessToken();
let ok = 0;
const dailyCap = 200;
const batch = urlList.slice(0, dailyCap);

console.log(`Using ${sa.client_email}`);
console.log(`Sitemap URLs: ${urlList.length}. Submitting ${batch.length} (Google Indexing API daily cap ${dailyCap}).`);
if (urlList.length > dailyCap) {
  console.warn(`${urlList.length - dailyCap} URL(s) left for a later run after quota resets.`);
}

for (const url of batch) {
  const result = await notify(token, url);
  if (result.status >= 200 && result.status < 300) {
    ok += 1;
    console.log(`OK ${result.status} ${url}`);
  } else {
    console.error(`FAIL ${result.status} ${url}\n${result.text}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.log(`Done: ${ok}/${batch.length} accepted.`);
if (!ok) process.exit(1);
