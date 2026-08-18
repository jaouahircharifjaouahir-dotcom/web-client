import type { ThumbnailCandidate, ThumbnailTier } from "../types";

const TIER_SCORE: Record<ThumbnailTier, number> = {
  best: 400,
  high: 250,
  standard: 120,
  preview: 40,
};

export function rankCandidate(candidate: ThumbnailCandidate): ThumbnailCandidate {
  if (!candidate.valid || candidate.placeholder) {
    return { ...candidate, score: 0 };
  }

  const pixels = (candidate.width ?? 0) * (candidate.height ?? 0);
  const expected = (candidate.expectedWidth ?? 0) * (candidate.expectedHeight ?? 0);
  const matchBonus = expected && pixels >= expected * 0.85 ? 80 : 0;
  const webpPenalty = candidate.url.endsWith(".webp") ? -8 : 0;
  const score = TIER_SCORE[candidate.tier] + Math.round(pixels / 1000) + matchBonus + webpPenalty;

  let tier = candidate.tier;
  if ((candidate.width ?? 0) >= 1280) tier = "best";
  else if ((candidate.width ?? 0) >= 640) tier = "high";
  else if ((candidate.width ?? 0) >= 480) tier = "standard";
  else tier = "preview";

  return { ...candidate, score, tier };
}

export function sortRanked(candidates: ThumbnailCandidate[]): ThumbnailCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score || (b.width ?? 0) - (a.width ?? 0));
}
