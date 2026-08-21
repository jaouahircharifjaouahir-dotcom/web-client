/**
 * Manual IndexNow submit for Bing and partners. Not scheduled.
 * Google does not use IndexNow. Never run this in the visitor browser.
 *
 * Blogger cannot serve a raw .txt file. After you add a Custom redirect from
 * /{key}.txt to the GitHub raw key file, this job can verify the site.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { collectSiteUrls, SITE_HOST } from "./site-urls.mjs";
import { filterIndexNowUrls } from "./url-quality-gate.mjs";

const KEY = process.env.INDEXNOW_KEY || "9f3a7c1e4b8d2f06a5c9e3b7d1f48a26";
const KEY_LOCATION = `https://${SITE_HOST}/${KEY}.txt`;
const KEY_FILE_RAW = `https://raw.githubusercontent.com/jaouahircharifjaouahir-dotcom/web-client/main/${KEY}.txt`;
const STAMP = process.env.SEARCH_PING_STAMP || ".search-ping-stamp";
const ENDPOINTS = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];

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

function looksLikeHtml(text) {
  return /<!DOCTYPE|<html[\s>]/i.test(text);
}

function printRedirectHelp() {
  console.error(`
IndexNow cannot verify ${KEY_LOCATION}
Blogger is serving HTML, not a plain-text key file.

In Blogger → Settings → Search preferences → Custom redirects:
  From: /${KEY}.txt
  To:   ${KEY_FILE_RAW}
  Type: 302 (keep enabled), then Save

Confirm in a browser that ${KEY_LOCATION}
redirects and shows only:
  ${KEY}

Then re-run the search-ping workflow.
`);
}

async function assertKeyFile() {
  const response = await fetch(KEY_LOCATION, { redirect: "follow" });
  const text = await response.text();
  const type = response.headers.get("content-type") || "";
  const body = text.trim();
  console.log(`Key check ${KEY_LOCATION} → ${response.status} ${type} final=${response.url}`);

  if (looksLikeHtml(text) || !body.startsWith(KEY) || body.includes("<")) {
    printRedirectHelp();
    throw new Error("IndexNow key file is not plain text on www.11tik.com.");
  }
}

const { urlList: collected, updated } = await collectSiteUrls();
const { eligible: urlList, hold } = filterIndexNowUrls(collected);
if (hold.length) {
  console.log(`Quality gate held ${hold.length} URL(s).`);
}
const prev = readState();

if (!submitAll && updated && updated === prev.feedUpdated) {
  console.log("No feed change. Skip. Use --all for a full IndexNow submit.");
  process.exit(0);
}

if (!urlList.length) {
  console.error("No URLs collected.");
  process.exit(1);
}

try {
  await assertKeyFile();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const body = JSON.stringify({
  host: SITE_HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
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
    if (text.includes("UserForbiddedToAccessSite") || text.includes("Keylocation")) {
      printRedirectHelp();
    }
  }
}

if (!ok) {
  console.error("IndexNow rejected every endpoint.");
  process.exit(1);
}

writeFileSync(STAMP, JSON.stringify({ feedUpdated: updated, count: urlList.length, at: Date.now() }, null, 2));
console.log(`Submitted ${urlList.length} URL(s) via IndexNow (Bing/partners, not Google).`);
