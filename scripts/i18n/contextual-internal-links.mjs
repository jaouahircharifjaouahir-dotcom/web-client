/**
 * Phase 17.1 — build-time contextual internal-link engine.
 * Injects deterministic sibling/pillar/utility links without mutating Blogger source.
 */
import {
  LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP,
  LEGACY_P_REDIRECTS,
  SITE_ORIGIN,
} from "../../workers/sitemap-canonicals.js";
import { contractForContentId } from "./anti-cannibalization-contract.mjs";
import { EN_ONLY_ARTICLE_IDS, contentIdFromWwwPath } from "./content-inventory.mjs";

const HOME = `${SITE_ORIGIN}/`;
const EMBED = `${SITE_ORIGIN}/embed`;

/** Paths that must never appear as internal link targets. */
export const BLOCKED_INTERNAL_PATH_PREFIXES = Object.freeze([
  "/search",
  "/feeds",
  "/api",
  "/web-client/hold-queue",
  "/web-client/__extracts",
  "/hold-queue",
  "/music/",
  "/lander",
]);

/** Historical non-equity URL families — never recovery targets. */
export const HISTORICAL_NON_EQUITY_PATTERNS = Object.freeze([
  /^\/music\//i,
  /\/backlink\//i,
  /^https?:\/\/[^/]+\/music\//i,
  /\/(github|wikipedia|quora|facebook|pinterest|imgur|tumblr|hashnode|stackoverflow|medium|vimeo|twitter|wordpress|linkedin|discourse|youtube|4chan)\/backlink\//i,
]);

const RETIRED_PATHS = new Set([
  ...LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP,
  "/p/youtube-thumbnail-extractor.html",
  "/p/youtube-thumbnail-extractor",
  "/p/copyright.html",
]);

const REDIRECT_SOURCE_PATHS = new Set(LEGACY_P_REDIRECTS.map((r) => r.from));

/** Anchor variants keyed by canonical path (descriptive, not exact-match spam). */
const ANCHOR_BY_PATH = Object.freeze({
  "/": "YouTube Thumbnail Extractor",
  "/embed": "embed the thumbnail extractor",
  "/how-to-download-youtube-thumbnail": "how to download a YouTube thumbnail",
  "/youtube-thumbnail-url": "YouTube thumbnail URL guide",
  "/youtube-thumbnail-size-resolution": "thumbnail size and resolution reference",
  "/highest-quality-youtube-thumbnail": "highest validated public quality",
  "/original-youtube-thumbnail-image": "original public CDN still",
  "/what-is-maxresdefaultjpg-when-youtube": "maxresdefault and fallbacks",
  "/webp-vs-jpeg-youtube-thumbnails-which": "WebP vs JPEG formats",
  "/youtube-shorts-thumbnail-download": "Shorts thumbnail download",
  "/how-to-batch-download-youtube": "batch download (up to 50 URLs)",
  "/how-to-extract-thumbnails-from-youtube": "channel URLs & individual video links",
  "/how-to-save-youtube-thumbnail-on-iphone": "save on iPhone or Android",
  "/how-to-use-youtube-thumbnail-as-blog": "blog / Open Graph featured image",
  "/youtube-live-premiere-thumbnail-download": "live and premiere covers",
  "/youtube-studio-thumbnail-2026": "YouTube Studio thumbnails",
  "/youtube-thumbnail-not-appearing-private": "when no thumbnail appears",
  "/11tik-share-links-thumb-vs-youtube": "share links (/thumb vs watch)",
  "/screenshot-vs-real-youtube-thumbnail": "screenshot vs real CDN still",
  "/thumbnail-extractor-vs-maker": "extractor vs maker",
  "/youtube-thumbnail-sizes-resolutions-study": "300-video size study",
});

/**
 * Deterministic contextual link plan per contentId.
 * Each entry: { path, role: 'parent'|'sibling'|'utility'|'home', reason }
 */
