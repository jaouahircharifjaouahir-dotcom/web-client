/**
 * Canonical URL inventory for the static production sitemap (www.11tik.com/sitemap.xml).
 *
 * Blog posts: hrefs from src/content/posts.ts (GUIDE_POSTS) — not POST_DESCRIPTIONS.
 * Utilities: explicit allowlist only.
 * Locale homes: every ISO 639-1 SPA shell https://{xx}.11tik.com/l/{xx}/ (xx ≠ en).
 * Locale articles: ready publishable translations only.
 * Metadata (POST_DESCRIPTIONS) is independent and must never drive sitemap locs.
 */

import { ISO6391 } from "./iso6391.js";
import { INDEXABLE_UTILITY_CLEAN_PATHS, INDEXABLE_UTILITY_IDS, enLegacyPagePath } from "./clean-url-paths.js";

export const SITE_ORIGIN = "https://www.11tik.com";

/** Indexable utility pages at final clean public paths. */
export const INDEXABLE_UTILITY_PATHS = INDEXABLE_UTILITY_CLEAN_PATHS;

/** Legacy /p/*.html paths still allowed through the /p/* Worker handler. */
export const LEGACY_INDEXABLE_UTILITY_PATHS = Object.freeze(
  INDEXABLE_UTILITY_IDS.map((id) => enLegacyPagePath(id)),
);

/**
 * Legacy /p/ guide paths that may still exist in POST_DESCRIPTIONS for meta polishing
 * but must never appear in sitemap.xml (they 404; canonicals are clean /{slug}).
 */
export const LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP = Object.freeze([
  "/p/how-to-download-youtube-thumbnail.html",
  "/p/youtube-thumbnail-url.html",
  "/p/youtube-thumbnail-size.html",
  "/p/youtube-shorts-thumbnail.html",
]);

/**
 * Legacy /p/ URLs → final clean destinations (301 via Worker atomic map + _redirects).
 * Targets verified against GUIDE_POSTS hrefs in src/content/posts.ts.
 */
export const LEGACY_P_REDIRECTS = Object.freeze([
  {
    from: "/p/how-to-download-youtube-thumbnail",
    to: "/how-to-download-youtube-thumbnail",
  },
  {
    from: "/p/how-to-download-youtube-thumbnail.html",
    to: "/how-to-download-youtube-thumbnail",
  },
  { from: "/p/youtube-thumbnail-url", to: "/youtube-thumbnail-url" },
  { from: "/p/youtube-thumbnail-url.html", to: "/youtube-thumbnail-url" },
  {
    from: "/p/youtube-thumbnail-size",
    to: "/youtube-thumbnail-size-resolution",
  },
  {
    from: "/p/youtube-thumbnail-size.html",
    to: "/youtube-thumbnail-size-resolution",
  },
  {
    from: "/p/youtube-shorts-thumbnail",
    to: "/youtube-shorts-thumbnail-download",
  },
  {
    from: "/p/youtube-shorts-thumbnail.html",
    to: "/youtube-shorts-thumbnail-download",
  },
  { from: "/p/youtube-thumbnail-extractor", to: "/" },
  { from: "/p/youtube-thumbnail-extractor.html", to: "/" },
  { from: "/p/copyright.html", to: "/copyright" },
]);

/** Paths allowed through the unknown-/p/* edge 404 rule (utilities + legacy redirect sources). */
export function collectPAllowlistPaths() {
  const paths = new Set();
  for (const utility of LEGACY_INDEXABLE_UTILITY_PATHS) {
    paths.add(utility);
    paths.add(utility.replace(/\.html$/i, ""));
  }
  for (const { from } of LEGACY_P_REDIRECTS) {
    paths.add(from);
  }
  return [...paths].sort();
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Normalize a candidate URL to an absolute www.11tik.com loc, or return null if invalid.
 */
export function normalizeSitemapLoc(raw, siteOrigin = SITE_ORIGIN) {
  try {
    const url = new URL(String(raw || ""), siteOrigin);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "www.11tik.com") return null;
    if (url.search || url.hash) return null;
    let path = url.pathname.replace(/\/+$/, "") || "/";
    if (path !== "/" && !path.startsWith("/")) return null;
    return path === "/" ? `${siteOrigin}/` : `${siteOrigin}${path}`;
  } catch {
    return null;
  }
}

