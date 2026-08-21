import type { AppErrorCode, ParsedYouTubeUrl, YouTubeUrlType } from "../types";
import { createAppError } from "../types/errors";
import { normalizeYouTubeUrl, parseMany as parseYouTubeMany, isLikelyYouTubeUrl } from "./youtubeUrl";
import { normalizeVimeoUrl, isLikelyVimeoUrl, parseVimeoMany } from "./vimeoUrl";

export type MediaPlatform = "youtube" | "vimeo";

export type ParsedMediaUrl = ParsedYouTubeUrl & {
  platform: MediaPlatform;
};

export function isLikelyMediaUrl(raw: string): boolean {
  return isLikelyYouTubeUrl(raw) || isLikelyVimeoUrl(raw);
}

export function normalizeMediaUrl(raw: string): ParsedMediaUrl {
  const trimmed = raw.trim();
  if (/vimeo\.com/i.test(trimmed) || /^\d{6,12}$/.test(trimmed)) {
    const vimeo = normalizeVimeoUrl(trimmed);
    if (vimeo.valid) return { ...vimeo, platform: "vimeo" };
  }
  const youtube = normalizeYouTubeUrl(trimmed);
  return { ...youtube, platform: "youtube" };
}

export function parseMediaMany(raw: string): ParsedMediaUrl[] {
  const youtube = parseYouTubeMany(raw).map((item) => ({ ...item, platform: "youtube" as const }));
  const vimeo = parseVimeoMany(raw).map((item) => ({ ...item, platform: "vimeo" as const }));
  const seen = new Set<string>();
  const out: ParsedMediaUrl[] = [];
  for (const item of [...youtube, ...vimeo]) {
    if (!item.valid || !item.videoId) continue;
    const key = `${item.platform}:${item.videoId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function mediaSharePath(platform: MediaPlatform, videoId: string): string {
  if (platform === "vimeo") return `/?vimeo=${encodeURIComponent(videoId)}`;
  return `/?v=${encodeURIComponent(videoId)}`;
}

export function readDeepLink(search = typeof location === "undefined" ? "" : location.search): {
  platform: MediaPlatform;
  videoId: string;
} | null {
  try {
    const params = new URLSearchParams(search);
    const youtube = params.get("v");
    if (youtube && /^[A-Za-z0-9_-]{11}$/.test(youtube)) return { platform: "youtube", videoId: youtube };
    const vimeo = params.get("vimeo");
    if (vimeo && /^\d{6,12}$/.test(vimeo)) return { platform: "vimeo", videoId: vimeo };
    return null;
  } catch {
    return null;
  }
}

export function unsupportedHostMessage(code: AppErrorCode | null): string {
  return createAppError(code ?? "INVALID_URL").message;
}

export type { YouTubeUrlType };
