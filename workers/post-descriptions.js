import { clipDescription } from "./html-meta.js";

/** Unique search snippets (≤150 chars) for www posts and static pages. Home stays in the theme. */
export const POST_DESCRIPTIONS = {
  "/p/about.html":
    "11tik publishes the free in-browser YouTube thumbnail extractor. Public stills only. No account and no video download.",
  "/p/privacy.html":
    "11tik processes pasted URLs in your browser. Optional analytics use the 11tik.com cookie domain. Original thumbnail files are not stored.",
  "/p/terms-of-use.html":
    "Use 11tik with public URLs you may open. The extractor is not a license to reuse a thumbnail. Copyright stays with the uploader.",
  "/p/contact.html":
    "Contact 11tik about the YouTube Thumbnail Extractor, privacy, or rights. Email jaouahircharifjaouahir@gmail.com. Public stills only.",
  "/p/embed.html":
    "Embed a free YouTube thumbnail extractor iframe on your site. No API key. Keep id=yte-app so the widget can resize itself.",
  "/p/keyword-tools.html":
    "Open the 11tik extractor with a ready intro for common YouTube thumbnail search topics.",
  "/p/how-to-download-youtube-thumbnail.html":
    "Paste a public YouTube URL into 11tik and download the highest public still that exists. No app and no video file.",
  "/p/youtube-thumbnail-url.html":
    "Copy a working YouTube thumbnail URL from i.ytimg.com after 11tik confirms the file exists. Guessed maxres links often 404.",
  "/p/youtube-thumbnail-size.html":
    "YouTube thumbnail sizes in 2026: default, mq, hq, sd, and maxresdefault when published. 11tik lists only real files.",
  "/p/youtube-shorts-thumbnail.html":
    "Download a public YouTube Shorts thumbnail in the browser. Same image hosts as watch URLs. No video download.",
  "/2026/08/how-to-download-youtube-thumbnail.html":
    "Save a public YouTube thumbnail still: paste watch, Shorts, youtu.be, or embed URLs into 11tik and download the largest file that exists.",
  "/2026/08/youtube-thumbnail-url.html":
    "Build or copy a working YouTube thumbnail URL from the video ID on i.ytimg.com. Confirm the size exists before you hotlink it.",
  "/2026/08/youtube-thumbnail-size-resolution.html":
    "Compare YouTube thumbnail sizes from 120×90 to 1280×720. Maxres and hq720 are optional—use the largest public file that loads.",
  "/2026/08/youtube-shorts-thumbnail-download.html":
    "Download a YouTube Shorts thumbnail in the browser. Shorts use the same public stills as watch URLs. The file is often landscape.",
  "/2026/08/highest-quality-youtube-thumbnail.html":
    "Highest quality means the largest public JPEG or WebP YouTube actually returns, not a guessed 4K filename.",
  "/2026/08/original-youtube-thumbnail-image.html":
    "Get the original public YouTube thumbnail YouTube already hosts. This is the CDN still, not a frame ripped from the video.",
  "/2026/08/what-is-maxresdefaultjpg-when-youtube.html":
    "maxresdefault.jpg is usually 1280×720 when published. A 404 is normal—use the next real public still 11tik validates.",
  "/2026/08/how-to-batch-download-youtube.html":
    "Batch download public YouTube thumbnails: up to 25 URLs per run on 11tik Bulk, then zip or save each best still.",
  "/2026/08/screenshot-vs-real-youtube-thumbnail.html":
    "A player screenshot is not the YouTube thumbnail. Save the public still on i.ytimg.com instead of a phone capture.",
  "/2026/08/thumbnail-extractor-vs-maker.html":
    "An extractor saves the public still YouTube hosts. A maker creates original art. 11tik is an extractor only.",
  "/2026/08/youtube-studio-thumbnail-2026.html":
    "How custom thumbnails work in YouTube Studio in 2026, and how to confirm the public files with 11tik.",
  "/2026/08/how-to-save-youtube-thumbnail-on-iphone.html":
    "Save a public YouTube thumbnail on iPhone or Android in Safari or Chrome. No app store downloader.",
  "/2026/08/how-to-use-youtube-thumbnail-as-blog.html":
    "Confirm a YouTube still, then host it for WordPress, Blogger, or og:image. Avoid hotlinking a guessed maxres URL.",
  "/2026/08/how-to-extract-thumbnails-from-youtube.html":
    "Paste a public YouTube channel URL into 11tik Bulk to extract recent public thumbnails. Research only; do not clone art.",
  "/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html":
    "Choose JPEG or WebP for YouTube thumbnails based on what 11tik validates. WebP is optional; downloads keep the source format.",
};

export function descriptionForPath(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  if (POST_DESCRIPTIONS[path]) return clipDescription(POST_DESCRIPTIONS[path]);
  const base = path.split("/").pop();
  if (!base) return "";
  for (const [key, value] of Object.entries(POST_DESCRIPTIONS)) {
    if (key.endsWith(`/${base}`)) return clipDescription(value);
  }
  return "";
}
