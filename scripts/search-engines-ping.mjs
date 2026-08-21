/**
 * Manual IndexNow submit for Bing and partners. Not scheduled.
 * Google does not use IndexNow. Never run this in the visitor browser.
 *
 * FR/ES keys: Blogger API v3 has no IndexNow/settings endpoint.
 * Set INDEXNOW_KEY_FR / INDEXNOW_KEY_ES after each locale blog exists.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { collectSiteUrls, SITE_HOST } from "./site-urls.mjs";
import { filterIndexNowUrls } from "./url-quality-gate.mjs";

const SITES = [
  {
    host: SITE_HOST,
    key: process.env.INDEXNOW_KEY || "9f3a7c1e4b8d2f06a5c9e3b7d1f48a26",
  },
  {
    host: "fr.11tik.com",
    key: process.env.INDEXNOW_KEY_FR || "",
  },
  {
    host: "es.11tik.com",
    key: process.env.INDEXNOW_KEY_ES || "",
  },
];
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

function printRedirectHelp(host, key) {
  const keyLocation = `https://${host}/${key}.txt`;
  const keyFileRaw = `https://raw.githubusercontent.com/jaouahircharifjaouahir-dotcom/web-client/main/${key}.txt`;
  console.error(`
IndexNow cannot verify ${keyLocation}
Blogger is serving HTML, not a plain-text key file.

In Blogger → Settings → Search preferences → Custom redirects:
  From: /${key}.txt
  To:   ${keyFileRaw}
  Type: 302 (keep enabled), then Save
`);
}

async function assertKeyFile(host, key) {
  const keyLocation = `https://${host}/${key}.txt`;
  const response = await fetch(keyLocation, { redirect: "follow" });
  const text = await response.text();
  const type = response.headers.get("content-type") || "";
  const body = text.trim();
  console.log(`Key check ${keyLocation} → ${response.status} ${type} final=${response.url}`);

  if (looksLikeHtml(text) || !body.startsWith(key) || body.includes("<")) {
    printRedirectHelp(host, key);
    throw new Error(`IndexNow key file is not plain text on ${host}.`);
  }
}

function urlsForHost(host, wwwUrls) {
  if (host === SITE_HOST) return wwwUrls;
  return [`https://${host}/`];
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

let acceptedHosts = 0;
for (const site of SITES) {
  if (!site.key) {
    console.log(`Skip ${site.host}: no IndexNow key (Blogger has no API for this; set INDEXNOW_KEY_FR / INDEXNOW_KEY_ES).`);
    continue;
  }
  const hostUrls = urlsForHost(site.host, urlList);
  try {
    await assertKeyFile(site.host, site.key);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    continue;
  }
  const payload = JSON.stringify({
    host: site.host,
    key: site.key,
    keyLocation: `https://${site.host}/${site.key}.txt`,
    urlList: hostUrls,
  });
  let ok = 0;
  for (const endpoint of ENDPOINTS) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: payload,
    });
    const text = await response.text();
    if (response.ok || response.status === 202) {
      ok += 1;
      console.log(`${site.host} ${endpoint} → ${response.status}`);
    } else {
      console.error(`${site.host} ${endpoint} → ${response.status} ${text.slice(0, 300)}`);
      if (text.includes("UserForbiddedToAccessSite") || text.includes("Keylocation")) {
        printRedirectHelp(site.host, site.key);
      }
    }
  }
  if (ok) acceptedHosts += 1;
}

if (!acceptedHosts) {
  console.error("IndexNow rejected every endpoint.");
  process.exit(1);
}

writeFileSync(STAMP, JSON.stringify({ feedUpdated: updated, count: urlList.length, at: Date.now() }, null, 2));
console.log(`IndexNow accepted on ${acceptedHosts} host(s).`);
