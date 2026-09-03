import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildContentInventory } from "../../scripts/i18n/content-inventory.mjs";
import {
  CONTEXTUAL_LINK_PLAN,
  generateInternalLinkReport,
  resolveContextualLinks,
  validateAllLinkPlans,
} from "../../scripts/i18n/contextual-internal-links.mjs";
import { renderEnglishStaticHtml } from "../../scripts/i18n/render-english-static.mjs";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

const STUDY_URL = "https://www.11tik.com/youtube-thumbnail-sizes-resolutions-study";
const STUDY_OG =
  "https://www.11tik.com/web-client/images/blog/youtube-thumbnail-sizes-resolutions-study-og.png";
const DEFAULT_OG = "https://www.11tik.com/web-client/images/social/og-image-1200x630.png";

const STUDY_INBOUND_SOURCES = [
  "youtube-thumbnail-size-resolution",
  "what-is-maxresdefaultjpg-when-youtube",
  "youtube-thumbnail-url",
  "highest-quality-youtube-thumbnail",
  "webp-vs-jpeg-youtube-thumbnails-which",
  "how-to-download-youtube-thumbnail",
  "original-youtube-thumbnail-image",
  "youtube-shorts-thumbnail-download",
] as const;

describe("Phase 19C — study authority acceleration", () => {
  const inventory = buildContentInventory();
  const studyItem = inventory.find((i) => i.contentId === "youtube-thumbnail-sizes-resolutions-study");

  it("study uses study-specific og:image and twitter:image only", () => {
    expect(studyItem).toBeTruthy();
    const html = renderEnglishStaticHtml(studyItem!, {
      alternates: [{ locale: "en", url: studyItem!.canonicalUrl }],
    });
    expect(html).toContain(`property="og:image" content="${STUDY_OG}"`);
    expect(html).toContain(`name="twitter:image" content="${STUDY_OG}"`);
    expect(html).not.toContain(`property="og:image" content="${DEFAULT_OG}"`);
  });

  it("non-study articles keep global default og:image", () => {
    const download = inventory.find((i) => i.contentId === "how-to-download-youtube-thumbnail");
    expect(download).toBeTruthy();
    const html = renderEnglishStaticHtml(download!, {
      alternates: [{ locale: "en", url: download!.canonicalUrl }],
    });
    expect(html).toContain(`property="og:image" content="${DEFAULT_OG}"`);
    expect(html).not.toContain(STUDY_OG);
  });

  it("priority guides link to study in contextual plan", () => {
    for (const id of STUDY_INBOUND_SOURCES) {
      const siblings = CONTEXTUAL_LINK_PLAN[id]?.siblings || [];
      expect(
        siblings.some((s) => s.path.includes("youtube-thumbnail-sizes-resolutions-study")),
        id,
      ).toBe(true);
    }
  });

  it("contextual link plans still validate", () => {
    expect(validateAllLinkPlans()).toEqual([]);
  });

  it("study receives inbound links from priority cluster", () => {
    const report = generateInternalLinkReport(inventory);
    const inbound = report.filter((r) => r.target === STUDY_URL);
    expect(inbound.length).toBeGreaterThanOrEqual(8);
    for (const id of STUDY_INBOUND_SOURCES) {
      expect(inbound.some((r) => r.sourceContentId === id), id).toBe(true);
    }
  });

  it("sibling counts stay within 1–5 per guide", () => {
    for (const id of STUDY_INBOUND_SOURCES) {
      const item = inventory.find((i) => i.contentId === id);
      expect(item, id).toBeTruthy();
      const siblings = resolveContextualLinks(item!.contentId, item!.canonicalPath).filter(
        (l) => l.role === "sibling",
      );
      expect(siblings.length, id).toBeLessThanOrEqual(5);
    }
  });

  it("localized FR nav excludes EN-only study target", () => {
    const frDownload = resolveContextualLinks(
      "how-to-download-youtube-thumbnail",
      "/2026/08/how-to-download-youtube-thumbnail.html",
      { locale: "fr" },
    );
    expect(
      frDownload.some((l) => l.targetUrl.includes("youtube-thumbnail-sizes-resolutions-study")),
    ).toBe(false);
    const enDownload = resolveContextualLinks(
      "how-to-download-youtube-thumbnail",
      "/2026/08/how-to-download-youtube-thumbnail.html",
      { locale: "en" },
    );
    expect(
      enDownload.some((l) => l.targetUrl.includes("youtube-thumbnail-sizes-resolutions-study")),
    ).toBe(true);
  });

  it("staged study HTML has study OG after build", () => {
    const staged = getStagedStaticSite();
    const clean = join(staged, "youtube-thumbnail-sizes-resolutions-study.html");
    const legacy = join(staged, "2026/08/youtube-thumbnail-sizes-resolutions-study.html");
    const path = existsSync(clean) ? clean : legacy;
    const html = readFileSync(path, "utf8");
    expect(html).toContain(STUDY_OG);
    expect(html).toContain('class="yte-related"');
  });
});
