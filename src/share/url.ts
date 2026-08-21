import { config } from "../config";
import { mediaSharePath, type MediaPlatform } from "../parsers/mediaUrl";
import type { ThumbnailExtractionResult } from "../types";

export function shareUrlForIds(platform: MediaPlatform | string, videoId: string): string {
  const p = platform === "vimeo" ? "vimeo" : "youtube";
  return `${config.publicSiteUrl}${mediaSharePath(p, videoId)}`;
}

export function shareUrlFor(result: ThumbnailExtractionResult): string {
  const platform = result.meta?.platform ?? "youtube";
  return shareUrlForIds(platform, result.videoId);
}