export const CONTEXTUAL_LINK_PLAN = Object.freeze({
  "how-to-download-youtube-thumbnail": {
    parent: { path: "/", reason: "tool pillar" },
    siblings: [
      { path: "/how-to-save-youtube-thumbnail-on-iphone", reason: "mobile workflow" },
      { path: "/youtube-shorts-thumbnail-download", reason: "shorts format" },
      { path: "/how-to-batch-download-youtube", reason: "bulk workflow" },
      { path: "/youtube-live-premiere-thumbnail-download", reason: "live/premiere" },
      { path: "/youtube-thumbnail-sizes-resolutions-study", reason: "resolution reference data" },
    ],
    utility: null,
    home: false,
  },
  "youtube-thumbnail-url": {
    parent: { path: "/youtube-thumbnail-size-resolution", reason: "resolution pillar" },
    siblings: [
      { path: "/youtube-thumbnail-sizes-resolutions-study", reason: "measured CDN variants" },
      { path: "/what-is-maxresdefaultjpg-when-youtube", reason: "maxres fallback" },
      { path: "/11tik-share-links-thumb-vs-youtube", reason: "share URL shapes" },
      { path: "/how-to-download-youtube-thumbnail", reason: "download workflow" },
    ],
    utility: { path: "/embed", reason: "developer embed" },
    home: true,
  },
  "youtube-thumbnail-size-resolution": {
    parent: { path: "/youtube-thumbnail-url", reason: "url co-pillar" },
    siblings: [
      { path: "/youtube-thumbnail-sizes-resolutions-study", reason: "measured sample data" },
      { path: "/highest-quality-youtube-thumbnail", reason: "quality workflow" },
      { path: "/original-youtube-thumbnail-image", reason: "original still semantics" },
      { path: "/what-is-maxresdefaultjpg-when-youtube", reason: "maxres troubleshooting" },
      { path: "/webp-vs-jpeg-youtube-thumbnails-which", reason: "format choice" },
    ],
    utility: null,
    home: true,
  },
  "youtube-thumbnail-sizes-resolutions-study": {
    parent: { path: "/youtube-thumbnail-size-resolution", reason: "evergreen size guide" },
    siblings: [
      { path: "/youtube-thumbnail-url", reason: "CDN URL patterns" },
      { path: "/highest-quality-youtube-thumbnail", reason: "per-video workflow" },
      { path: "/how-to-download-youtube-thumbnail", reason: "download steps" },
      { path: "/original-youtube-thumbnail-image", reason: "original still semantics" },
      { path: "/youtube-shorts-thumbnail-download", reason: "shorts format" },
    ],
    utility: { path: "/embed", reason: "developer embed" },
    home: true,
  },
  "highest-quality-youtube-thumbnail": {
    parent: { path: "/youtube-thumbnail-size-resolution", reason: "size pillar" },
    siblings: [
      { path: "/youtube-thumbnail-sizes-resolutions-study", reason: "measured variant ladder" },
      { path: "/original-youtube-thumbnail-image", reason: "original vs highest" },
      { path: "/how-to-download-youtube-thumbnail", reason: "download steps" },
      { path: "/what-is-maxresdefaultjpg-when-youtube", reason: "missing maxres" },
    ],
    utility: null,
    home: true,
  },
  "original-youtube-thumbnail-image": {
    parent: { path: "/youtube-thumbnail-size-resolution", reason: "size pillar" },
    siblings: [
      { path: "/youtube-thumbnail-sizes-resolutions-study", reason: "sample-scoped CDN data" },
      { path: "/highest-quality-youtube-thumbnail", reason: "validated largest file" },
      { path: "/youtube-thumbnail-url", reason: "CDN filename patterns" },
      { path: "/how-to-download-youtube-thumbnail", reason: "download workflow" },
    ],
    utility: null,
    home: true,
  },
  "what-is-maxresdefaultjpg-when-youtube": {
    parent: { path: "/youtube-thumbnail-size-resolution", reason: "resolution pillar" },
    siblings: [
      { path: "/youtube-thumbnail-sizes-resolutions-study", reason: "measured maxres availability" },
      { path: "/youtube-thumbnail-not-appearing-private", reason: "video-level unavailability" },
      { path: "/youtube-studio-thumbnail-2026", reason: "studio confirmation" },
      { path: "/youtube-thumbnail-url", reason: "url anatomy" },
    ],
    utility: null,
    home: true,
  },
  "webp-vs-jpeg-youtube-thumbnails-which": {
    parent: { path: "/youtube-thumbnail-size-resolution", reason: "format pillar" },
    siblings: [
      { path: "/youtube-thumbnail-sizes-resolutions-study", reason: "measured byte comparison" },
      { path: "/how-to-use-youtube-thumbnail-as-blog", reason: "CMS / OG use" },
      { path: "/youtube-thumbnail-url", reason: "url paths" },
    ],
    utility: { path: "/embed", reason: "developer embed" },
    home: true,
  },
  "youtube-shorts-thumbnail-download": {
    parent: { path: "/how-to-download-youtube-thumbnail", reason: "download pillar" },
    siblings: [
      { path: "/youtube-thumbnail-sizes-resolutions-study", reason: "variant availability in sample" },
      { path: "/youtube-thumbnail-url", reason: "shorts uses same CDN paths" },
      { path: "/how-to-batch-download-youtube", reason: "bulk shorts" },
    ],
    utility: null,
    home: true,
  },
  "how-to-batch-download-youtube": {
    parent: { path: "/how-to-download-youtube-thumbnail", reason: "single-url pillar" },
    siblings: [
      { path: "/how-to-extract-thumbnails-from-youtube", reason: "channel workflow" },
      { path: "/youtube-shorts-thumbnail-download", reason: "shorts in bulk" },
    ],
    utility: null,
    home: true,
  },
  "how-to-extract-thumbnails-from-youtube": {
    parent: { path: "/how-to-batch-download-youtube", reason: "bulk pillar" },
    siblings: [
      { path: "/how-to-download-youtube-thumbnail", reason: "single URL" },
      { path: "/how-to-save-youtube-thumbnail-on-iphone", reason: "mobile" },
      { path: "/thumbnail-extractor-vs-maker", reason: "research ethics" },
    ],
    utility: null,
    home: true,
  },
  "how-to-save-youtube-thumbnail-on-iphone": {
    parent: { path: "/how-to-download-youtube-thumbnail", reason: "download pillar" },
    siblings: [
      { path: "/youtube-shorts-thumbnail-download", reason: "shorts on mobile" },
      { path: "/screenshot-vs-real-youtube-thumbnail", reason: "avoid screenshots" },
    ],
    utility: null,
    home: true,
  },
  "how-to-use-youtube-thumbnail-as-blog": {
    parent: { path: "/youtube-thumbnail-url", reason: "url pillar" },
    siblings: [
      { path: "/webp-vs-jpeg-youtube-thumbnails-which", reason: "format for CMS" },
      { path: "/how-to-download-youtube-thumbnail", reason: "confirm still exists" },
    ],
    utility: { path: "/embed", reason: "embed widget" },
    home: true,
  },
  embed: {
    parent: { path: "/youtube-thumbnail-url", reason: "url reference" },
    siblings: [
      { path: "/11tik-share-links-thumb-vs-youtube", reason: "share URLs" },
      { path: "/how-to-use-youtube-thumbnail-as-blog", reason: "OG / CMS" },
      { path: "/webp-vs-jpeg-youtube-thumbnails-which", reason: "format notes" },
    ],
    utility: null,
    home: true,
  },
  "youtube-studio-thumbnail-2026": {
    parent: { path: "/what-is-maxresdefaultjpg-when-youtube", reason: "troubleshoot pillar" },
    siblings: [
      { path: "/highest-quality-youtube-thumbnail", reason: "validate public files" },
      { path: "/how-to-download-youtube-thumbnail", reason: "download confirmation" },
    ],
    utility: null,
    home: true,
  },
  "youtube-thumbnail-not-appearing-private": {
    parent: { path: "/what-is-maxresdefaultjpg-when-youtube", reason: "troubleshoot pillar" },
    siblings: [
      { path: "/how-to-download-youtube-thumbnail", reason: "when sizes do appear" },
      { path: "/youtube-studio-thumbnail-2026", reason: "studio processing" },
    ],
    utility: null,
    home: true,
  },
  "11tik-share-links-thumb-vs-youtube": {
    parent: { path: "/youtube-thumbnail-url", reason: "url pillar" },
    siblings: [
      { path: "/how-to-download-youtube-thumbnail", reason: "download workflow" },
      { path: "/youtube-thumbnail-size-resolution", reason: "resolution reference" },
    ],
    utility: { path: "/embed", reason: "developer embed" },
    home: true,
  },
  "youtube-live-premiere-thumbnail-download": {
    parent: { path: "/how-to-download-youtube-thumbnail", reason: "download pillar" },
    siblings: [
      { path: "/youtube-shorts-thumbnail-download", reason: "format sibling" },
      { path: "/how-to-batch-download-youtube", reason: "bulk events" },
    ],
    utility: null,
    home: true,
  },
  "screenshot-vs-real-youtube-thumbnail": {
    parent: { path: "/how-to-download-youtube-thumbnail", reason: "download pillar" },
    siblings: [
      { path: "/highest-quality-youtube-thumbnail", reason: "best public file" },
      { path: "/original-youtube-thumbnail-image", reason: "CDN still semantics" },
    ],
    utility: null,
    home: true,
  },
  "thumbnail-extractor-vs-maker": {
    parent: { path: "/", reason: "tool pillar" },
    siblings: [
      { path: "/how-to-download-youtube-thumbnail", reason: "extractor workflow" },
    ],
    utility: null,
    home: false,
  },
});

