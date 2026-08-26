import { describe, expect, it } from "vitest";
import {
  applyLocalizedImageMetadata,
  LOCALIZED_PAGE_ICONS,
  renderLocalizedHtml,
  syncLocalizedImageAltsIntoArtifact,
} from "../../scripts/i18n/render-localized.mjs";
import { loadTranslationArtifact } from "../../scripts/i18n/translation-store.mjs";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { SITE } from "./site";

const ITEM = {
  contentId: "youtube-thumbnail-url",
  type: "article",
  canonicalUrl: "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
  canonicalPath: "/2026/08/youtube-thumbnail-url.html",
};

describe("localized image alt + favicon rendering", () => {
  it("rewrites img alt from artifact.images by src without changing src", () => {
    const src = "https://www.11tik.com/web-client/images/blog/youtube-thumbnail-url-flow-diagram.png";
    const html = `<img alt="English alt" class="yte-hero" height="630" loading="eager" src="${src}" width="1200">`;
    const out = applyLocalizedImageMetadata(html, [{ src, alt: "بديل عربي" }]);
    expect(out).toContain('alt="بديل عربي"');
    expect(out).toContain(`src="${src}"`);
    expect(out).toContain('class="yte-hero"');
    expect(out).toContain('width="1200"');
    expect(out).not.toContain("English alt");
  });

  it("preserves intentional empty alt", () => {
    const src = "https://www.11tik.com/web-client/images/blog/deco.png";
    const html = `<img alt="" src="${src}">`;
    const out = applyLocalizedImageMetadata(html, [{ src, alt: "" }]);
    expect(out).toMatch(/alt=""/);
  });

  it("syncLocalizedImageAltsIntoArtifact updates section HTML only", () => {
    const src = "https://www.11tik.com/web-client/images/blog/x.png";
    const synced = syncLocalizedImageAltsIntoArtifact({
      sourceHash: "abc",
      status: "ready",
      images: [{ src, alt: "FR alt" }],
      sections: [{ heading: "H", html: `<img alt="EN" src="${src}">` }],
    });
    expect(synced.sourceHash).toBe("abc");
    expect(synced.status).toBe("ready");
    expect(synced.sections[0].html).toContain('alt="FR alt"');
  });

  it("renderLocalizedHtml emits favicons and localized alts for Arabic artifact", () => {
    const artifact = loadTranslationArtifact("youtube-thumbnail-url", "ar");
    expect(artifact?.status).toBe("ready");
    expect(artifact.images?.[0]?.alt).toBeTruthy();
    expect(artifact.images[0].alt).not.toMatch(/Diagram showing/);

    const html = renderLocalizedHtml(ITEM, artifact, {
      alternates: [
        { locale: "en", url: ITEM.canonicalUrl },
        { locale: "ar", url: "https://ar.11tik.com/l/ar/2026/08/youtube-thumbnail-url.html" },
      ],
    });

    expect(html).toContain(`href="${LOCALIZED_PAGE_ICONS.png32}"`);
    expect(html).toContain(`href="${LOCALIZED_PAGE_ICONS.png16}"`);
    expect(html).toContain(`href="${LOCALIZED_PAGE_ICONS.apple180}"`);
    expect(LOCALIZED_PAGE_ICONS.png32).toBe(SITE.icons.png32);

    for (const img of artifact.images) {
      expect(html).toContain(`src="${img.src}"`);
      expect(html).toContain(`alt="${img.alt.replaceAll('"', "&quot;")}"`);
    }
    expect(html).not.toContain("Diagram showing a YouTube watch URL");
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('hreflang="ar"');
  });

  it("inventory localizable pages still total 23", () => {
    expect(localizableContent(buildContentInventory())).toHaveLength(23);
  });
});
