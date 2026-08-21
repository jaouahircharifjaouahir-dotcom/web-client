import { describe, expect, it } from "vitest";
import { combineThumbnailScore, resolutionScore } from "./thumbnailScore";

describe("thumbnailScore", () => {
  it("scores maxres higher than hq", () => {
    expect(resolutionScore(1280, 720)).toBeGreaterThan(resolutionScore(480, 360));
    expect(combineThumbnailScore(100, 50)).toBe(83);
  });
});
