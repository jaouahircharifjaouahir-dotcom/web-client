import { describe, expect, it } from "vitest";
import { normalizeMediaUrl, parseMediaMany, readDeepLink, mediaSharePath } from "./mediaUrl";

describe("media router", () => {
  it("routes YouTube only", () => {
    expect(normalizeMediaUrl("https://youtu.be/dQw4w9WgXcQ").platform).toBe("youtube");
    expect(normalizeMediaUrl("https://vimeo.com/22439234").valid).toBe(false);
    expect(parseMediaMany("https://youtu.be/dQw4w9WgXcQ\nhttps://vimeo.com/22439234").length).toBe(1);
  });

  it("builds YouTube deep links", () => {
    expect(mediaSharePath("youtube", "dQw4w9WgXcQ")).toBe("/thumb/dQw4w9WgXcQ");
    expect(readDeepLink("?v=dQw4w9WgXcQ")).toEqual({ platform: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(readDeepLink("?vimeo=22439234")).toBeNull();
    expect(readDeepLink("", "/thumb/dQw4w9WgXcQ")).toEqual({ platform: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(readDeepLink("", "/thumb/vimeo/22439234")).toBeNull();
  });
});
