import { createAppError } from "../types/errors";
import type { ParsedYouTubeUrl, YouTubeUrlType } from "../types";

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

function withProtocol(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

function parsedFromId(videoId: string, originalInput: string): ParsedYouTubeUrl {
  return {
    valid: true,
    videoId,
    type: "watch",
    host: "www.youtube.com",
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    originalInput,
    errorCode: null,
  };
}

/** Collect every 11-character YouTube video ID; ignore extra query params and URL order. */
export function extractVideoIds(raw: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  const globalRe = new RegExp(VIDEO_ID_IN_TEXT_RE.source, "gi");

  for (const match of raw.matchAll(globalRe)) {
    const id = match[1] ?? "";
    if (!VIDEO_ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  for (const line of raw.split(/[\n,;]+/)) {
    const trimmed = line.trim();
    if (!VIDEO_ID_RE.test(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ids.push(trimmed);
  }

  return ids;
}

function extractVideoId(url: URL, type: YouTubeUrlType): string | null {
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

function classify(url: URL): YouTubeUrlType {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  if (host === "youtu.be" || host === "www.youtu.be") return "short-url";
  if (path.startsWith("/shorts/")) return "shorts";
  if (path.startsWith("/embed/")) return "embed";
  if (path.startsWith("/live/")) return "live";
  if (path.startsWith("/watch") || url.searchParams.has("v")) return "watch";
  return "unknown";
}

export function isLikelyYouTubeUrl(input: string): boolean {
  const raw = input.trim();
  if (!raw) return false;
  const lowered = raw.toLowerCase();
  return (
    lowered.includes("youtube.com") ||
    lowered.includes("youtu.be") ||
    lowered.includes("youtube-nocookie.com")
  );
}

export function normalizeYouTubeUrl(input: string): ParsedYouTubeUrl {
  const originalInput = input.trim();
  const empty: ParsedYouTubeUrl = {
    valid: false,
    videoId: null,
    type: "unknown",
    host: null,
    normalizedUrl: null,
    originalInput,
    errorCode: "INVALID_URL",
  };

  if (!originalInput) return empty;

  const firstId = extractVideoIds(originalInput)[0];
  if (firstId) {
    const firstLine = originalInput.split(/[\n\r]+/).find((line) => line.includes(firstId)) ?? originalInput;
    try {
      const url = new URL(withProtocol(firstLine.trim().split(/\s+/)[0] ?? firstLine));
      const type = HOSTS.has(url.hostname.toLowerCase()) ? classify(url) : "watch";
      return {
        ...parsedFromId(firstId, originalInput),
        type: type === "unknown" ? "watch" : type,
        host: url.hostname.toLowerCase(),
      };
    } catch {
      return parsedFromId(firstId, originalInput);
    }
  }

  if (originalInput.includes("\n") || originalInput.includes("\r")) {
    return { ...empty, errorCode: "INVALID_URL" };
  }

  let url: URL | null = null;
  try {
    url = new URL(withProtocol(originalInput));
  } catch {
    return { ...empty, errorCode: "INVALID_URL" };
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
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    originalInput,
    errorCode: null,
  };
}

export function parseMany(raw: string): ParsedYouTubeUrl[] {
  return extractVideoIds(raw).map((id) => parsedFromId(id, raw));
}

export function invalidReason(parsed: ParsedYouTubeUrl): string {
  return createAppError(parsed.errorCode ?? "INVALID_URL").message;
}
