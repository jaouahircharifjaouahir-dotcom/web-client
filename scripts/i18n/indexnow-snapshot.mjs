/**
 * IndexNow publish snapshot — maps final HTTPS URLs → content hashes for staged HTML.
 * Only published public pages (EN static + ready localized + locale homes).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  collectCanonicalSitemapLocs,
  collectLocaleHomeSitemapLocs,
  INDEXABLE_UTILITY_PATHS,
  loadGuidePostHrefsFromFile,
} from "../../workers/sitemap-canonicals.js";
import { scanPublishability, collectReadyLocaleLocs } from "./publish.mjs";
import { getTargetLocales } from "./target-languages.mjs";

export const INDEXNOW_SNAPSHOT_REL = join("web-client", "i18n", "indexnow-snapshot.json");
export const INDEXNOW_LIVE_SNAPSHOT_URL =
  "https://www.11tik.com/web-client/i18n/indexnow-snapshot.json";

const SITE = "https://www.11tik.com";

/** Indexable legal page — in IndexNow but excluded from sitemap.xml by design. */
export const INDEXNOW_COPYRIGHT_URL = `${SITE}/copyright`;

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function toPosix(p) {
  return String(p || "").split(sep).join("/");
}

/**
 * Map a staged HTML relative path to its final canonical public URL, or null.
 * @param {string} relPosix e.g. "l/ar/2026/08/foo.html"
 */
export function stagedHtmlRelToPublicUrl(relPosix) {
  const rel = toPosix(relPosix).replace(/^\/+/, "");
  if (!rel.endsWith(".html")) return null;
  if (rel === "index.html") return `${SITE}/`;

  if (rel === "copyright/index.html") return INDEXNOW_COPYRIGHT_URL;

  const localeHome = rel.match(/^l\/([a-z]{2})\/index\.html$/i);
  if (localeHome) {
    const code = localeHome[1].toLowerCase();
    return `https://${code}.11tik.com/l/${code}/`;
  }

  const locArticle = rel.match(/^l\/([a-z]{2})\/(2026\/.+|p\/.+)$/i);
  if (locArticle) {
    const code = locArticle[1].toLowerCase();
    const rest = locArticle[2].replace(/\\/g, "/");
    return `https://${code}.11tik.com/l/${code}/${rest}`;
  }

  if (rel.startsWith("2026/") || rel.startsWith("p/")) {
    return `${SITE}/${rel}`;
  }

  return null;
}

function walkHtmlFiles(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip Vite app shell under web-client (noindex / not public content pages).
      if (toPosix(relative(base, full)) === "web-client") continue;
      walkHtmlFiles(full, base, out);
    } else if (name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Allowed public URL set for IndexNow — mirrors intended publication inventory.
 * Locale homes come from sitemap inventory / target locales, NEVER from "file exists".
 * Non-canonical `en.11tik.com/l/en/` is excluded (same as collectLocaleHomeSitemapLocs).
 */
export function collectAllowedPublicUrls(staged, { postsTsPath } = {}) {
  void staged; // staged HTML is hashed later; disk presence alone never expands allowlist
  const allowed = new Set();
  allowed.add(`${SITE}/`);

  // English guides + utilities from sitemap helpers when posts.ts is available.
  try {
    const postsTs =
      postsTsPath && existsSync(postsTsPath)
        ? readFileSync(postsTsPath, "utf8")
        : readFileSync(join(process.cwd(), "src", "content", "posts.ts"), "utf8");
    const hrefs = loadGuidePostHrefsFromFile(postsTs);
    for (const loc of collectCanonicalSitemapLocs({ postHrefs: hrefs })) {
      allowed.add(loc);
    }
  } catch {
    for (const path of INDEXABLE_UTILITY_PATHS) {
      allowed.add(`${SITE}${path}`);
    }
  }

  const ready = collectReadyLocaleLocs(scanPublishability());
  for (const loc of ready) allowed.add(loc);

  // Locale homes: intended public inventory only (sitemap ISO homes ≠ en).
  // Also accept configured target-locale homes (subset of that inventory).
  for (const loc of collectLocaleHomeSitemapLocs()) {
    allowed.add(loc);
  }
  for (const code of getTargetLocales()) {
    if (code === "en") continue;
    allowed.add(`https://${code}.11tik.com/l/${code}/`);
  }

  allowed.add(INDEXNOW_COPYRIGHT_URL);

  return allowed;
}

/**
 * Build { url → contentSha256 } for staged public HTML that maps to an allowed URL.
 */
export function buildIndexNowSnapshot(staged, options = {}) {
  const allowed = options.allowedUrls || collectAllowedPublicUrls(staged, options);
  const urls = {};
  for (const file of walkHtmlFiles(staged)) {
    const rel = toPosix(relative(staged, file));
    const url = stagedHtmlRelToPublicUrl(rel);
    if (!url) continue;
    if (!allowed.has(url)) continue;
    if (!url.startsWith("https://")) continue;
    const body = readFileSync(file, "utf8");
    urls[url] = sha256(body);
  }
  return {
    v: 1,
    generatedAt: new Date().toISOString(),
    urlCount: Object.keys(urls).length,
    urls,
  };
}

/**
 * Diff two snapshots → { added, updated, deleted, unchanged }.
 * URLs to notify = added ∪ updated ∪ deleted (IndexNow covers all three).
 */
export function diffIndexNowSnapshots(previous, next) {
  const prevUrls = previous?.urls || {};
  const nextUrls = next?.urls || {};
  const added = [];
  const updated = [];
  const deleted = [];
  const unchanged = [];

  for (const [url, hash] of Object.entries(nextUrls)) {
    if (!(url in prevUrls)) added.push(url);
    else if (prevUrls[url] !== hash) updated.push(url);
    else unchanged.push(url);
  }
  for (const url of Object.keys(prevUrls)) {
    if (!(url in nextUrls)) deleted.push(url);
  }

  const notify = dedupeUrls([...added, ...updated, ...deleted]);
  return { added, updated, deleted, unchanged, notify };
}

export function dedupeUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    const u = String(raw || "").trim();
    if (!u.startsWith("https://")) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** Group HTTPS URLs by hostname for IndexNow host-scoped batches. */
export function groupUrlsByHost(urls) {
  const map = new Map();
  for (const url of dedupeUrls(urls)) {
    let host;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!map.has(host)) map.set(host, []);
    map.get(host).push(url);
  }
  return map;
}

export function serializeSnapshot(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
