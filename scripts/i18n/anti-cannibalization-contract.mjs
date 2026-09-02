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
    preferredLinks: ["/how-to-download-youtube-thumbnail", "/embed"],
  },
  "how-to-download-youtube-thumbnail": {
    primary: "How to download / save a YouTube thumbnail image",
    secondary: ["get thumbnail", "save thumbnail"],
    protectedKeywords: ["how to download youtube thumbnail", "save youtube thumbnail"],
    forbiddenOverlap: ["tool homepage H1", "url anatomy deep dive", "maxres 404 essay"],
    preferredLinks: [
      "/youtube-thumbnail-url",
      "/youtube-shorts-thumbnail-download",
      "/how-to-batch-download-youtube",
    ],
  },
  "youtube-thumbnail-url": {
    primary: "YouTube thumbnail URL / CDN URL anatomy",
    secondary: ["copy image url", "i.ytimg.com"],
    protectedKeywords: ["youtube thumbnail url", "thumbnail url format"],
    forbiddenOverlap: ["download steps tutorial", "size matrix ownership"],
    preferredLinks: [
      "/youtube-thumbnail-size-resolution",
      "/what-is-maxresdefaultjpg-when-youtube",
      "/embed",
    ],
  },
  "youtube-thumbnail-size-resolution": {
    primary: "YouTube thumbnail size / resolution / dimensions",
    secondary: ["quality tiers", "pixel matrix"],
    protectedKeywords: ["youtube thumbnail size", "youtube thumbnail resolution", "dimensions"],
    forbiddenOverlap: ["maxres 404 troubleshooting", "highest quality workflow", "measured sample study"],
    preferredLinks: [
      "/youtube-thumbnail-sizes-resolutions-study",
      "/highest-quality-youtube-thumbnail",
      "/what-is-maxresdefaultjpg-when-youtube",
      "/webp-vs-jpeg-youtube-thumbnails-which",
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
      "/youtube-thumbnail-size-resolution",
      "/youtube-thumbnail-url",
      "/original-youtube-thumbnail-image",
      "/youtube-shorts-thumbnail-download",
      "/highest-quality-youtube-thumbnail",
      "/how-to-download-youtube-thumbnail",
      "/embed",
    ],
  },
  "what-is-maxresdefaultjpg-when-youtube": {
    primary: "maxresdefault missing / fallback behavior",
    secondary: ["404 placeholder", "hq720 fallback"],
    protectedKeywords: ["maxresdefault", "maxres 404", "maxres missing"],
    forbiddenOverlap: ["full size matrix", "video private diagnosis"],
    preferredLinks: [
      "/youtube-thumbnail-size-resolution",
      "/youtube-thumbnail-not-appearing-private",
      "/youtube-studio-thumbnail-2026",
    ],
  },
  "highest-quality-youtube-thumbnail": {
    primary: "Largest validated public thumbnail workflow",
    secondary: ["HD still", "best available file"],
    protectedKeywords: ["highest quality youtube thumbnail", "maximum resolution"],
    forbiddenOverlap: ["original upload semantics", "size reference table"],
    preferredLinks: [
      "/youtube-thumbnail-size-resolution",
      "/original-youtube-thumbnail-image",
      "/how-to-download-youtube-thumbnail",
    ],
  },
  "original-youtube-thumbnail-image": {
    primary: "Public CDN derivative vs stream rip / upload distinction",
    secondary: ["custom upload still"],
    protectedKeywords: ["original youtube thumbnail", "original image"],
    forbiddenOverlap: ["highest quality workflow duplicate", "size matrix"],
    preferredLinks: [
      "/highest-quality-youtube-thumbnail",
      "/youtube-thumbnail-size-resolution",
      "/how-to-download-youtube-thumbnail",
      "/youtube-thumbnail-sizes-resolutions-study",
      "/youtube-thumbnail-url",
    ],
  },
  "webp-vs-jpeg-youtube-thumbnails-which": {
    primary: "WebP vs JPEG thumbnail format choice",
    secondary: ["CMS compatibility", "vi_webp"],
    protectedKeywords: ["webp vs jpeg youtube thumbnail"],
    forbiddenOverlap: ["full resolution matrix", "OG hosting guide"],
    preferredLinks: [
      "/youtube-thumbnail-size-resolution",
      "/how-to-use-youtube-thumbnail-as-blog",
      "/embed",
    ],
  },
  "youtube-shorts-thumbnail-download": {
    primary: "YouTube Shorts thumbnail download behavior",
    secondary: ["shorts url pattern"],
    protectedKeywords: ["youtube shorts thumbnail", "download shorts thumbnail"],
    forbiddenOverlap: ["generic download tutorial", "live stream cover"],
    preferredLinks: [
      "/how-to-download-youtube-thumbnail",
      "/how-to-batch-download-youtube",
      "/youtube-thumbnail-url",
      "/youtube-thumbnail-sizes-resolutions-study",
    ],
  },
  "how-to-batch-download-youtube": {
    primary: "Bulk / batch thumbnail extraction (≤25 URLs)",
    secondary: ["zip export", "csv export"],
    protectedKeywords: ["batch download youtube thumbnails", "bulk thumbnail"],
    forbiddenOverlap: ["channel expansion workflow", "single-url tutorial"],
    preferredLinks: [
      "/how-to-extract-thumbnails-from-youtube",
      "/how-to-download-youtube-thumbnail",
      "/youtube-shorts-thumbnail-download",
    ],
  },
  "how-to-extract-thumbnails-from-youtube": {
    primary: "Channel thumbnail extraction workflow",
    secondary: ["recent public uploads"],
    protectedKeywords: ["extract thumbnails from youtube channel", "channel thumbnail"],
    forbiddenOverlap: ["line-by-line batch without channel", "competitor cloning"],
    preferredLinks: [
      "/how-to-batch-download-youtube",
      "/how-to-download-youtube-thumbnail",
      "/thumbnail-extractor-vs-maker",
    ],
  },
  "how-to-save-youtube-thumbnail-on-iphone": {
    primary: "Save thumbnail on iPhone / Android",
    secondary: ["mobile browser"],
    protectedKeywords: ["save youtube thumbnail iphone", "youtube thumbnail android"],
    forbiddenOverlap: ["desktop download tutorial", "url anatomy"],
    preferredLinks: [
      "/how-to-download-youtube-thumbnail",
      "/youtube-shorts-thumbnail-download",
      "/",
    ],
  },
  "how-to-use-youtube-thumbnail-as-blog": {
    primary: "YouTube thumbnail as blog / OG / featured image",
    secondary: ["wordpress", "hotlink risks"],
    protectedKeywords: ["youtube thumbnail featured image", "og image youtube"],
    forbiddenOverlap: ["url construction guide", "webp format essay"],
    preferredLinks: [
      "/youtube-thumbnail-url",
      "/webp-vs-jpeg-youtube-thumbnails-which",
      "/embed",
    ],
  },
  embed: {
    primary: "Developer embed / iframe integration",
    secondary: ["widget", "creator toolkit"],
    protectedKeywords: ["embed youtube thumbnail extractor", "iframe widget"],
    forbiddenOverlap: ["download tutorial", "competitor roundup"],
    preferredLinks: [
      "/youtube-thumbnail-url",
      "/11tik-share-links-thumb-vs-youtube",
      "/how-to-use-youtube-thumbnail-as-blog",
    ],
  },
  "youtube-studio-thumbnail-2026": {
    primary: "YouTube Studio custom thumbnail confirmation",
    secondary: ["2026 studio workflow"],
    protectedKeywords: ["youtube studio thumbnail 2026"],
    forbiddenOverlap: ["maxres 404 deep dive", "private video diagnosis"],
    preferredLinks: [
      "/what-is-maxresdefaultjpg-when-youtube",
      "/highest-quality-youtube-thumbnail",
      "/how-to-download-youtube-thumbnail",
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
      "/what-is-maxresdefaultjpg-when-youtube",
      "/how-to-download-youtube-thumbnail",
      "/youtube-studio-thumbnail-2026",
    ],
  },
  "11tik-share-links-thumb-vs-youtube": {
    primary: "11tik /thumb/{id} share URL vs watch vs CDN",
    secondary: ["product education"],
    protectedKeywords: ["11tik share link", "thumb vs watch"],
    forbiddenOverlap: ["generic url anatomy", "download tutorial"],
    preferredLinks: [
      "/youtube-thumbnail-url",
      "/how-to-download-youtube-thumbnail",
      "/",
    ],
  },
  "youtube-live-premiere-thumbnail-download": {
    primary: "Live / premiere cover still download",
    secondary: ["/live/ url", "premiere"],
    protectedKeywords: ["youtube live thumbnail", "premiere thumbnail download"],
    forbiddenOverlap: ["shorts vertical", "batch workflow"],
    preferredLinks: [
      "/how-to-download-youtube-thumbnail",
      "/youtube-shorts-thumbnail-download",
      "/how-to-batch-download-youtube",
    ],
  },
  "screenshot-vs-real-youtube-thumbnail": {
    primary: "Screenshot vs CDN still comparison",
    secondary: ["player capture"],
    protectedKeywords: ["screenshot vs real youtube thumbnail"],
    forbiddenOverlap: ["download tutorial", "quality workflow"],
    preferredLinks: [
      "/how-to-download-youtube-thumbnail",
      "/highest-quality-youtube-thumbnail",
      "/",
    ],
  },
  "thumbnail-extractor-vs-maker": {
    primary: "Extractor vs maker / Canva boundary",
    secondary: ["product category"],
    protectedKeywords: ["thumbnail extractor vs maker"],
    forbiddenOverlap: ["tool homepage", "studio guide"],
    preferredLinks: ["/", "/how-to-download-youtube-thumbnail"],
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
