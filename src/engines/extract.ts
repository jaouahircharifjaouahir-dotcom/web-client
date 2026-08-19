import type { ThumbnailExtractionResult } from "../types";
import { thumbnailDiscoveryEngine } from "../engines/discovery";
import { resultCache } from "../cache/memory";
import type { ParsedYouTubeUrl } from "../types";
import { createAppError } from "../types/errors";
import type { ParsedMediaUrl } from "../parsers/mediaUrl";
import { extractVimeoThumbnails } from "./vimeoExtract";

export async function extractThumbnails(
  parsed: ParsedYouTubeUrl | ParsedMediaUrl,
  signal: AbortSignal,
  onProgress?: (result: ThumbnailExtractionResult) => void,
): Promise<ThumbnailExtractionResult> {
  if (!parsed.valid || !parsed.videoId || !parsed.normalizedUrl) {
    throw createAppError(parsed.errorCode ?? "INVALID_URL");
  }

  const platform = "platform" in parsed ? parsed.platform : "youtube";
  if (platform === "vimeo") {
    return extractVimeoThumbnails(parsed, signal, onProgress);
  }

  const cacheKey = parsed.videoId;
  const cached = resultCache.get<ThumbnailExtractionResult>(cacheKey);
  if (cached) {
    const hit = { ...cached, cached: true };
    onProgress?.(hit);
    return hit;
  }

  const started = performance.now();
  const parseMs = 0;
  const discoveryStarted = performance.now();

  let latest: ThumbnailExtractionResult = {
    videoId: parsed.videoId,
    normalizedUrl: parsed.normalizedUrl,
    type: parsed.type,
    thumbnails: [],
    bestThumbnail: null,
    extractionMethod: "strategy-registry",
    extractionTimeMs: 0,
    timings: { parseMs, discoveryMs: 0, validationMs: 0, totalMs: 0 },
    cached: false,
    failedCandidates: [],
    candidateUrls: [],
  };

  const { valid, failed } = await thumbnailDiscoveryEngine.discover(parsed.videoId, signal, (state) => {
    const now = performance.now();
    latest = {
      ...latest,
      thumbnails: state.valid,
      bestThumbnail: state.best,
      failedCandidates: state.failed,
      candidateUrls: [...state.valid, ...state.failed].map((item) => item.url),
      extractionTimeMs: Math.round(now - started),
      timings: {
        parseMs,
        discoveryMs: Math.round(now - discoveryStarted),
        validationMs: Math.round(now - discoveryStarted),
        totalMs: Math.round(now - started),
      },
    };
    onProgress?.(latest);
  });

  const finished = performance.now();
  const result: ThumbnailExtractionResult = {
    ...latest,
    thumbnails: valid,
    bestThumbnail: valid[0] ?? null,
    failedCandidates: failed,
    candidateUrls: [...valid, ...failed].map((item) => item.url),
    extractionTimeMs: Math.round(finished - started),
    timings: {
      parseMs,
      discoveryMs: Math.round(finished - discoveryStarted),
      validationMs: Math.round(finished - discoveryStarted),
      totalMs: Math.round(finished - started),
    },
  };

  const withMeta: ThumbnailExtractionResult = {
    ...result,
    meta: { platform: "youtube", title: null, authorName: null },
  };
  if (withMeta.bestThumbnail) resultCache.set(cacheKey, withMeta);
  return withMeta;
}
