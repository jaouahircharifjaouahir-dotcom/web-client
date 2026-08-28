import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { renderLocalizedHtml } from "../../scripts/i18n/render-localized.mjs";
import {
  META_TITLE_MAX,
  META_TITLE_MIN,
  clipTitle,
  fitTitle,
} from "../../workers/html-meta.js";

/** Titles from 11tik_27-aug-2026_title-too-short export. */
const FILE20_TITLES = [
  "Kontak | 11tik",
  "संपर्क | 11tik",
  "使用条款 | 11tik",
  "お問い合わせ | 11tik",
  "ติดต่อ | 11tik",
  "YouTube 缩略图提取器",
  "关键词工具 | 11tik",
  "利用規約 | 11tik",
  "이용약관 | 11tik",
  "隐私政策 | 11tik",
  "연락처 | 11tik",
  "키워드 도구 | 11tik",
  "联系方式 | 11tik",
];

function titleFromHtml(html: string): string {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m?.[1]
    ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    : "";
}

describe("Document title length (Ahrefs File 20)", () => {
  it("fits short titles into the 30–60 band", () => {
    expect(META_TITLE_MIN).toBe(30);
    expect(META_TITLE_MAX).toBe(60);
    expect(clipTitle("a".repeat(80)).length).toBe(META_TITLE_MAX);
    for (const title of FILE20_TITLES) {
      const fitted = fitTitle(title);
      expect(fitted.length, title).toBeGreaterThanOrEqual(META_TITLE_MIN);
      expect(fitted.length, title).toBeLessThanOrEqual(META_TITLE_MAX);
    }
  });

  it("emits zh SPA home titles in band", () => {
    const dir = getStagedStaticSite();
    const t = titleFromHtml(readFileSync(join(dir, "l", "zh", "index.html"), "utf8"));
    expect(t.length).toBeGreaterThanOrEqual(META_TITLE_MIN);
    expect(t.length).toBeLessThanOrEqual(META_TITLE_MAX);
  });

  it("renderLocalizedHtml expands short utility titles", () => {
    const html = renderLocalizedHtml(
      {
        type: "utility",
        canonicalUrl: "https://www.11tik.com/p/contact.html",
      },
      {
        locale: "id",
        title: "Kontak | 11tik",
        description:
          "Hubungi 11tik tentang YouTube Thumbnail Extractor. Kirim pertanyaan produk atau privasi. Hanya stills publik.",
        h1: "Kontak",
        sections: [{ heading: "Kontak", html: "<p>Hi</p>" }],
        faq: [],
        images: [],
      },
      {
        alternates: [
          { locale: "en", url: "https://www.11tik.com/p/contact.html" },
          { locale: "id", url: "https://id.11tik.com/l/id/p/contact.html" },
        ],
      },
    );
    const t = titleFromHtml(html);
    expect(t.length).toBeGreaterThanOrEqual(META_TITLE_MIN);
    expect(t.length).toBeLessThanOrEqual(META_TITLE_MAX);
    expect(t).toMatch(/11tik/i);
  });
});
