import { describe, expect, it } from "vitest";
import { imageSeoAttrs } from "./imageAttrs";

describe("imageSeoAttrs", () => {
  it("puts the video title, quality, and tags into alt and title", () => {
    const attrs = imageSeoAttrs({
      title: "Despacito",
      quality: "maxresdefault",
      tags: ["Luis Fonsi", "Official Music Video"],
    });
    expect(attrs.alt).toContain("Despacito");
    expect(attrs.alt).toContain("maxresdefault");
    expect(attrs.title).toContain("Luis Fonsi");
  });
});
