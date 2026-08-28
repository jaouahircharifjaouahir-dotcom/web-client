import { join } from "node:path";
import { fitDescription, fitTitle } from "../workers/html-meta.js";
import {
  renderSiteHeaderHtml,
  siteHeaderHeadTags,
  siteHeaderScriptTag,
} from "./i18n/site-header.mjs";

const SITE = "https://www.11tik.com";
const CANONICAL = `${SITE}/copyright`;
const APP_ASSET_V = "57";

const LEGAL = {
  title: "Copyright & Usage",
  description:
    "How 11tik treats public YouTube thumbnails, copyright, and reuse. Stills only. No claim of ownership of creator art.",
  q1: "Is it legal to download YouTube thumbnails?",
  a1: "You may download publicly available thumbnails for personal reference, research, or educational analysis. Thumbnails remain the copyrighted property of their original creators. Obtain permission before reusing a thumbnail commercially, publishing it elsewhere, or using it as your own video's cover art.",
  q2: "Are there copyright risks?",
  a2: "Yes, if reused without permission. Using a thumbnail as inspiration or for private study carries minimal risk. Republishing it as-is (on another channel, a blog, or merchandise) can trigger a copyright claim from the original creator or YouTube.",
  q3: "Does 11tik store or claim ownership of thumbnails?",
  a3: "No. 11tik does not store, host, or claim rights to any thumbnail. Images are fetched directly from YouTube's public CDN in your browser and are never uploaded to or cached on 11tik servers as original media files.",
};

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function copyrightStaticHtml() {
  const title = fitTitle(`${LEGAL.title} · 11tik`);
  const description = fitDescription(LEGAL.description);
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${xmlEscape(title)}</title>
  <meta name="description" content="${xmlEscape(description)}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${CANONICAL}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${xmlEscape(title)}"/>
  <meta property="og:description" content="${xmlEscape(description)}"/>
  <meta property="og:url" content="${CANONICAL}"/>
  ${siteHeaderHeadTags()}
  <style>.yte-page{max-width:720px;margin:32px auto 64px;padding:0 20px;font-family:system-ui,Segoe UI,sans-serif;color:#17141c;line-height:1.65}.yte-page h1{font-size:2rem;margin:0 0 12px}.yte-page h2{font-size:1.2rem;margin:28px 0 8px}.yte-page p{color:#5c5666}</style>
</head>
<body>
${renderSiteHeaderHtml({ locale: "en", homeUrl: `${SITE}/`, contentPath: "/copyright", variant: "static" })}
<article class="yte-page">
  <h1>${xmlEscape(LEGAL.title)}</h1>
  <p itemprop="description">${xmlEscape(description)}</p>
  <h2>${xmlEscape(LEGAL.q1)}</h2>
  <p>${xmlEscape(LEGAL.a1)}</p>
  <h2>${xmlEscape(LEGAL.q2)}</h2>
  <p>${xmlEscape(LEGAL.a2)}</p>
  <h2>${xmlEscape(LEGAL.q3)}</h2>
  <p>${xmlEscape(LEGAL.a3)}</p>
  <p><a href="${SITE}/">YouTube Thumbnail Extractor</a> · <a href="${SITE}/p/about.html">About</a> · <a href="${SITE}/p/privacy.html">Privacy</a> · <a href="${SITE}/p/terms-of-use.html">Terms</a></p>
</article>
${siteHeaderScriptTag()}
<script defer fetchpriority="high" src="/web-client/blogger-app.js?v=${APP_ASSET_V}"></script>
</body>
</html>
`;
}

export function writeCopyrightStaticPage(writeFile, staged) {
  writeFile(join(staged, "copyright", "index.html"), copyrightStaticHtml());
}
