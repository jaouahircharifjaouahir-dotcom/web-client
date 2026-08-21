import { describe, expect, it } from "vitest";
import { shareUrlFor, shareUrlForIds } from "./url";
import type { ThumbnailExtractionResult } from "../types";

describe("shareUrlFor", () => {
  it("uses each video id, not a shared global", () => {
    const a = { videoId: "aaaaaaaaaaa", meta: { platform: "youtube" as const, title: "A", authorName: null } } as ThumbnailExtractionResult;
    const b = { videoId: "bbbbbbbbbbb", meta: { platform: "youtube" as const, title: "B", authorName: null } } as ThumbnailExtractionResult;
    expect(shareUrlFor(a)).toContain("aaaaaaaaaaa");
    expect(shareUrlFor(b)).toContain("bbbbbbbbbbb");
    expect(shareUrlFor(a)).not.toBe(shareUrlFor(b));
  });

  it("builds a share URL from a pasted video id", () => {
    expect(shareUrlForIds("youtube", "PKuXqCCZWJ4")).toBe("https://www.11tik.com/?v=PKuXqCCZWJ4");
  });
});
