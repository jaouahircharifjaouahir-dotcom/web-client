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

function result(id: string, title: string, author: string): ThumbnailExtractionResult {
  return {
    videoId: id,
    type: "watch",
    meta: { platform: "youtube", title, authorName: author },
  } as ThumbnailExtractionResult;
}

describe("tagsForThumbnail", () => {
  it("uses title, author, and video id so two videos do not share the same chips", () => {
    const a = tagsForThumbnail(result("dQw4w9WgXcQ", "Never Gonna Give You Up", "Rick Astley"), thumb, true);
    const b = tagsForThumbnail(result("jNQXAC9IVRw", "Me at the zoo", "jawed"), thumb, true);
    expect(a).toContain("never");
    expect(a).toContain("dQw4w9WgXcQ");
    expect(a).toContain("rick");
    expect(b).toContain("zoo");
    expect(b).toContain("jNQXAC9IVRw");
    expect(a.join(" ")).not.toBe(b.join(" "));
  });

  it("keeps non-latin title words", () => {
    const tags = tagsForThumbnail(result("MtnYBHslkKw", "وثائقي عن الصحراء", "قناة تجريبية"), thumb, true);
    expect(tags.some((tag) => tag.includes("وثائق") || tag === "وثائقي")).toBe(true);
    expect(tags).toContain("MtnYBHslkKw");
  });
});
