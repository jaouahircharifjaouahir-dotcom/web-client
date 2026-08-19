import type { ThumbnailCandidate, ThumbnailExtractionResult, ParsedYouTubeUrl } from "../types";
import { createAppError } from "../types/errors";
import { resultCache } from "../cache/memory";
import { config } from "../config";

interface VimeoOEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

function vimeoCandidate(url: string, quality: string, width: number | null, height: number | null): ThumbnailCandidate {
  return {
    url,
    quality,
    expectedWidth: width,
    expectedHeight: height,
    width,
    height,
    mimeType: "image/jpeg",
    valid: true,
    placeholder: false,
    score: (width ?? 0) * (height ?? 0),
    tier: (width ?? 0) >= 1280 ? "best" : (width ?? 0) >= 640 ? "high" : "standard",
    strategy: "vimeo-oembed",
    failureReason: null,
  };
}

/** Larger Vimeo CDN thumbs often use _1000x / _640 variants derived from the oEmbed URL. */
function expandVimeoThumbs(baseUrl: string, width: number | null, height: number | null): ThumbnailCandidate[] {
  const list: ThumbnailCandidate[] = [vimeoCandidate(baseUrl, "oembed", width, height)];
  const bigger = baseUrl.replace(/_\d+x\d+(?=\.\w+$)/, "_1280x720");
  if (bigger !== baseUrl) list.unshift(vimeoCandidate(bigger, "large", 1280, 720));
  const mid = baseUrl.replace(/_\d+x\d+(?=\.\w+$)/, "_640x360");
  if (mid !== baseUrl && mid !== bigger) list.push(vimeoCandidate(mid, "medium", 640, 360));
  return list;
}

async function validateRemote(candidate: ThumbnailCandidate, signal: AbortSignal): Promise<ThumbnailCandidate | null> {
  return await new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const done = (value: ThumbnailCandidate | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => {
      image.src = "";
      done(null);
    };
    const timer = window.setTimeout(() => {
      image.src = "";
      done(null);
    }, config.requestTimeoutMs);
    signal.addEventListener("abort", onAbort, { once: true });
    image.onload = () =>
      done({
        ...candidate,
        valid: true,
        width: image.naturalWidth || candidate.width,
        height: image.naturalHeight || candidate.height,
        score: (image.naturalWidth || 1) * (image.naturalHeight || 1),
      });
    image.onerror = () => done(null);
    image.referrerPolicy = "no-referrer";
    image.src = candidate.url;
  });
}

export async function extractVimeoThumbnails(
  parsed: ParsedYouTubeUrl,
  signal: AbortSignal,
  onProgress?: (result: ThumbnailExtractionResult) => void,
): Promise<ThumbnailExtractionResult> {
  if (!parsed.valid || !parsed.videoId || !parsed.normalizedUrl) {
    throw createAppError(parsed.errorCode ?? "INVALID_URL");
  }

  const cacheKey = `vimeo:${parsed.videoId}`;
  const cached = resultCache.get<ThumbnailExtractionResult>(cacheKey);
  if (cached) {
    const hit = { ...cached, cached: true };
    onProgress?.(hit);
    return hit;
  }

  const started = performance.now();
  const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(parsed.normalizedUrl)}`;
  const response = await fetch(oembed, { signal, headers: { accept: "application/json" } });
  if (!response.ok) throw createAppError("THUMBNAIL_NOT_FOUND");
  const data = (await response.json()) as VimeoOEmbed;
  if (!data.thumbnail_url) throw createAppError("THUMBNAIL_NOT_FOUND");

  const candidates = expandVimeoThumbs(data.thumbnail_url, data.thumbnail_width ?? null, data.thumbnail_height ?? null);
  const valid: ThumbnailCandidate[] = [];
  for (const candidate of candidates) {
    if (signal.aborted) break;
    const checked = await validateRemote(candidate, signal);
    if (checked) valid.push(checked);
  }
  valid.sort((a, b) => b.score - a.score);

  const result: ThumbnailExtractionResult = {
    videoId: parsed.videoId,
    normalizedUrl: parsed.normalizedUrl,
    type: parsed.type,
    thumbnails: valid,
    bestThumbnail: valid[0] ?? null,
    extractionMethod: "vimeo-oembed",
    extractionTimeMs: Math.round(performance.now() - started),
    timings: {
      parseMs: 0,
      discoveryMs: Math.round(performance.now() - started),
      validationMs: Math.round(performance.now() - started),
      totalMs: Math.round(performance.now() - started),
    },
    cached: false,
    failedCandidates: [],
    candidateUrls: candidates.map((item) => item.url),
    meta: {
      platform: "vimeo",
      title: data.title ?? null,
      authorName: data.author_name ?? null,
    },
  };

  onProgress?.(result);
  if (result.bestThumbnail) resultCache.set(cacheKey, result);
  return result;
}
