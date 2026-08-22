import { describe, expect, it } from "vitest";
import { bulkResultsCsv } from "./csv";
import type { ThumbnailExtractionResult } from "../types";

const sample = {
  videoId: "dQw4w9WgXcQ",
  normalizedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  meta: { platform: "youtube", title: "Demo", authorName: null },
  bestThumbnail: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg", quality: "maxres", width: 1280, height: 720 },
} as ThumbnailExtractionResult;

describe("bulkResultsCsv", () => {
  it("includes a unique share URL per video id", () => {
    const csv = bulkResultsCsv([sample]);
    expect(csv).toContain("dQw4w9WgXcQ");
    expect(csv).toContain("https://www.11tik.com/thumb/dQw4w9WgXcQ");
    expect(csv).toContain("Demo");
  });
});
