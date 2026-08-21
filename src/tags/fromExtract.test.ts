import { describe, expect, it } from "vitest";
import type { ThumbnailCandidate, ThumbnailExtractionResult } from "../types";
import { tagsForThumbnail } from "./fromExtract";

const thumb = {
  url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  quality: "maxresdefault",
  width: 1280,
  height: 720,
  mimeType: "image/jpeg",
  valid: true,
  placeholder: false,
  score: 1,
  tier: "best",
  strategy: "test",
  failureReason: null,
  expectedWidth: 1280,
  expectedHeight: 720,
} as ThumbnailCandidate;

const result = {
  videoId: "dQw4w9WgXcQ",
  type: "watch",
  meta: { platform: "youtube", title: "Never Gonna Give You Up", authorName: "Rick" },
} as ThumbnailExtractionResult;

describe("tagsForThumbnail", () => {
  it("labels quality, hd, best, and title words on each still", () => {
    const tags = tagsForThumbnail(result, thumb, true);
    expect(tags).toContain("youtube");
    expect(tags).toContain("best");
    expect(tags).toContain("maxresdefault");
    expect(tags).toContain("hd");
    expect(tags).toContain("1280x720");
    expect(tags).toContain("never");
  });
});
