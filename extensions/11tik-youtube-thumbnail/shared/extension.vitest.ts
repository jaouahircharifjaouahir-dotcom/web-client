import { describe, expect, it } from "vitest";
import { normalizeYouTubeUrl as siteNormalize } from "../../../src/parsers/youtubeUrl.ts";
import { normalizeYouTubeUrl as extNormalize, extractVideoIdFromUrl } from "./youtube.js";

const CASES = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s",
  "https://youtu.be/dQw4w9WgXcQ?si=abc",
  "https://youtube.com/shorts/dQw4w9WgXcQ",
  "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=8_hIsRHotRg&pp=ugUHEgVlbi-VUw%3D%3D",
  "https://www.youtube.com/@mkbhd",
  "https://vimeo.com/76979871",
  "https://example.com/watch?v=dQw4w9WgXcQ",
];

describe("extension parser parity with website parser", () => {
  for (const input of CASES) {
    it(`matches website parser for ${input}`, () => {
      const site = siteNormalize(input);
      const ext = extNormalize(input);
      expect(ext.valid).toBe(site.valid);
      expect(ext.videoId).toBe(site.videoId);
      if (!site.valid) {
        expect(ext.errorCode).toBe(site.errorCode);
      }
    });
  }

  it("extractVideoIdFromUrl matches valid website IDs", () => {
    for (const input of CASES) {
      const site = siteNormalize(input);
      expect(extractVideoIdFromUrl(input)).toBe(site.valid ? site.videoId : null);
    }
  });
});
