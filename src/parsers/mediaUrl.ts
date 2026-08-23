import { parseThumbPath, thumbPath } from "../routing/thumb";
import type { AppErrorCode, ParsedYouTubeUrl, YouTubeUrlType } from "../types";
import { createAppError } from "../types/errors";
import { normalizeYouTubeUrl, parseMany as parseYouTubeMany, isLikelyYouTubeUrl } from "./youtubeUrl";

export type MediaPlatform = "youtube";

export type ParsedMediaUrl = ParsedYouTubeUrl & {
  platform: MediaPlatform;
};

export function isLikelyMediaUrl(raw: string): boolean {
  return isLikelyYouTubeUrl(raw);
}

export function normalizeMediaUrl(raw: string): ParsedMediaUrl {
  const youtube = normalizeYouTubeUrl(raw.trim());
  return { ...youtube, platform: "youtube" };
}

export function parseMediaMany(raw: string): ParsedMediaUrl[] {
  const youtube = parseYouTubeMany(raw).map((item) => ({ ...item, platform: "youtube" as const }));
  const seen = new Set<string>();
  const out: ParsedMediaUrl[] = [];
  for (const item of youtube) {
    if (!item.valid || !item.videoId) continue;
    if (seen.has(item.videoId)) continue;
    seen.add(item.videoId);
    out.push(item);
  }
  return out;
}

export function mediaSharePath(_platform: MediaPlatform, videoId: string): string {
  return thumbPath("youtube", videoId);
}

export function readDeepLink(
  search = typeof location === "undefined" ? "" : location.search,
  pathname = typeof location === "undefined" ? "/" : location.pathname,
): {
  platform: MediaPlatform;
  videoId: string;
} | null {
  const fromPath = parseThumbPath(pathname);
  if (fromPath) return fromPath;
  try {
    const params = new URLSearchParams(search);
    const youtube = params.get("v");
    if (youtube && /^[A-Za-z0-9_-]{11}$/.test(youtube)) return { platform: "youtube", videoId: youtube };
    return null;
  } catch {
    return null;
  }
}

export function unsupportedHostMessage(code: AppErrorCode | null): string {
  return createAppError(code ?? "INVALID_URL").message;
}

export type { YouTubeUrlType };
