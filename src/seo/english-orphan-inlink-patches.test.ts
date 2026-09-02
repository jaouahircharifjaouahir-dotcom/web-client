import { describe, expect, it } from "vitest";
import {
  applyEnglishOrphanInlinkPatches,
  countEnglishOrphanInlinkPatches,
  migrateOrphanPatchAnchorHrefs,
} from "../../scripts/i18n/render-english-static.mjs";

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
    const before1 =
      "Channel or playlist URLs without a video ID will not yield a single thumbnail. For many links at once, use Bulk (up to 25) — see <a href=\"https://www.11tik.com/2026/08/how-to-batch-download-youtube.html\">batch download</a>.";
    const before2 =
      "You save a public still YouTube already hosts. You do not unlock private videos, members-only files, or the MP4/WebM stream. 11tik is an extractor, not a maker and not a video downloader — comparison: <a href=\"https://www.11tik.com/2026/08/thumbnail-extractor-vs-maker.html\">extractor vs maker</a>.";
    const html = `<p>${before1}</p><p>${before2}</p>`;
    const out = applyEnglishOrphanInlinkPatches(html, "how-to-download-youtube-thumbnail");
    expect(out).toContain("youtube-live-premiere-thumbnail-download");
    expect(out).toContain("youtube-thumbnail-not-appearing-private");
    expect(out).toContain('href="https://www.11tik.com/how-to-batch-download-youtube"');
    expect(out).not.toContain("/2026/08/how-to-batch-download-youtube.html");
  });

  it("CASE A′: applies when Phase-57B clean-migrated before is present", () => {
    const migrated1 =
      "Channel or playlist URLs without a video ID will not yield a single thumbnail. For many links at once, use Bulk (up to 25) — see <a href=\"https://www.11tik.com/how-to-batch-download-youtube\">batch download</a>.";
    const migrated2 =
      "You save a public still YouTube already hosts. You do not unlock private videos, members-only files, or the MP4/WebM stream. 11tik is an extractor, not a maker and not a video downloader — comparison: <a href=\"https://www.11tik.com/thumbnail-extractor-vs-maker\">extractor vs maker</a>.";
    const html = `<p>${migrated1}</p><p>${migrated2}</p>`;
    const out = applyEnglishOrphanInlinkPatches(html, "how-to-download-youtube-thumbnail");
    expect(out).toContain("youtube-live-premiere-thumbnail-download");
    expect(out).toContain("youtube-thumbnail-not-appearing-private");
    expect(out).toContain('href="https://www.11tik.com/how-to-batch-download-youtube"');
  });

  it("CASE B: no-ops when final after is already present", () => {
    const after1 =
      "Channel or playlist URLs without a video ID will not yield a single thumbnail. For live streams and premieres — saving the cover before go-live, during the broadcast, or after replay — see the <a href=\"https://www.11tik.com/youtube-live-premiere-thumbnail-download\">live and premiere thumbnail guide</a>. For many links at once, use Bulk (up to 25) — see <a href=\"https://www.11tik.com/how-to-batch-download-youtube\">batch download</a>.";
    const after2 =
      "You save a public still YouTube already hosts. You do not unlock private videos, members-only files, or the MP4/WebM stream — see <a href=\"https://www.11tik.com/youtube-thumbnail-not-appearing-private\">why a thumbnail will not appear</a> when every size fails. 11tik is an extractor, not a maker and not a video downloader — comparison: <a href=\"https://www.11tik.com/thumbnail-extractor-vs-maker\">extractor vs maker</a>.";
    const html = `<p>${after1}</p><p>${after2}</p>`;
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
      "This is different from saving one watch link. The single-URL flow is in <a href=\"https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html\">how to download a YouTube thumbnail</a>. Line-by-line bulk without a channel is in <a href=\"https://www.11tik.com/2026/08/how-to-batch-download-youtube.html\">batch download</a>.";
    const once = applyEnglishOrphanInlinkPatches(`<p>${before}</p>`, "how-to-extract-thumbnails-from-youtube");
    const twice = applyEnglishOrphanInlinkPatches(once, "how-to-extract-thumbnails-from-youtube");
    expect(twice).toBe(once);
    expect(once).toContain("how-to-save-youtube-thumbnail-on-iphone");
  });
});
