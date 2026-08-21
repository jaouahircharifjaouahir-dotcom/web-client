import { config } from "../config";
import { mediaSharePath, type MediaPlatform } from "../parsers/mediaUrl";
import type { ThumbnailExtractionResult } from "../types";

export function shareUrlForIds(platform: MediaPlatform | string, videoId: string): string {
  const p = platform === "vimeo" ? "vimeo" : "youtube";
  return `${config.publicSiteUrl}${mediaSharePath(p, videoId)}`;
}

export function shareUrlFor(result: ThumbnailExtractionResult): string {
  const fromMeta = result.meta?.platform;
  const platform = fromMeta === "vimeo" || fromMeta === "youtube" ? fromMeta : /^\d{6,12}$/.test(result.videoId) ? "vimeo" : "youtube";
  return shareUrlForIds(platform, result.videoId);
}
