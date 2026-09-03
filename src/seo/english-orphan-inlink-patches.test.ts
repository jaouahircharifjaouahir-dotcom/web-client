import { describe, expect, it } from "vitest";
import {
  applyEnglishOrphanInlinkPatches,
  countEnglishOrphanInlinkPatches,
  migrateOrphanPatchAnchorHrefs,
} from "../../scripts/i18n/render-english-static.mjs";

const HOWTO_BEFORE_1 =
  "Channel or playlist URLs without a video ID will not yield a single thumbnail. For many video links at once, use Bulk (up to 50) — see <a href=\"https://www.11tik.com/how-to-batch-download-youtube\">batch download</a>. Working from a channel page with individual watch URLs: <a href=\"https://www.11tik.com/how-to-extract-thumbnails-from-youtube\">channel thumbnail guide</a>.";
const HOWTO_AFTER_1 =
  "Channel or playlist URLs without a video ID will not yield a single thumbnail. For live streams and premieres — saving the cover before go-live, during the broadcast, or after replay — see the <a href=\"https://www.11tik.com/youtube-live-premiere-thumbnail-download\">live and premiere thumbnail guide</a>. For many video links at once, use Bulk (up to 50) — see <a href=\"https://www.11tik.com/how-to-batch-download-youtube\">batch download</a>. Working from a channel page with individual watch URLs: <a href=\"https://www.11tik.com/how-to-extract-thumbnails-from-youtube\">channel thumbnail guide</a>.";
const HOWTO_BEFORE_2_LEGACY =
  "You save a public still YouTube already hosts. You do not unlock private videos, members-only files, or the MP4/WebM stream. 11tik is an extractor, not a maker and not a video downloader — comparison: <a href=\"https://www.11tik.com/2026/08/thumbnail-extractor-vs-maker.html\">extractor vs maker</a>.";
const HOWTO_BEFORE_2_CLEAN =
  "You save a public still YouTube already hosts. You do not unlock private videos, members-only files, or the MP4/WebM stream. 11tik is an extractor, not a maker and not a video downloader — comparison: <a href=\"https://www.11tik.com/thumbnail-extractor-vs-maker\">extractor vs maker</a>.";
const HOWTO_AFTER_2 =
  "You save a public still YouTube already hosts. You do not unlock private videos, members-only files, or the MP4/WebM stream — see <a href=\"https://www.11tik.com/youtube-thumbnail-not-appearing-private\">why a thumbnail will not appear</a> when every size fails. 11tik is an extractor, not a maker and not a video downloader — comparison: <a href=\"https://www.11tik.com/thumbnail-extractor-vs-maker\">extractor vs maker</a>.";

describe("applyEnglishOrphanInlinkPatches (idempotent)", () => {
  it("counts four patch definitions across three articles", () => {
    expect(countEnglishOrphanInlinkPatches()).toBe(4);
  });

  it("migrates legacy hrefs inside a before-anchor to clean paths", () => {
    const legacy =
      'see <a href="https://www.11tik.com/2026/08/how-to-batch-download-youtube.html">batch</a>';
    expect(migrateOrphanPatchAnchorHrefs(legacy)).toBe(
      'see <a href="https://www.11tik.com/how-to-batch-download-youtube">batch</a>',
    );
  });

  it("CASE A: applies when legacy before is present", () => {
    const html = `<p>${HOWTO_BEFORE_1}</p><p>${HOWTO_BEFORE_2_LEGACY}</p>`;
    const out = applyEnglishOrphanInlinkPatches(html, "how-to-download-youtube-thumbnail");
    expect(out).toContain("youtube-live-premiere-thumbnail-download");
    expect(out).toContain("youtube-thumbnail-not-appearing-private");
    expect(out).toContain('href="https://www.11tik.com/how-to-batch-download-youtube"');
    expect(out).not.toContain("/2026/08/thumbnail-extractor-vs-maker.html");
  });

  it("CASE A′: applies when Phase-57B clean-migrated before is present", () => {
    const html = `<p>${HOWTO_BEFORE_1}</p><p>${HOWTO_BEFORE_2_CLEAN}</p>`;
    const out = applyEnglishOrphanInlinkPatches(html, "how-to-download-youtube-thumbnail");
    expect(out).toContain("youtube-live-premiere-thumbnail-download");
    expect(out).toContain("youtube-thumbnail-not-appearing-private");
    expect(out).toContain('href="https://www.11tik.com/how-to-batch-download-youtube"');
  });

  it("CASE B: no-ops when final after is already present", () => {
    const html = `<p>${HOWTO_AFTER_1}</p><p>${HOWTO_AFTER_2}</p>`;
    const out = applyEnglishOrphanInlinkPatches(html, "how-to-download-youtube-thumbnail");
    expect(out).toBe(html);
  });

  it("CASE C: throws with patch identity when neither anchor exists", () => {
    expect(() => applyEnglishOrphanInlinkPatches("<p>unrelated</p>", "how-to-download-youtube-thumbnail")).toThrow(
      /how-to-download-youtube-thumbnail#1/,
    );
    expect(() => applyEnglishOrphanInlinkPatches("<p>unrelated</p>", "how-to-download-youtube-thumbnail")).toThrow(
      /expectedLegacyAnchor/,
    );
    expect(() => applyEnglishOrphanInlinkPatches("<p>unrelated</p>", "how-to-download-youtube-thumbnail")).toThrow(
      /expectedFinalAnchor/,
    );
  });

  it("is idempotent when run twice on legacy input", () => {
    const before =
      "Line-by-line bulk details: <a href=\"https://www.11tik.com/how-to-batch-download-youtube\">batch download guide</a>. Single-URL flow: <a href=\"https://www.11tik.com/how-to-download-youtube-thumbnail\">how to download a YouTube thumbnail</a>.";
    const once = applyEnglishOrphanInlinkPatches(`<p>${before}</p>`, "how-to-extract-thumbnails-from-youtube");
    const twice = applyEnglishOrphanInlinkPatches(once, "how-to-extract-thumbnails-from-youtube");
    expect(twice).toBe(once);
    expect(once).toContain("how-to-save-youtube-thumbnail-on-iphone");
  });
});