export function normalizePath(pathOrUrl) {
  try {
    const url = pathOrUrl.startsWith("http") ? new URL(pathOrUrl) : new URL(pathOrUrl, SITE_ORIGIN);
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

export function isHistoricalNonEquityUrl(href) {
  const s = String(href || "");
  return HISTORICAL_NON_EQUITY_PATTERNS.some((re) => re.test(s));
}

export function isBlockedInternalTarget(pathOrUrl) {
  const path = normalizePath(pathOrUrl);
  if (!path) return true;
  if (path.includes("?")) return true;
  if (RETIRED_PATHS.has(path)) return true;
  if (REDIRECT_SOURCE_PATHS.has(path)) return true;
  if (BLOCKED_INTERNAL_PATH_PREFIXES.some((p) => path === p || path.startsWith(p))) return true;
  if (isHistoricalNonEquityUrl(path)) return true;
  return false;
}

function anchorForPath(path) {
  return ANCHOR_BY_PATH[path] || ANCHOR_BY_PATH[normalizePath(path)] || path.split("/").pop()?.replace(/\.html$/, "") || "related guide";
}

function pathToCanonicalUrl(path) {
  const p = normalizePath(path);
  return p === "/" ? HOME : `${SITE_ORIGIN}${p}`;
}

export function resolveContextualLinks(contentId, selfCanonicalPath, options = {}) {
  const locale = options.locale || "en";
  const plan = CONTEXTUAL_LINK_PLAN[contentId];
  if (!plan) return [];

  const selfPath = normalizePath(selfCanonicalPath);
  const seen = new Set();
  const rows = [];

  function push(row) {
    const path = normalizePath(row.path);
    if (!path || path === selfPath) return;
    if (seen.has(path)) return;
    if (isBlockedInternalTarget(path)) return;
    const targetContentId = contentIdFromWwwPath(path);
    if (locale !== "en" && EN_ONLY_ARTICLE_IDS.includes(targetContentId)) return;
    seen.add(path);
    rows.push({
      sourceContentId: contentId,
      targetPath: path,
      targetUrl: pathToCanonicalUrl(path),
      anchor: anchorForPath(path),
      role: row.role,
      reason: row.reason,
      locale: "en",
    });
  }

  if (plan.parent) push({ ...plan.parent, role: "parent" });
  for (const s of plan.siblings || []) push({ ...s, role: "sibling" });
  if (plan.utility) push({ ...plan.utility, role: "utility" });
  if (plan.home) push({ path: "/", role: "home", reason: "tool CTA" });

  return rows;
}

export function renderContextualLinksNav(contentId, selfCanonicalPath, options = {}) {
  const links = resolveContextualLinks(contentId, selfCanonicalPath, options);
  if (!links.length) return "";

  const items = links
    .map((l) => `<li><a href="${l.targetUrl}">${escapeHtml(l.anchor)}</a></li>`)
    .join("\n    ");

  return `<nav class="yte-related" aria-label="Related guides">
  <h2>Related guides</h2>
  <ul>
    ${items}
  </ul>
</nav>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const RELATED_MARKER = 'class="yte-related"';

/** Inject contextual nav before bio or before closing article (build-time only). */
export function applyContextualInternalLinks(html, contentId, selfCanonicalPath) {
  const nav = renderContextualLinksNav(contentId, selfCanonicalPath);
  if (!nav || String(html || "").includes(RELATED_MARKER)) return html;

  const bioIdx = html.indexOf('class="yte-bio"');
  if (bioIdx !== -1) {
    const beforeBio = html.lastIndexOf("<p", bioIdx);
    const insertAt = beforeBio !== -1 ? beforeBio : bioIdx;
    return `${html.slice(0, insertAt)}${nav}\n  ${html.slice(insertAt)}`;
  }

  const closeArticle = html.lastIndexOf("</article>");
  if (closeArticle !== -1) {
    return `${html.slice(0, closeArticle)}${nav}\n${html.slice(closeArticle)}`;
  }
  return `${html}\n${nav}`;
}

export function generateInternalLinkReport(inventoryItems = []) {
  const report = [];
  for (const item of inventoryItems) {
    if (item.type !== "article" && item.contentId !== "embed") continue;
    if (!CONTEXTUAL_LINK_PLAN[item.contentId]) continue;
    const links = resolveContextualLinks(item.contentId, item.canonicalPath);
    for (const link of links) {
      report.push({
        source: item.canonicalUrl,
        sourceContentId: item.contentId,
        target: link.targetUrl,
        anchor: link.anchor,
        reason: link.reason,
        locale: "en",
        role: link.role,
        duplicateInPlan: false,
        retiredTarget: isBlockedInternalTarget(link.targetPath),
        contract: contractForContentId(item.contentId)?.primary || null,
      });
    }
  }
  return report;
}

export function validateAllLinkPlans() {
  const errors = [];
  for (const [contentId, plan] of Object.entries(CONTEXTUAL_LINK_PLAN)) {
    const paths = [];
    if (plan.parent) paths.push(plan.parent.path);
    for (const s of plan.siblings || []) paths.push(s.path);
    if (plan.utility) paths.push(plan.utility.path);
    if (plan.home) paths.push("/");

    const uniq = new Set();
    for (const p of paths) {
      const norm = normalizePath(p);
      if (uniq.has(norm)) errors.push(`${contentId}: duplicate target ${norm}`);
      uniq.add(norm);
      if (isBlockedInternalTarget(norm)) errors.push(`${contentId}: blocked target ${norm}`);
      if (isHistoricalNonEquityUrl(norm)) errors.push(`${contentId}: non-equity target ${norm}`);
    }

    const siblingCount = (plan.siblings || []).length;
    if (siblingCount < 1 || siblingCount > 5) {
      errors.push(`${contentId}: sibling count ${siblingCount} outside 1–5`);
    }
    const hasHomeOrParent = Boolean(plan.parent || plan.home);
    if (!hasHomeOrParent) {
      errors.push(`${contentId}: missing parent or home CTA`);
    }
  }
  return errors;
}

export function contextualLinkPlanContentIds() {
  return Object.keys(CONTEXTUAL_LINK_PLAN);
}
