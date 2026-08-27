import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Ahrefs Site Audit: "Image file size too large" (~1MB). */
const AHREFS_IMAGE_MAX_BYTES = 1024 * 1024;

const POST_HEROES = [
  "batch-hero.png",
  "maxresdefault-hero.png",
  "screenshot-vs-real-hero.png",
] as const;

const postsDir = path.resolve(process.cwd(), "public", "images", "posts");

describe("post hero image file sizes", () => {
  it("keeps the remaining oversized post heroes under the Ahrefs 1MB threshold", () => {
    expect(fs.existsSync(postsDir)).toBe(true);
    for (const name of POST_HEROES) {
      const bytes = fs.statSync(path.join(postsDir, name)).size;
      expect(bytes, name).toBeLessThanOrEqual(AHREFS_IMAGE_MAX_BYTES);
      expect(bytes, name).toBeGreaterThan(10_000);
    }
  });

  it("does not leave any public/images/posts PNG over 1MB", () => {
    const pngs = fs.readdirSync(postsDir).filter((f) => f.endsWith(".png"));
    const offenders: string[] = [];
    for (const name of pngs) {
      const bytes = fs.statSync(path.join(postsDir, name)).size;
      if (bytes > AHREFS_IMAGE_MAX_BYTES) offenders.push(`${name} (${bytes} bytes)`);
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });
});
