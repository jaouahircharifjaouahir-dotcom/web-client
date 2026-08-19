import { describe, expect, it } from "vitest";
import { findKeywordLanding, KEYWORD_LANDINGS, readKeywordSlug } from "./keywordLandings";

describe("keyword landings", () => {
  it("uses unique slugs", () => {
    const slugs = KEYWORD_LANDINGS.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("looks up a landing by slug", () => {
    expect(findKeywordLanding("youtube-shorts-thumbnail")?.keyword).toContain("Shorts");
    expect(findKeywordLanding("missing")).toBeNull();
  });

  it("reads k from the query string", () => {
    expect(readKeywordSlug("?k=hd-youtube-thumbnail")).toBe("hd-youtube-thumbnail");
    expect(readKeywordSlug("")).toBeNull();
  });
});
