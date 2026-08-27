import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Ahrefs Site Audit: "Image file size too large" (~1MB). */
const AHREFS_IMAGE_MAX_BYTES = 1024 * 1024;

/** Flagged in 11tik_27-aug-2026_image-file-size-too-large export. */
const AHREFS_FLAGGED = [
  "youtube-thumbnail-channel-extract.png",
  "youtube-thumbnail-iphone-android.png",
  "youtube-live-premiere-thumbnail-lifecycle.png",
  "youtube-live-thumbnail-extract-workflow.png",
] as const;

const blogDir = path.resolve(process.cwd(), "public", "images", "blog");

describe("blog hero image file sizes", () => {
  it("keeps every public/images/blog PNG under the Ahrefs 1MB threshold", () => {
    const pngs = fs.readdirSync(blogDir).filter((f) => f.endsWith(".png"));
    expect(pngs.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const name of pngs) {
      const bytes = fs.statSync(path.join(blogDir, name)).size;
      if (bytes > AHREFS_IMAGE_MAX_BYTES) {
        offenders.push(`${name} (${bytes} bytes)`);
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("keeps the Ahrefs-flagged heroes well under 1MB after optimize", () => {
    for (const name of AHREFS_FLAGGED) {
      const bytes = fs.statSync(path.join(blogDir, name)).size;
      expect(bytes, name).toBeLessThanOrEqual(AHREFS_IMAGE_MAX_BYTES);
      expect(bytes, name).toBeGreaterThan(10_000);
    }
  });
});
