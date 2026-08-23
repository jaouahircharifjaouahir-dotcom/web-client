/**
 * YouTube-only URL parsing for the 11tik extension.
 * Logic mirrors src/parsers/youtubeUrl.ts (keep in sync).
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIDEO_ID_IN_TEXT_RE =
  /(?:youtube\.com\/watch\?(?:[^ \n]*?[&?])?v=|youtube\.com\/(?:shorts|embed|live)\/|youtu\.be\/|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{11})/i;

const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function withProtocol(input) {
  const trimmed = String(input || "").trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

function classify(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (host === "youtu.be" || host === "www.youtu.be") return "short-url";
  if (path.startsWith("/shorts/")) return "shorts";
  if (path.startsWith("/embed/")) return "embed";
  if (path.startsWith("/live/")) return "live";
  if (path.startsWith("/watch") || url.searchParams.has("v")) return "watch";
  return "unknown";
}

function extractVideoId(url, type) {
  if (type === "short-url") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  const v = url.searchParams.get("v")?.split("&")[0] ?? "";
  if (v && VIDEO_ID_RE.test(v)) return v;

  const parts = url.pathname.split("/").filter(Boolean);
  if (type === "shorts" || type === "embed" || type === "live") {
    const id = parts[1] ?? "";
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  if (parts[0] && VIDEO_ID_RE.test(parts[0]) && parts.length === 1) {
    return parts[0];
  }

  return null;
}

export function isYouTubeHostUrl(input) {
  const raw = String(input || "").trim().toLowerCase();
  return (
    raw.includes("youtube.com") ||
    raw.includes("youtu.be") ||
    raw.includes("youtube-nocookie.com")
  );
}

export function isUnsupportedPlatformUrl(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return false;
  if (isYouTubeHostUrl(raw)) return false;
  return raw.includes("vimeo.com") || raw.includes("dailymotion.com") || /^https?:\/\//i.test(raw);
}

export function extractVideoIdFromText(raw) {
  const globalRe = new RegExp(VIDEO_ID_IN_TEXT_RE.source, "gi");
  for (const match of String(raw || "").matchAll(globalRe)) {
    const id = match[1] ?? "";
    if (VIDEO_ID_RE.test(id)) return id;
  }
  for (const line of String(raw || "").split(/[\n,;]+/)) {
    const trimmed = line.trim();
    if (VIDEO_ID_RE.test(trimmed)) return trimmed;
  }
  return null;
}

/** Same result shape as the website normalizeYouTubeUrl, simplified for extension use. */
export function normalizeYouTubeUrl(input) {
  const originalInput = String(input || "").trim();
  const empty = {
    valid: false,
    videoId: null,
    type: "unknown",
    host: null,
    errorCode: "INVALID_URL",
  };

  if (!originalInput) return empty;

  const firstId = extractVideoIdFromText(originalInput);
  if (firstId) {
    try {
      const firstLine = originalInput.split(/[\n\r]+/).find((line) => line.includes(firstId)) ?? originalInput;
      const url = new URL(withProtocol(firstLine.trim().split(/\s+/)[0] ?? firstLine));
      const type = HOSTS.has(url.hostname.toLowerCase()) ? classify(url) : "watch";
      return {
        valid: true,
        videoId: firstId,
        type: type === "unknown" ? "watch" : type,
        host: url.hostname.toLowerCase(),
        errorCode: null,
      };
    } catch {
      return { valid: true, videoId: firstId, type: "watch", host: "www.youtube.com", errorCode: null };
    }
  }

  let url;
  try {
    url = new URL(withProtocol(originalInput));
  } catch {
    return empty;
  }

  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) {
    return { ...empty, host, errorCode: "UNSUPPORTED_HOST" };
  }

  const path = url.pathname.toLowerCase();
  if (
    path.startsWith("/channel/") ||
    path.startsWith("/c/") ||
    path.startsWith("/user/") ||
    path.startsWith("/playlist") ||
    path.startsWith("/@")
  ) {
    return { ...empty, host, type: "unknown", errorCode: "CHANNEL_OR_PLAYLIST" };
  }

  const type = classify(url);
  const videoId = extractVideoId(url, type);
  if (!videoId) {
    return {
      ...empty,
      type,
      host,
      errorCode: type === "unknown" ? "UNSUPPORTED_HOST" : "INVALID_VIDEO_ID",
    };
  }

  return {
    valid: true,
    videoId,
    type: type === "unknown" ? "watch" : type,
    host,
    errorCode: null,
  };
}

export function extractVideoIdFromUrl(input) {
  const parsed = normalizeYouTubeUrl(input);
  return parsed.valid ? parsed.videoId : null;
}

/** Classify the active tab for popup error messaging. */
export function classifyYouTubeTab(url) {
  const raw = String(url || "").trim();
  if (!raw) return { kind: "no-tab", message: "No active tab found." };

  if (isUnsupportedPlatformUrl(raw) && !isYouTubeHostUrl(raw)) {
    return { kind: "unsupported-platform", message: "11tik supports YouTube only." };
  }

  if (!isYouTubeHostUrl(raw)) {
    return {
      kind: "not-youtube",
      message: "Open a YouTube video page, then click 11tik again.",
    };
  }

  let parsed;
  try {
    parsed = normalizeYouTubeUrl(raw);
  } catch {
    parsed = { valid: false, errorCode: "INVALID_URL" };
  }

  if (parsed.valid && parsed.videoId) {
    return { kind: "video", videoId: parsed.videoId, message: null };
  }

  let pathname = "/";
  try {
    pathname = new URL(raw).pathname.toLowerCase();
  } catch {
    return { kind: "invalid-url", message: "This YouTube URL is not valid." };
  }

  if (pathname === "/" || pathname === "") {
    return { kind: "homepage", message: "Open a specific YouTube video, not the homepage." };
  }
  if (pathname.startsWith("/results") || pathname.startsWith("/search")) {
    return { kind: "search", message: "Open a specific YouTube video from search results." };
  }
  if (parsed.errorCode === "CHANNEL_OR_PLAYLIST") {
    return { kind: "channel", message: "Channel and playlist pages have no single video ID." };
  }
  if (parsed.errorCode === "INVALID_VIDEO_ID") {
    return { kind: "invalid-video-id", message: "Could not find a valid 11-character YouTube video ID." };
  }

  return { kind: "missing-video-id", message: "Could not find a YouTube video ID on this page." };
}
