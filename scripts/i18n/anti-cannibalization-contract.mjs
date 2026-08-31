/**
 * Phase 17.1 — canonical intent ownership (build-time contract).
 * Editorial + test enforcement; does not mutate URLs or merge pages.
 */
import { SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";

/** @typedef {{ primary: string, secondary: string[], protectedKeywords: string[], forbiddenOverlap: string[], preferredLinks: string[] }} IntentOwner */

/** contentId → intent contract */
export const ANTI_CANNIBALIZATION_CONTRACT = Object.freeze({
  home: {
    primary: "YouTube thumbnail downloader / extractor / grabber (tool intent)",
    secondary: ["brand", "generic youtube thumbnail"],
    protectedKeywords: [
      "youtube thumbnail extractor",
      "youtube thumbnail downloader",
      "youtube thumbnail grabber",
    ],
    forbiddenOverlap: [
      "how to download youtube thumbnail (tutorial depth)",
      "youtube thumbnail url anatomy",
      "maxresdefault troubleshooting",
    ],
    preferredLinks: ["/2026/08/how-to-download-youtube-thumbnail.html", "/p/embed.html"],
  },
  "how-to-download-youtube-thumbnail": {
    primary: "How to download / save a YouTube thumbnail image",
    secondary: ["get thumbnail", "save thumbnail"],
    protectedKeywords: ["how to download youtube thumbnail", "save youtube thumbnail"],
    forbiddenOverlap: ["tool homepage H1", "url anatomy deep dive", "maxres 404 essay"],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-url.html",
      "/2026/08/youtube-shorts-thumbnail-download.html",
      "/2026/08/how-to-batch-download-youtube.html",
    ],
  },
  "youtube-thumbnail-url": {
    primary: "YouTube thumbnail URL / CDN URL anatomy",
    secondary: ["copy image url", "i.ytimg.com"],
    protectedKeywords: ["youtube thumbnail url", "thumbnail url format"],
    forbiddenOverlap: ["download steps tutorial", "size matrix ownership"],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-size-resolution.html",
      "/2026/08/what-is-maxresdefaultjpg-when-youtube.html",
      "/p/embed.html",
    ],
  },
  "youtube-thumbnail-size-resolution": {
    primary: "YouTube thumbnail size / resolution / dimensions",
    secondary: ["quality tiers", "pixel matrix"],
    protectedKeywords: ["youtube thumbnail size", "youtube thumbnail resolution", "dimensions"],
    forbiddenOverlap: ["maxres 404 troubleshooting", "highest quality workflow", "measured sample study"],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-sizes-resolutions-study.html",
      "/2026/08/highest-quality-youtube-thumbnail.html",
      "/2026/08/what-is-maxresdefaultjpg-when-youtube.html",
      "/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html",
    ],
  },
  "youtube-thumbnail-sizes-resolutions-study": {
    primary: "Measured YouTube thumbnail variant availability (300-video sample)",
    secondary: ["empirical resolution ladder", "JPEG vs WebP byte medians"],
    protectedKeywords: [
      "youtube thumbnail sizes study",
      "thumbnail resolution measurement",
      "300 video sample",
    ],
    forbiddenOverlap: [
      "evergreen size matrix ownership",
      "download tutorial",
      "highest quality workflow",
    ],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-size-resolution.html",
      "/2026/08/what-is-maxresdefaultjpg-when-youtube.html",
      "/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html",
      "/p/embed.html",
    ],
  },
  "what-is-maxresdefaultjpg-when-youtube": {
    primary: "maxresdefault missing / fallback behavior",
    secondary: ["404 placeholder", "hq720 fallback"],
    protectedKeywords: ["maxresdefault", "maxres 404", "maxres missing"],
    forbiddenOverlap: ["full size matrix", "video private diagnosis"],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-size-resolution.html",
      "/2026/08/youtube-thumbnail-not-appearing-private.html",
      "/2026/08/youtube-studio-thumbnail-2026.html",
    ],
  },
  "highest-quality-youtube-thumbnail": {
    primary: "Largest validated public thumbnail workflow",
    secondary: ["HD still", "best available file"],
    protectedKeywords: ["highest quality youtube thumbnail", "maximum resolution"],
    forbiddenOverlap: ["original upload semantics", "size reference table"],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-size-resolution.html",
      "/2026/08/original-youtube-thumbnail-image.html",
      "/2026/08/how-to-download-youtube-thumbnail.html",
    ],
  },
  "original-youtube-thumbnail-image": {
    primary: "Public CDN derivative vs stream rip / upload distinction",
    secondary: ["custom upload still"],
    protectedKeywords: ["original youtube thumbnail", "original image"],
    forbiddenOverlap: ["highest quality workflow duplicate", "size matrix"],
    preferredLinks: [
      "/2026/08/highest-quality-youtube-thumbnail.html",
      "/2026/08/youtube-thumbnail-size-resolution.html",
      "/2026/08/how-to-download-youtube-thumbnail.html",
    ],
  },
  "webp-vs-jpeg-youtube-thumbnails-which": {
    primary: "WebP vs JPEG thumbnail format choice",
    secondary: ["CMS compatibility", "vi_webp"],
    protectedKeywords: ["webp vs jpeg youtube thumbnail"],
    forbiddenOverlap: ["full resolution matrix", "OG hosting guide"],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-size-resolution.html",
      "/2026/08/how-to-use-youtube-thumbnail-as-blog.html",
      "/p/embed.html",
    ],
  },
  "youtube-shorts-thumbnail-download": {
    primary: "YouTube Shorts thumbnail download behavior",
    secondary: ["shorts url pattern"],
    protectedKeywords: ["youtube shorts thumbnail", "download shorts thumbnail"],
    forbiddenOverlap: ["generic download tutorial", "live stream cover"],
    preferredLinks: [
      "/2026/08/how-to-download-youtube-thumbnail.html",
      "/2026/08/how-to-batch-download-youtube.html",
      "/2026/08/youtube-live-premiere-thumbnail-download.html",
    ],
  },
  "how-to-batch-download-youtube": {
    primary: "Bulk / batch thumbnail extraction (≤25 URLs)",
    secondary: ["zip export", "csv export"],
    protectedKeywords: ["batch download youtube thumbnails", "bulk thumbnail"],
    forbiddenOverlap: ["channel expansion workflow", "single-url tutorial"],
    preferredLinks: [
      "/2026/08/how-to-extract-thumbnails-from-youtube.html",
      "/2026/08/how-to-download-youtube-thumbnail.html",
      "/2026/08/youtube-shorts-thumbnail-download.html",
    ],
  },
  "how-to-extract-thumbnails-from-youtube": {
    primary: "Channel thumbnail extraction workflow",
    secondary: ["recent public uploads"],
    protectedKeywords: ["extract thumbnails from youtube channel", "channel thumbnail"],
    forbiddenOverlap: ["line-by-line batch without channel", "competitor cloning"],
    preferredLinks: [
      "/2026/08/how-to-batch-download-youtube.html",
      "/2026/08/how-to-download-youtube-thumbnail.html",
      "/2026/08/thumbnail-extractor-vs-maker.html",
    ],
  },
  "how-to-save-youtube-thumbnail-on-iphone": {
    primary: "Save thumbnail on iPhone / Android",
    secondary: ["mobile browser"],
    protectedKeywords: ["save youtube thumbnail iphone", "youtube thumbnail android"],
    forbiddenOverlap: ["desktop download tutorial", "url anatomy"],
    preferredLinks: [
      "/2026/08/how-to-download-youtube-thumbnail.html",
      "/2026/08/youtube-shorts-thumbnail-download.html",
      "/",
    ],
  },
  "how-to-use-youtube-thumbnail-as-blog": {
    primary: "YouTube thumbnail as blog / OG / featured image",
    secondary: ["wordpress", "hotlink risks"],
    protectedKeywords: ["youtube thumbnail featured image", "og image youtube"],
    forbiddenOverlap: ["url construction guide", "webp format essay"],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-url.html",
      "/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html",
      "/p/embed.html",
    ],
  },
  embed: {
    primary: "Developer embed / iframe integration",
    secondary: ["widget", "creator toolkit"],
    protectedKeywords: ["embed youtube thumbnail extractor", "iframe widget"],
    forbiddenOverlap: ["download tutorial", "competitor roundup"],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-url.html",
      "/2026/08/11tik-share-links-thumb-vs-youtube.html",
      "/2026/08/how-to-use-youtube-thumbnail-as-blog.html",
    ],
  },
  "youtube-studio-thumbnail-2026": {
    primary: "YouTube Studio custom thumbnail confirmation",
    secondary: ["2026 studio workflow"],
    protectedKeywords: ["youtube studio thumbnail 2026"],
    forbiddenOverlap: ["maxres 404 deep dive", "private video diagnosis"],
    preferredLinks: [
      "/2026/08/what-is-maxresdefaultjpg-when-youtube.html",
      "/2026/08/highest-quality-youtube-thumbnail.html",
      "/2026/08/how-to-download-youtube-thumbnail.html",
    ],
  },
  "youtube-thumbnail-not-appearing-private": {
    primary: "Video accessibility / unavailable thumbnail diagnosis",
    secondary: ["private", "age-restricted", "processing"],
    protectedKeywords: [
      "youtube thumbnail not appearing",
      "private age restricted processing",
    ],
    forbiddenOverlap: ["maxres filename 404", "download how-to"],
    preferredLinks: [
      "/2026/08/what-is-maxresdefaultjpg-when-youtube.html",
      "/2026/08/how-to-download-youtube-thumbnail.html",
      "/2026/08/youtube-studio-thumbnail-2026.html",
    ],
  },
  "11tik-share-links-thumb-vs-youtube": {
    primary: "11tik /thumb/{id} share URL vs watch vs CDN",
    secondary: ["product education"],
    protectedKeywords: ["11tik share link", "thumb vs watch"],
    forbiddenOverlap: ["generic url anatomy", "download tutorial"],
    preferredLinks: [
      "/2026/08/youtube-thumbnail-url.html",
      "/2026/08/how-to-download-youtube-thumbnail.html",
      "/",
    ],
  },
  "youtube-live-premiere-thumbnail-download": {
    primary: "Live / premiere cover still download",
    secondary: ["/live/ url", "premiere"],
    protectedKeywords: ["youtube live thumbnail", "premiere thumbnail download"],
    forbiddenOverlap: ["shorts vertical", "batch workflow"],
    preferredLinks: [
      "/2026/08/how-to-download-youtube-thumbnail.html",
      "/2026/08/youtube-shorts-thumbnail-download.html",
      "/2026/08/how-to-batch-download-youtube.html",
    ],
  },
  "screenshot-vs-real-youtube-thumbnail": {
    primary: "Screenshot vs CDN still comparison",
    secondary: ["player capture"],
    protectedKeywords: ["screenshot vs real youtube thumbnail"],
    forbiddenOverlap: ["download tutorial", "quality workflow"],
    preferredLinks: [
      "/2026/08/how-to-download-youtube-thumbnail.html",
      "/2026/08/highest-quality-youtube-thumbnail.html",
      "/",
    ],
  },
  "thumbnail-extractor-vs-maker": {
    primary: "Extractor vs maker / Canva boundary",
    secondary: ["product category"],
    protectedKeywords: ["thumbnail extractor vs maker"],
    forbiddenOverlap: ["tool homepage", "studio guide"],
    preferredLinks: ["/", "/2026/08/how-to-download-youtube-thumbnail.html"],
  },
});

export function contractForContentId(contentId) {
  return ANTI_CANNIBALIZATION_CONTRACT[contentId] || null;
}

export function allContractContentIds() {
  return Object.keys(ANTI_CANNIBALIZATION_CONTRACT);
}

export function toAbsoluteUrl(path) {
  const p = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${p}`;
}
