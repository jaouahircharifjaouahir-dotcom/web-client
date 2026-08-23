import { config } from "../config";
import { publicOrigin } from "../i18n/ui";
import { mediaSharePath } from "../parsers/mediaUrl";
import type { ThumbnailExtractionResult } from "../types";

export function shareUrlForIds(_platform: string, videoId: string, origin: string = config.publicSiteUrl): string {
  return `${origin}${mediaSharePath("youtube", videoId)}`;
}

export function shareUrlFor(result: ThumbnailExtractionResult): string {
  return shareUrlForIds("youtube", result.videoId, publicOrigin());
}
