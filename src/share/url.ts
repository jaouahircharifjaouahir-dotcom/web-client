import { config } from "../config";
import { mediaSharePath } from "../parsers/mediaUrl";
import type { ThumbnailExtractionResult } from "../types";

export function shareUrlFor(result: ThumbnailExtractionResult): string {
  const platform = result.meta?.platform ?? "youtube";
  return `${config.publicSiteUrl}${mediaSharePath(platform, result.videoId)}`;
}
