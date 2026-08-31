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

const HOME = `${SITE_ORIGIN}/`;
const EMBED = `${SITE_ORIGIN}/p/embed.html`;

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
  "/p/embed.html": "embed the thumbnail extractor",
  "/2026/08/how-to-download-youtube-thumbnail.html": "how to download a YouTube thumbnail",
  "/2026/08/youtube-thumbnail-url.html": "YouTube thumbnail URL guide",
  "/2026/08/youtube-thumbnail-size-resolution.html": "thumbnail size and resolution reference",
  "/2026/08/highest-quality-youtube-thumbnail.html": "highest validated public quality",
  "/2026/08/original-youtube-thumbnail-image.html": "original public CDN still",
  "/2026/08/what-is-maxresdefaultjpg-when-youtube.html": "maxresdefault and fallbacks",
  "/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html": "WebP vs JPEG formats",
  "/2026/08/youtube-shorts-thumbnail-download.html": "Shorts thumbnail download",
  "/2026/08/how-to-batch-download-youtube.html": "batch download (up to 25 URLs)",
  "/2026/08/how-to-extract-thumbnails-from-youtube.html": "extract from a channel URL",
  "/2026/08/how-to-save-youtube-thumbnail-on-iphone.html": "save on iPhone or Android",
  "/2026/08/how-to-use-youtube-thumbnail-as-blog.html": "blog / Open Graph featured image",
  "/2026/08/youtube-live-premiere-thumbnail-download.html": "live and premiere covers",
  "/2026/08/youtube-studio-thumbnail-2026.html": "YouTube Studio thumbnails",
  "/2026/08/youtube-thumbnail-not-appearing-private.html": "when no thumbnail appears",
  "/2026/08/11tik-share-links-thumb-vs-youtube.html": "share links (/thumb vs watch)",
  "/2026/08/screenshot-vs-real-youtube-thumbnail.html": "screenshot vs real CDN still",
  "/2026/08/thumbnail-extractor-vs-maker.html": "extractor vs maker",
});

/**
 * Deterministic contextual link plan per contentId.
 * Each entry: { path, role: 'parent'|'sibling'|'utility'|'home', reason }
 */
