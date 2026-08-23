/**
 * Canonical URL inventory for the static production sitemap (www.11tik.com/sitemap.xml).
 *
 * Blog posts: hrefs from src/content/posts.ts (GUIDE_POSTS) — not POST_DESCRIPTIONS.
 * Utilities: explicit allowlist only.
 * Metadata (POST_DESCRIPTIONS) is independent and must never drive sitemap locs.
 */

export const SITE_ORIGIN = "https://www.11tik.com";

/** Intentionally indexable utility pages (Blogger /p/ pages that are live and meant for discovery). */
export const INDEXABLE_UTILITY_PATHS = Object.freeze([
  "/p/about.html",
  "/p/contact.html",
  "/p/embed.html",
  "/p/privacy.html",
  "/p/terms-of-use.html",
  "/p/keyword-tools.html",
]);

/**
 * Legacy /p/ guide paths that may still exist in POST_DESCRIPTIONS for meta polishing
 * but must never appear in sitemap.xml (they 404; canonicals are /2026/08/…).
 */
export const LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP = Object.freeze([
  "/p/how-to-download-youtube-thumbnail.html",
  "/p/youtube-thumbnail-url.html",
  "/p/youtube-thumbnail-size.html",
  "/p/youtube-shorts-thumbnail.html",
]);

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
