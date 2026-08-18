import { describe, expect, it } from "vitest";
import { rankCandidate, sortRanked } from "../ranking/ranker";
import type { ThumbnailCandidate } from "../types";

function candidate(partial: Partial<ThumbnailCandidate>): ThumbnailCandidate {
  return {
    url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    quality: "hq",
    expectedWidth: 480,
    expectedHeight: 360,
    width: 480,
    height: 360,
    mimeType: "image/jpeg",
    valid: true,
    placeholder: false,
    score: 0,
    tier: "standard",
    strategy: "standard",
    failureReason: null,
    ...partial,
  };
}

describe("rankCandidate", () => {
  it("scores valid images and zeros placeholders", () => {
    const ranked = rankCandidate(candidate({ width: 1280, height: 720, expectedWidth: 1280, expectedHeight: 720, tier: "best" }));
    expect(ranked.score).toBeGreaterThan(400);
    expect(rankCandidate(candidate({ valid: false })).score).toBe(0);
  });

  it("sorts larger thumbnails first", () => {
    const sorted = sortRanked([
      rankCandidate(candidate({ width: 320, height: 180, tier: "preview" })),
      rankCandidate(candidate({ width: 1280, height: 720, tier: "best", quality: "maxres" })),
    ]);
    expect(sorted[0]?.tier).toBe("best");
  });
});