export const CONTEXTUAL_LINK_PLAN = Object.freeze({
  "how-to-download-youtube-thumbnail": {
    parent: { path: "/", reason: "tool pillar" },
    siblings: [
      { path: "/2026/08/how-to-save-youtube-thumbnail-on-iphone.html", reason: "mobile workflow" },
      { path: "/2026/08/youtube-shorts-thumbnail-download.html", reason: "shorts format" },
      { path: "/2026/08/how-to-batch-download-youtube.html", reason: "bulk workflow" },
      { path: "/2026/08/youtube-live-premiere-thumbnail-download.html", reason: "live/premiere" },
    ],
    utility: null,
    home: false,
  },
  "youtube-thumbnail-url": {
    parent: { path: "/2026/08/youtube-thumbnail-size-resolution.html", reason: "resolution pillar" },
    siblings: [
      { path: "/2026/08/what-is-maxresdefaultjpg-when-youtube.html", reason: "maxres fallback" },
      { path: "/2026/08/11tik-share-links-thumb-vs-youtube.html", reason: "share URL shapes" },
      { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "download workflow" },
    ],
    utility: { path: "/p/embed.html", reason: "developer embed" },
    home: true,
  },
  "youtube-thumbnail-size-resolution": {
    parent: { path: "/2026/08/youtube-thumbnail-url.html", reason: "url co-pillar" },
    siblings: [
      { path: "/2026/08/highest-quality-youtube-thumbnail.html", reason: "quality workflow" },
      { path: "/2026/08/original-youtube-thumbnail-image.html", reason: "original still semantics" },
      { path: "/2026/08/what-is-maxresdefaultjpg-when-youtube.html", reason: "maxres troubleshooting" },
      { path: "/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html", reason: "format choice" },
    ],
    utility: null,
    home: true,
  },
  "highest-quality-youtube-thumbnail": {
    parent: { path: "/2026/08/youtube-thumbnail-size-resolution.html", reason: "size pillar" },
    siblings: [
      { path: "/2026/08/original-youtube-thumbnail-image.html", reason: "original vs highest" },
      { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "download steps" },
      { path: "/2026/08/what-is-maxresdefaultjpg-when-youtube.html", reason: "missing maxres" },
    ],
    utility: null,
    home: true,
  },
  "original-youtube-thumbnail-image": {
    parent: { path: "/2026/08/youtube-thumbnail-size-resolution.html", reason: "size pillar" },
    siblings: [
      { path: "/2026/08/highest-quality-youtube-thumbnail.html", reason: "validated largest file" },
      { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "download workflow" },
      { path: "/2026/08/screenshot-vs-real-youtube-thumbnail.html", reason: "real vs capture" },
    ],
    utility: null,
    home: true,
  },
  "what-is-maxresdefaultjpg-when-youtube": {
    parent: { path: "/2026/08/youtube-thumbnail-size-resolution.html", reason: "resolution pillar" },
    siblings: [
      { path: "/2026/08/youtube-thumbnail-not-appearing-private.html", reason: "video-level unavailability" },
      { path: "/2026/08/youtube-studio-thumbnail-2026.html", reason: "studio confirmation" },
      { path: "/2026/08/youtube-thumbnail-url.html", reason: "url anatomy" },
    ],
    utility: null,
    home: true,
  },
  "webp-vs-jpeg-youtube-thumbnails-which": {
    parent: { path: "/2026/08/youtube-thumbnail-size-resolution.html", reason: "format pillar" },
    siblings: [
      { path: "/2026/08/how-to-use-youtube-thumbnail-as-blog.html", reason: "CMS / OG use" },
      { path: "/2026/08/youtube-thumbnail-url.html", reason: "url paths" },
    ],
    utility: { path: "/p/embed.html", reason: "developer embed" },
    home: true,
  },
  "youtube-shorts-thumbnail-download": {
    parent: { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "download pillar" },
    siblings: [
      { path: "/2026/08/how-to-batch-download-youtube.html", reason: "bulk shorts" },
      { path: "/2026/08/youtube-live-premiere-thumbnail-download.html", reason: "live format" },
    ],
    utility: null,
    home: true,
  },
  "how-to-batch-download-youtube": {
    parent: { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "single-url pillar" },
    siblings: [
      { path: "/2026/08/how-to-extract-thumbnails-from-youtube.html", reason: "channel workflow" },
      { path: "/2026/08/youtube-shorts-thumbnail-download.html", reason: "shorts in bulk" },
    ],
    utility: null,
    home: true,
  },
  "how-to-extract-thumbnails-from-youtube": {
    parent: { path: "/2026/08/how-to-batch-download-youtube.html", reason: "bulk pillar" },
    siblings: [
      { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "single URL" },
      { path: "/2026/08/how-to-save-youtube-thumbnail-on-iphone.html", reason: "mobile" },
      { path: "/2026/08/thumbnail-extractor-vs-maker.html", reason: "research ethics" },
    ],
    utility: null,
    home: true,
  },
  "how-to-save-youtube-thumbnail-on-iphone": {
    parent: { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "download pillar" },
    siblings: [
      { path: "/2026/08/youtube-shorts-thumbnail-download.html", reason: "shorts on mobile" },
      { path: "/2026/08/screenshot-vs-real-youtube-thumbnail.html", reason: "avoid screenshots" },
    ],
    utility: null,
    home: true,
  },
  "how-to-use-youtube-thumbnail-as-blog": {
    parent: { path: "/2026/08/youtube-thumbnail-url.html", reason: "url pillar" },
    siblings: [
      { path: "/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html", reason: "format for CMS" },
      { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "confirm still exists" },
    ],
    utility: { path: "/p/embed.html", reason: "embed widget" },
    home: true,
  },
  embed: {
    parent: { path: "/2026/08/youtube-thumbnail-url.html", reason: "url reference" },
    siblings: [
      { path: "/2026/08/11tik-share-links-thumb-vs-youtube.html", reason: "share URLs" },
      { path: "/2026/08/how-to-use-youtube-thumbnail-as-blog.html", reason: "OG / CMS" },
      { path: "/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html", reason: "format notes" },
    ],
    utility: null,
    home: true,
  },
  "youtube-studio-thumbnail-2026": {
    parent: { path: "/2026/08/what-is-maxresdefaultjpg-when-youtube.html", reason: "troubleshoot pillar" },
    siblings: [
      { path: "/2026/08/highest-quality-youtube-thumbnail.html", reason: "validate public files" },
      { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "download confirmation" },
    ],
    utility: null,
    home: true,
  },
  "youtube-thumbnail-not-appearing-private": {
    parent: { path: "/2026/08/what-is-maxresdefaultjpg-when-youtube.html", reason: "troubleshoot pillar" },
    siblings: [
      { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "when sizes do appear" },
      { path: "/2026/08/youtube-studio-thumbnail-2026.html", reason: "studio processing" },
    ],
    utility: null,
    home: true,
  },
  "11tik-share-links-thumb-vs-youtube": {
    parent: { path: "/2026/08/youtube-thumbnail-url.html", reason: "url pillar" },
    siblings: [
      { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "download workflow" },
      { path: "/2026/08/youtube-thumbnail-size-resolution.html", reason: "resolution reference" },
    ],
    utility: { path: "/p/embed.html", reason: "developer embed" },
    home: true,
  },
  "youtube-live-premiere-thumbnail-download": {
    parent: { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "download pillar" },
    siblings: [
      { path: "/2026/08/youtube-shorts-thumbnail-download.html", reason: "format sibling" },
      { path: "/2026/08/how-to-batch-download-youtube.html", reason: "bulk events" },
    ],
    utility: null,
    home: true,
  },
  "screenshot-vs-real-youtube-thumbnail": {
    parent: { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "download pillar" },
    siblings: [
      { path: "/2026/08/highest-quality-youtube-thumbnail.html", reason: "best public file" },
      { path: "/2026/08/original-youtube-thumbnail-image.html", reason: "CDN still semantics" },
    ],
    utility: null,
    home: true,
  },
  "thumbnail-extractor-vs-maker": {
    parent: { path: "/", reason: "tool pillar" },
    siblings: [
      { path: "/2026/08/how-to-download-youtube-thumbnail.html", reason: "extractor workflow" },
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

export function resolveContextualLinks(contentId, selfCanonicalPath) {
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

export function renderContextualLinksNav(contentId, selfCanonicalPath) {
  const links = resolveContextualLinks(contentId, selfCanonicalPath);
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
