import type { ThumbnailCandidate, ThumbnailExtractionResult, ParsedYouTubeUrl } from "../types";
import { createAppError } from "../types/errors";
import { resultCache } from "../cache/memory";
import { validateThumbnail } from "../validators/thumbnail";

interface VimeoOEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

const VIMEO_SIZES: { token: string; quality: string; width: number; height: number }[] = [
  { token: "1920x1080", quality: "x-large", width: 1920, height: 1080 },
  { token: "1920", quality: "1920", width: 1920, height: 1080 },
  { token: "1280x720", quality: "large", width: 1280, height: 720 },
  { token: "1280", quality: "1280", width: 1280, height: 720 },
  { token: "640", quality: "medium", width: 640, height: 360 },
];

function vimeoCandidate(url: string, quality: string, width: number | null, height: number | null): ThumbnailCandidate {
  const w = width ?? 0;
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
    score: w * (height ?? 0),
    tier: w >= 1920 ? "best" : w >= 1280 ? "high" : w >= 640 ? "standard" : "preview",
    strategy: "vimeo-cdn",
    failureReason: null,
  };
}

export function withVimeoSize(url: string, token: string): string {
  const [path, query] = url.split("?");
  let next = path.replace(/-d_\d+(x\d+)?$/i, `-d_${token}`);
  if (next === path) {
    next = path.replace(/_\d+x\d+(?=\.\w+$)/, `_${token}`);
  }
  return query ? `${next}?${query}` : next;
}

/** Prefer 1920×1080 (X-Large) then other public Vimeo CDN sizes derived from oEmbed. */
export function expandVimeoThumbs(baseUrl: string): ThumbnailCandidate[] {
  const seen = new Set<string>();
  const list: ThumbnailCandidate[] = [];
  for (const size of VIMEO_SIZES) {
    const url = withVimeoSize(baseUrl, size.token);
    if (seen.has(url)) continue;
    seen.add(url);
    list.push(vimeoCandidate(url, size.quality, size.width, size.height));
  }
  if (!seen.has(baseUrl)) {
    list.push(vimeoCandidate(baseUrl, "oembed", null, null));
  }
  return list;
}

async function validateRemote(candidate: ThumbnailCandidate, signal: AbortSignal): Promise<ThumbnailCandidate | null> {
  const checked = await validateThumbnail(candidate, signal);
  if (!checked.valid || !checked.width) return null;
  const w = checked.width;
  const h = checked.height ?? 0;
  return {
    ...checked,
    score: w * (h || 1),
    tier: w >= 1920 ? "best" : w >= 1280 ? "high" : w >= 640 ? "standard" : "preview",
    quality: w >= 1920 ? "x-large" : w >= 1280 ? "large" : checked.quality,
  };
}

export async function extractVimeoThumbnails(
  parsed: ParsedYouTubeUrl,
  signal: AbortSignal,
  onProgress?: (result: ThumbnailExtractionResult) => void,
): Promise<ThumbnailExtractionResult> {
  if (!parsed.valid || !parsed.videoId || !parsed.normalizedUrl) {
    throw createAppError(parsed.errorCode ?? "INVALID_URL");
  }

  const cacheKey = `vimeo:xl:${parsed.videoId}`;
  const cached = resultCache.get<ThumbnailExtractionResult>(cacheKey);
  if (cached) {
    const hit = { ...cached, cached: true };
    onProgress?.(hit);
    return hit;
  }

  const started = performance.now();
  const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(parsed.normalizedUrl)}&width=1920`;
  const response = await fetch(oembed, { signal, headers: { accept: "application/json" } });
  if (!response.ok) throw createAppError("THUMBNAIL_NOT_FOUND");
  const data = (await response.json()) as VimeoOEmbed;
  if (!data.thumbnail_url) throw createAppError("THUMBNAIL_NOT_FOUND");

  const candidates = expandVimeoThumbs(data.thumbnail_url);
  const checked = await Promise.all(candidates.map((candidate) => validateRemote(candidate, signal)));
  const valid = checked
    .filter((item): item is ThumbnailCandidate => Boolean(item))
    .filter((item, index, all) => all.findIndex((other) => other.width === item.width && other.height === item.height) === index);
  valid.sort((a, b) => b.score - a.score);

  const result: ThumbnailExtractionResult = {
    videoId: parsed.videoId,
    normalizedUrl: parsed.normalizedUrl,
    type: parsed.type,
    thumbnails: valid,
    bestThumbnail: valid[0] ?? null,
    extractionMethod: "vimeo-cdn",
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
