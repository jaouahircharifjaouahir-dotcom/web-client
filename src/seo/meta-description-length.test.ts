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
import { descriptionForPath } from "../../workers/post-descriptions.js";
import localeMeta from "../../workers/locale-meta.json";

function metaDescriptionFromHtml(html: string): string {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m?.[1]
    ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    : "";
}

describe("Meta description length band (Ahrefs File 12 + 19)", () => {
  it("clips long and pads short into 120–150", () => {
    expect(META_DESCRIPTION_MIN).toBe(120);
    expect(META_DESCRIPTION_MAX).toBe(150);
    expect(clipDescription("a".repeat(200)).length).toBe(META_DESCRIPTION_MAX);
    expect(fitDescription("short").length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
    expect(fitDescription("short").length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(fitDescription("a".repeat(200)).length).toBe(META_DESCRIPTION_MAX);
  });

  it("clears File 19 URLs: zh, ii homes and keyword-tools", () => {
    expect(fitDescription(localeMeta.zh.description).length).toBeGreaterThanOrEqual(
      META_DESCRIPTION_MIN,
    );
    expect(fitDescription(localeMeta.ii.description).length).toBeGreaterThanOrEqual(
      META_DESCRIPTION_MIN,
    );
    const kw = descriptionForPath("/p/keyword-tools.html");
    expect(kw.length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
    expect(kw.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
  });

  it("emits SPA shells in the Ahrefs-safe band for flagged locales", () => {
    const dir = getStagedStaticSite();
    for (const code of ["zh", "ii", "en", "fr"] as const) {
        const path =
          code === "en" ? join(dir, "index.html") : join(dir, "l", code, "index.html");
        const desc = metaDescriptionFromHtml(readFileSync(path, "utf8"));
        expect(desc.length, code).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
        expect(desc.length, code).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
      }
  });
});
