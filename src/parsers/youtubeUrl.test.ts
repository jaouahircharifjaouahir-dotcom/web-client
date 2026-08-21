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

  it("reads only the video ID and ignores extra query params", () => {
    const parsed = normalizeYouTubeUrl(
      "https://www.youtube.com/watch?v=8_hIsRHotRg&pp=ugUHEgVlbi-VUw%3D%3D",
    );
    expect(parsed.valid).toBe(true);
    expect(parsed.videoId).toBe("8_hIsRHotRg");
  });

  it("extracts IDs from bulk lines without treating the whole box as one URL", () => {
    const parsed = parseMany(`
      https://www.youtube.com/watch?v=8_hIsRHotRg&pp=ugUHEgVlbi-VUw%3D%3D
      https://youtu.be/dQw4w9WgXcQ?si=noise
    `);
    expect(parsed.filter((item) => item.valid).map((item) => item.videoId)).toEqual([
      "8_hIsRHotRg",
      "dQw4w9WgXcQ",
    ]);
  });

  it("finds the same IDs regardless of URL order", () => {
    const withPp =
      "https://www.youtube.com/watch?v=8_hIsRHotRg&pp=ugUHEgVlbi-VUw%3D%3D";
    const clean = "https://www.youtube.com/watch?v=IqRGfuXUuQY";
    const idsA = parseMany(`${withPp}\n${clean}`).map((item) => item.videoId);
    const idsB = parseMany(`${clean}\n${withPp}`).map((item) => item.videoId);
    expect(idsA).toEqual(["8_hIsRHotRg", "IqRGfuXUuQY"]);
    expect(idsB).toEqual(["IqRGfuXUuQY", "8_hIsRHotRg"]);
    expect(normalizeYouTubeUrl(`${clean}\n${withPp}`).valid).toBe(true);
    expect(normalizeYouTubeUrl(`${withPp}\n${clean}`).valid).toBe(true);
  });

  it("deduplicates bulk input", () => {
    const parsed = parseMany(`
      https://youtu.be/dQw4w9WgXcQ
      https://www.youtube.com/watch?v=dQw4w9WgXcQ
      https://example.com/x
    `);
    expect(parsed.map((item) => item.videoId)).toEqual(["dQw4w9WgXcQ"]);
  });

  it("rejects channel URLs without a video ID", () => {
    const parsed = normalizeYouTubeUrl("https://www.youtube.com/@mkbhd");
    expect(parsed.valid).toBe(false);
    expect(parsed.errorCode).toBe("CHANNEL_OR_PLAYLIST");
  });
});
