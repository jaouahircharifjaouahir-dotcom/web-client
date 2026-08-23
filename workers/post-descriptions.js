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
    "Download a public YouTube thumbnail in HD: paste a watch, Shorts, or youtu.be URL into 11tik and save the largest still that exists.",
  "/2026/08/youtube-thumbnail-url.html":
    "A YouTube thumbnail URL is the image on i.ytimg.com, not the watch page. Copy a working HTTPS link after 11tik confirms the file.",
  "/2026/08/youtube-thumbnail-size-resolution.html":
    "Public YouTube thumbnail sizes from 120×90 to 1280×720 maxresdefault. 11tik lists files that exist and will not invent 4K.",
  "/2026/08/youtube-shorts-thumbnail-download.html":
    "Download a YouTube Shorts thumbnail in the browser. Shorts use the same public stills as watch URLs. The file is often landscape.",
  "/2026/08/highest-quality-youtube-thumbnail.html":
    "Highest quality means the largest public JPEG or WebP YouTube actually returns, not a guessed 4K filename.",
  "/2026/08/original-youtube-thumbnail-image.html":
    "Get the original public YouTube thumbnail YouTube already hosts. This is the CDN still, not a frame ripped from the video.",
  "/2026/08/what-is-maxresdefaultjpg-when-youtube.html":
    "maxresdefault.jpg is usually 1280×720 when YouTube published it. Many videos never have that file. 11tik checks before you save.",
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
    "Use a confirmed YouTube thumbnail as a blog featured image or Open Graph preview. Do not hotlink a guessed maxres URL.",
  "/2026/08/how-to-extract-thumbnails-from-youtube.html":
    "Paste a public YouTube channel URL into 11tik Bulk to extract recent public thumbnails. Research only; do not clone art.",
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
