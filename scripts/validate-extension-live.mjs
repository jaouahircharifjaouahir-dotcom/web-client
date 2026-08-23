/**
 * Live validation of extension extraction (Node-compatible image probe).
 * Confirms: video ID, best thumb, copy/open URLs, i.ytimg.com-only network.
 */
import { classifyYouTubeTab, extractVideoIdFromUrl } from "../extensions/11tik-youtube-thumbnail/shared/youtube.js";
import {
  candidateUrl,
  downloadFilename,
  formatQualityLabel,
  orderedCandidates,
  rankCandidate,
  selectBestThumbnail,
} from "../extensions/11tik-youtube-thumbnail/shared/thumbnails.js";
import {
  copy11tikLink,
  copyImageUrl,
  open11tikUrl,
  openFullResolutionUrl,
} from "../extensions/11tik-youtube-thumbnail/shared/share.js";

const VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const VIMEO = "https://vimeo.com/76979871";
const ID = "dQw4w9WgXcQ";
const forbidden = [];
const seenHosts = new Set();

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  const host = new URL(url).hostname;
  seenHosts.add(host);
  if (/11tik\.com$/i.test(host) || /\/api\//i.test(url) || /blogger|googletagmanager|google-analytics/i.test(host)) {
    forbidden.push(url);
  }
  if (!/(^|\.)ytimg\.com$/i.test(host)) forbidden.push(url);
  return originalFetch(input, init);
};

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: (buf[i + 5] << 8) | buf[i + 6], width: (buf[i + 7] << 8) | buf[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}

function webpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  if (buf.toString("ascii", 12, 16) === "VP8 ") {
    return { width: buf[26] | (buf[27] << 8), height: buf[28] | (buf[29] << 8) };
  }
  if (buf.toString("ascii", 12, 16) === "VP8L") {
    const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  return null;
}

function isPlaceholder(width, height, expectedWidth) {
  if (width <= 0 || height <= 0) return true;
  if (expectedWidth >= 480 && width <= 120 && height <= 90) return true;
  return false;
}

async function probe(candidate) {
  const response = await fetch(candidate.url, { cache: "no-store" });
  if (!response.ok) return null;
  const ab = Buffer.from(await response.arrayBuffer());
  const dims = candidate.url.endsWith(".webp") ? webpSize(ab) : jpegSize(ab);
  if (!dims) return null;
  if (isPlaceholder(dims.width, dims.height, candidate.expectedWidth)) return null;
  return rankCandidate({
    ...candidate,
    width: dims.width,
    height: dims.height,
    valid: true,
    placeholder: false,
    mimeType: candidate.url.endsWith(".webp") ? "image/webp" : "image/jpeg",
  });
}

const watch = classifyYouTubeTab(VIDEO);
const vimeo = classifyYouTubeTab(VIMEO);
const videoId = extractVideoIdFromUrl(VIDEO);

const valid = [];
for (const candidate of orderedCandidates(ID)) {
  const checked = await probe(candidate);
  if (checked) valid.push(checked);
}
const best = selectBestThumbnail(valid);

const report = {
  watch,
  vimeo,
  videoId,
  best: best
    ? {
        quality: best.quality,
        width: best.width,
        height: best.height,
        label: formatQualityLabel(best),
        url: best.url,
        filename: downloadFilename(ID, best),
      }
    : null,
  validCount: valid.length,
  copyImageUrl: copyImageUrl(best),
  copy11tikLink: copy11tikLink(ID),
  open11tik: open11tikUrl(ID),
  openFull: openFullResolutionUrl(best),
  seenHosts: [...seenHosts],
  forbiddenRequests: forbidden,
  no11tikDuringExtraction: !forbidden.some((u) => /11tik\.com/i.test(u)),
  onlyYtimg: [...seenHosts].every((h) => /(^|\.)ytimg\.com$/i.test(h)),
  sampleCandidate: candidateUrl(ID, "hq720.jpg"),
};

console.log(JSON.stringify(report, null, 2));

if (
  videoId !== ID ||
  watch.kind !== "video" ||
  vimeo.kind !== "unsupported-platform" ||
  !best ||
  !report.onlyYtimg ||
  !report.no11tikDuringExtraction ||
  report.copy11tikLink !== `https://www.11tik.com/thumb/${ID}`
) {
  process.exit(1);
}
