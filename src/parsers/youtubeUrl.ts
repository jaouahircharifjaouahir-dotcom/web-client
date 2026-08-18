import { createAppError } from "../types/errors";
import type { ParsedYouTubeUrl, YouTubeUrlType } from "../types";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

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

function extractVideoId(url: URL, type: YouTubeUrlType): string | null {
  if (type === "short-url") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  const v = url.searchParams.get("v");
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

  let url: URL;
  try {
    url = new URL(withProtocol(originalInput));
  } catch {
    return { ...empty, errorCode: "INVALID_URL" };
  }

  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) {
    return { ...empty, host, errorCode: "UNSUPPORTED_HOST" };
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
  const parts = raw
    .split(/[\n,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const results: ParsedYouTubeUrl[] = [];

  for (const part of parts) {
    const parsed = normalizeYouTubeUrl(part);
    if (parsed.valid && parsed.videoId) {
      if (seen.has(parsed.videoId)) continue;
      seen.add(parsed.videoId);
    }
    results.push(parsed);
  }

  return results;
}

export function invalidReason(parsed: ParsedYouTubeUrl): string {
  return createAppError(parsed.errorCode ?? "INVALID_URL").message;
}
