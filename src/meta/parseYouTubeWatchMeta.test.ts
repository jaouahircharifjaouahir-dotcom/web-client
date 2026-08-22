import { describe, expect, it } from "vitest";
import { parseYouTubeWatchMeta } from "../../workers/library.js";

describe("parseYouTubeWatchMeta", () => {
  it("reads comma-separated keywords meta", () => {
    const html = `<meta name="keywords" content="Luis Fonsi, Despacito, Official Music Video">
<meta name="title" content="Luis Fonsi - Despacito">`;
    expect(parseYouTubeWatchMeta(html)).toEqual({
      title: "Luis Fonsi - Despacito",
      authorName: "",
      tags: ["Luis Fonsi", "Despacito", "Official Music Video"],
    });
  });

  it("strips leading hashtags from keywords", () => {
    const html = `<meta name="keywords" content="#Luis, ##Despacito">`;
    expect(parseYouTubeWatchMeta(html).tags).toEqual(["Luis", "Despacito"]);
  });

  it("reads ytInitialData keywords array", () => {
    const html = `"keywords":["one","two","three"]`;
    expect(parseYouTubeWatchMeta(html).tags).toEqual(["one", "two", "three"]);
  });
});