/**
 * Load canonical blog hrefs from the authoritative posts.ts source file.
 */
export function loadGuidePostHrefsFromFile(fileContents) {
  const hrefs = [...String(fileContents || "").matchAll(/href:\s*"(https:\/\/www\.11tik\.com\/[^"?#]+)"/g)].map(
    (match) => match[1],
  );
  return hrefs;
}

/**
 * Build the deduped, sorted list of sitemap locs.
 * @param {{ postHrefs?: string[], utilityPaths?: readonly string[], homepage?: string }} input
 */
export function collectCanonicalSitemapLocs(input = {}) {
  const homepage = input.homepage ?? `${SITE_ORIGIN}/`;
  const postHrefs = input.postHrefs ?? [];
  const utilityPaths = input.utilityPaths ?? INDEXABLE_UTILITY_PATHS;
  const locs = new Set();

  const home = normalizeSitemapLoc(homepage);
  if (!home) throw new Error("Invalid homepage for sitemap");
  locs.add(home);

  for (const href of postHrefs) {
    const loc = normalizeSitemapLoc(href);
    if (!loc) throw new Error(`Invalid blog sitemap href: ${href}`);
    if (LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP.some((path) => loc.endsWith(path))) {
      throw new Error(`Legacy /p/ guide must not be a blog canonical: ${href}`);
    }
    locs.add(loc);
  }

  for (const path of utilityPaths) {
    if (LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP.includes(path)) {
      throw new Error(`Legacy /p/ guide must not be in utility allowlist: ${path}`);
    }
    const loc = normalizeSitemapLoc(`${SITE_ORIGIN}${path}`);
    if (!loc) throw new Error(`Invalid utility sitemap path: ${path}`);
    locs.add(loc);
  }

  return [...locs].sort();
}

/**
 * Allow only https://{xx}.11tik.com/l/{xx}/{slug} (xx ≠ en).
 * Rejects www, apex, arbitrary hosts, and bare locale homes (/l/xx/).
 * Locale homes are collected separately via collectLocaleHomeSitemapLocs().
 */
export function normalizeTrustedLocaleSitemapLoc(raw) {
  try {
    const url = new URL(String(raw || ""));
    if (url.protocol !== "https:") return null;
    if (url.search || url.hash) return null;
    const host = url.hostname.toLowerCase();
    const match = /^([a-z]{2})\.11tik\.com$/.exec(host);
    if (!match) return null;
    const code = match[1];
    if (code === "en") return null;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (!new RegExp(`^/l/${code}/[a-z0-9]+(?:-[a-z0-9]+)*$`, "i").test(path)) return null;
    return `https://${code}.11tik.com${path}`;
  } catch {
    return null;
  }
}

/**
 * Allow only https://{xx}.11tik.com/l/{xx}/ (xx ≠ en) — indexable locale SPA homes.
 */
export function normalizeLocaleHomeSitemapLoc(raw) {
  try {
    const url = new URL(String(raw || ""));
    if (url.protocol !== "https:") return null;
    if (url.search || url.hash) return null;
    const host = url.hostname.toLowerCase();
    const match = /^([a-z]{2})\.11tik\.com$/.exec(host);
    if (!match) return null;
    const code = match[1];
    if (code === "en") return null;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path !== `/l/${code}`) return null;
    return `https://${code}.11tik.com/l/${code}/`;
  } catch {
    return null;
  }
}

/** Every non-English ISO 639-1 locale home that generateStaticSite writes. */
export function collectLocaleHomeSitemapLocs() {
  const locs = [];
  for (const [code] of ISO6391) {
    if (code === "en") continue;
    const loc = normalizeLocaleHomeSitemapLoc(`https://${code}.11tik.com/l/${code}/`);
    if (!loc) throw new Error(`Invalid locale home for sitemap: ${code}`);
    locs.push(loc);
  }
  return locs.sort();
}

export function buildSitemapXml(locs) {
  const urls = locs.map((loc) => `  <url><loc>${xmlEscape(loc)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function parseSitemapLocs(xml) {
  return [...String(xml || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}
