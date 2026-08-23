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
  "watch",
]);

export function displayTag(value: string): string {
  return String(value || "")
    .trim()
    .replace(/^#+/, "")
    .trim();
}

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

/** Prefer the video's published YouTube tags; fall back to title words only if none exist. */
export function tagsForThumbnail(result: ThumbnailExtractionResult, thumb: ThumbnailCandidate, _isBest: boolean): string[] {
  const published = (result.meta?.tags || []).map(displayTag).filter(Boolean);
  if (published.length) {
    const tags = [...published];
    if (result.type === "shorts" && !tags.some((tag) => tag.toLowerCase() === "shorts")) tags.push("shorts");
    if (result.type === "live" && !tags.some((tag) => tag.toLowerCase() === "live")) tags.push("live");
    return [...new Set(tags)].slice(0, 40);
  }
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
  const published = (result.meta?.tags || []).map(displayTag).filter(Boolean);
  if (published.length) return [...new Set(published)].slice(0, 40);
  const best = result.bestThumbnail;
  if (!best) return slugWords(result.meta?.title, 6);
  return tagsForThumbnail(result, best, true);
}
