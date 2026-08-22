import { describe, expect, it } from "vitest";
import { extractVimeoIds, isLikelyVimeoUrl, normalizeVimeoUrl } from "./vimeoUrl";
import { normalizeMediaUrl, parseMediaMany, readDeepLink, mediaSharePath } from "./mediaUrl";

describe("vimeo parser", () => {
  it("reads numeric ids and player URLs", () => {
    expect(normalizeVimeoUrl("https://vimeo.com/22439234").videoId).toBe("22439234");
    expect(normalizeVimeoUrl("https://player.vimeo.com/video/22439234").valid).toBe(true);
    expect(isLikelyVimeoUrl("vimeo.com/123456789")).toBe(true);
    expect(extractVimeoIds("see https://vimeo.com/22439234\n99887766")).toEqual(["22439234", "99887766"]);
  });
});

describe("media router", () => {
  it("routes youtube and vimeo", () => {
    expect(normalizeMediaUrl("https://youtu.be/dQw4w9WgXcQ").platform).toBe("youtube");
    expect(normalizeMediaUrl("https://vimeo.com/22439234").platform).toBe("vimeo");
    expect(normalizeMediaUrl("https://player.vimeo.com/video/1191500052").platform).toBe("vimeo");
    expect(normalizeMediaUrl("https://vimeo.com/1191500052").videoId).toBe("1191500052");
    expect(parseMediaMany("https://youtu.be/dQw4w9WgXcQ\nhttps://vimeo.com/22439234").length).toBe(2);
  });

  it("builds deep links", () => {
    expect(mediaSharePath("youtube", "dQw4w9WgXcQ")).toBe("/thumb/dQw4w9WgXcQ");
    expect(mediaSharePath("vimeo", "22439234")).toBe("/thumb/vimeo/22439234");
    expect(readDeepLink("?v=dQw4w9WgXcQ")).toEqual({ platform: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(readDeepLink("?vimeo=22439234")).toEqual({ platform: "vimeo", videoId: "22439234" });
    expect(readDeepLink("", "/thumb/dQw4w9WgXcQ")).toEqual({ platform: "youtube", videoId: "dQw4w9WgXcQ" });
  });
});
