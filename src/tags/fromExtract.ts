import type { ThumbnailCandidate, ThumbnailExtractionResult } from "../types";

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "you",
  "your",
  "are",
  "was",
  "official",
  "video",
  "feat",
  "ft",
  "youtube",
  "vimeo",
  "watch",
]);

function slugWords(value: string | null | undefined, limit: number): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []) {
    if (STOP.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= limit) break;
  }
  return out;
}

/** Video-specific labels first so two extracts never look like the same chip row. */
export function tagsForThumbnail(result: ThumbnailExtractionResult, thumb: ThumbnailCandidate, _isBest: boolean): string[] {
  const tags: string[] = [];
  tags.push(...slugWords(result.meta?.title, 5));
  tags.push(...slugWords(result.meta?.authorName, 2));
  if (result.videoId) tags.push(result.videoId);
  if (result.type === "shorts") tags.push("shorts");
  if (result.type === "live") tags.push("live");
  if (thumb.quality && !tags.includes(thumb.quality)) tags.push(thumb.quality);
  return [...new Set(tags)];
}

export function tagsForResult(result: ThumbnailExtractionResult): string[] {
  const best = result.bestThumbnail;
  if (!best) return slugWords(result.meta?.title, 6);
  return tagsForThumbnail(result, best, true);
}
