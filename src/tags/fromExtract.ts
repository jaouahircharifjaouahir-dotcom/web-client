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
]);

function wordsFromTitle(title: string | null | undefined): string[] {
  if (!title) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of title.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) {
    if (STOP.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= 6) break;
  }
  return out;
}

export function tagsForThumbnail(result: ThumbnailExtractionResult, thumb: ThumbnailCandidate, isBest: boolean): string[] {
  const tags: string[] = [];
  const platform = result.meta?.platform ?? "youtube";
  tags.push(platform);
  if (result.type === "shorts") tags.push("shorts");
  if (result.type === "live") tags.push("live");
  if (isBest) tags.push("best");
  tags.push(thumb.quality);
  if (thumb.mimeType?.includes("webp")) tags.push("webp");
  if ((thumb.width ?? 0) >= 1280) tags.push("hd");
  if ((thumb.width ?? thumb.expectedWidth ?? 0) >= 1920) tags.push("full-hd");
  if (thumb.width && thumb.height) tags.push(`${thumb.width}x${thumb.height}`);
  tags.push(...wordsFromTitle(result.meta?.title));
  return [...new Set(tags)];
}

export function tagsForResult(result: ThumbnailExtractionResult): string[] {
  const best = result.bestThumbnail;
  if (!best) return wordsFromTitle(result.meta?.title);
  return tagsForThumbnail(result, best, true);
}
