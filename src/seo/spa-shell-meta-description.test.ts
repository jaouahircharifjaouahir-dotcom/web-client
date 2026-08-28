import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import {
  META_DESCRIPTION_MAX,
  META_DESCRIPTION_MIN,
  clipDescription,
  fitDescription,
} from "../../workers/html-meta.js";
import localeMeta from "../../workers/locale-meta.json";

/** Locales + www from 11tik_27-aug-2026_meta-description-too-long export (sample). */
const AHREFS_SAMPLE = ["en", "fr", "de", "ve", "tn", "ja", "ar", "am"] as const;

function metaDescriptionFromHtml(html: string): string {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m?.[1] ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'") : "";
}

describe("SPA shell meta description length", () => {
  it("clips descriptions to the project/Ahrefs-safe max", () => {
    expect(META_DESCRIPTION_MAX).toBeLessThanOrEqual(160);
    expect(clipDescription("a".repeat(200)).length).toBe(META_DESCRIPTION_MAX);
    expect(fitDescription("tiny").length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
  });

  it("keeps generated home shells within the max for Ahrefs-flagged locales", () => {
    const dir = getStagedStaticSite();
    for (const code of AHREFS_SAMPLE) {
        const path = code === "en" ? join(dir, "index.html") : join(dir, "l", code, "index.html");
        const html = readFileSync(path, "utf8");
        const desc = metaDescriptionFromHtml(html);
        expect(desc.length, code).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
        expect(desc.length, code).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
        expect(desc.length, code).toBeLessThanOrEqual(160);
      }
      // Source locale-meta may still be long; emit path must clip.
      expect((localeMeta.en.description || "").length).toBeGreaterThan(META_DESCRIPTION_MAX);
  });
});
