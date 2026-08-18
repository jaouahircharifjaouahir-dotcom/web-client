import { describe, expect, it } from "vitest";
import { normalizeYouTubeUrl, parseMany } from "./youtubeUrl";

describe("normalizeYouTubeUrl", () => {
  it("parses watch URLs", () => {
    const parsed = normalizeYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s&list=PL123&feature=share");
    expect(parsed.valid).toBe(true);
    expect(parsed.videoId).toBe("dQw4w9WgXcQ");
    expect(parsed.type).toBe("watch");
    expect(parsed.normalizedUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("parses youtu.be", () => {
    const parsed = normalizeYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?si=abc");
    expect(parsed.valid).toBe(true);
    expect(parsed.videoId).toBe("dQw4w9WgXcQ");
    expect(parsed.type).toBe("short-url");
  });

  it("parses shorts, embed, live, and mobile hosts", () => {
    expect(normalizeYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ").type).toBe("shorts");
    expect(normalizeYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ").type).toBe("embed");
    expect(normalizeYouTubeUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ").valid).toBe(true);
    expect(normalizeYouTubeUrl("https://www.youtube.com/live/dQw4w9WgXcQ").type).toBe("live");
    expect(normalizeYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ").valid).toBe(true);
  });

  it("rejects unsupported hosts and malformed ids", () => {
    expect(normalizeYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ").valid).toBe(false);
    expect(normalizeYouTubeUrl("https://www.youtube.com/watch?v=short").valid).toBe(false);
    expect(normalizeYouTubeUrl("not a url").valid).toBe(false);
  });

  it("deduplicates bulk input", () => {
    const parsed = parseMany(`
      https://youtu.be/dQw4w9WgXcQ
      https://www.youtube.com/watch?v=dQw4w9WgXcQ
      https://example.com/x
    `);
    expect(parsed.filter((item) => item.valid)).toHaveLength(1);
    expect(parsed.some((item) => !item.valid)).toBe(true);
  });
});
