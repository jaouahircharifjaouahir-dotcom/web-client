import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

/** Ahrefs "Low word count" export used ~49 content words; clear well above 100. */
const MIN_CONTENT_WORDS = 100;

/** Locales flagged in 11tik_27-aug-2026_low-word-count CSV. */
const AHREFS_FLAGGED = [
  "hu",
  "ja",
  "nl",
  "de",
  "sv",
  "da",
  "no",
  "fo",
  "io",
  "is",
  "af",
  "fy",
  "nb",
  "nn",
  "lb",
] as const;

function contentWords(html: string): number {
  const root = html.match(/<div id="yte-root">([\s\S]*?)<\/div>/)?.[1] || "";
  const text = root
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(" ").filter(Boolean).length;
}

describe("SPA shell content word count", () => {
  it("keeps Ahrefs-flagged locale homes above the low-word-count floor", () => {
    const dir = getStagedStaticSite();
    for (const code of AHREFS_FLAGGED) {
        const html = readFileSync(join(dir, "l", code, "index.html"), "utf8");
        const words = contentWords(html);
        expect(words, `${code} words=${words}`).toBeGreaterThanOrEqual(MIN_CONTENT_WORDS);
        expect(html).toContain('id="yte-root"');
        expect(html).toContain("yte-shell-guides");
      }
  });
});
