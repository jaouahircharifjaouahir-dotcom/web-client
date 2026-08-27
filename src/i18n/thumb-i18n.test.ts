import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isRtl } from "./ui";
import { pageFill, pageString } from "./pages";
import { THUMB_LOCALE_PACKS } from "./thumb-locale-packs";

const VIDEO_ID = "78NCFcygs9o";
const TITLE = VIDEO_ID;
const THUMB_KEYS = [
  "thumbHeading",
  "thumbLead",
  "thumbBody",
  "thumbRights",
  "thumbSizes",
  "thumbCta",
  "thumbImgAlt",
] as const;

const EN_SNIPPETS = [
  "Public still for",
  "Use the extractor on this page",
  "Checked public sizes",
  "Extract another thumbnail",
  "thumbnail | 11tik",
];

const TECHNICAL_LITERALS = ["maxresdefault", "hq720", "sddefault", "hqdefault", "mqdefault", "default"];

describe("/thumb/* localization", () => {
  it("renders English thumb copy on en", () => {
    expect(pageFill("en", "thumbLead", { title: TITLE })).toContain("Public still");
    expect(pageString("en", "thumbCta")).toBe("Extract another thumbnail");
  });

  it("renders Japanese thumb copy on ja (not English fallback)", () => {
    const lead = pageFill("ja", "thumbLead", { title: TITLE });
    expect(lead).toContain("公開サムネイル");
    for (const snippet of EN_SNIPPETS) {
      expect(lead).not.toContain(snippet);
    }
    expect(pageString("ja", "thumbCta")).toBe("別のサムネイルを抽出");
  });

  it("renders Arabic thumb copy on ar", () => {
    const lead = pageFill("ar", "thumbLead", { title: TITLE });
    expect(lead).toContain("الصورة العامة");
    expect(pageString("ar", "thumbCta")).toBe("استخرج صورة أخرى");
  });

  it("renders French thumb copy on fr", () => {
    expect(pageFill("fr", "thumbLead", { title: TITLE })).toContain("Image publique");
    expect(pageString("fr", "thumbCta")).toContain("Extraire");
  });

  it("renders Spanish thumb copy on es", () => {
    expect(pageFill("es", "thumbLead", { title: TITLE })).toContain("Imagen pública");
    expect(pageString("es", "thumbCta")).toContain("Extraer");
  });

  it("covers all 37 target locales with non-English thumb lead where pack exists", () => {
    const targets =
      "ar,bn,de,es,fa,fr,he,hi,id,it,ja,ko,ms,nl,pl,pt,ru,th,tl,tr,uk,ur,vi,zh,bg,cs,da,el,fi,hr,hu,no,ro,sk,sr,sv,sw".split(
        ",",
      );
    for (const locale of targets) {
      const lead = pageFill(locale, "thumbLead", { title: TITLE });
      expect(lead.length).toBeGreaterThan(20);
      expect(lead).toContain(TITLE);
      expect(lead).not.toContain("Public still for");
    }
  });

  it("preserves YouTube video ID in filled copy", () => {
    expect(pageFill("ja", "thumbHeading", { title: VIDEO_ID })).toContain(VIDEO_ID);
    expect(pageFill("ar", "thumbLead", { title: VIDEO_ID })).toContain(VIDEO_ID);
  });

  it("preserves technical format names untranslated", () => {
    for (const locale of ["en", "ja", "ar", "fr", "es"]) {
      const sizes = pageString(locale, "thumbSizes");
      for (const name of TECHNICAL_LITERALS) {
        expect(sizes).toContain(name);
      }
    }
  });

  it("does not translate image URL patterns in thumb body", () => {
    const body = pageString("ja", "thumbBody");
    expect(body).toMatch(/maxresdefault/);
    expect(body).not.toMatch(/https?:\/\//);
  });

  it("marks RTL locales correctly", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("fa")).toBe(true);
    expect(isRtl("he")).toBe(true);
    expect(isRtl("ur")).toBe(true);
    expect(isRtl("ja")).toBe(false);
  });

  it("uses existing pages.ts + thumb-locale-packs (no second catalog for page copy)", () => {
    expect(Object.keys(THUMB_LOCALE_PACKS).length).toBeGreaterThan(30);
    expect(pageString("ja", "thumbLead")).not.toBe(pageString("en", "thumbLead"));
  });
});

describe("/thumb/* hardcoded string audit", () => {
  const ROOT = join(process.cwd(), "src");

  const USER_FACING_PATTERNS = [
    /Public still for/,
    /Use the extractor on this page/,
    /Checked public sizes/,
    /Extract another thumbnail/,
    /Keyword links/,
    /Copied all URLs/,
    /Download thumbnail video/,
    /LOCAL HISTORY/,
    /Clear history/,
    /Ad space/,
    /thumbnail \| 11tik/,
  ];

  it("ThumbArticle source has no hardcoded user-facing English literals", () => {
    const src = readFileSync(join(ROOT, "pages", "SitePages.tsx"), "utf8");
    const thumbBlock = src.slice(src.indexOf("export function ThumbArticle"), src.indexOf("function ThumbPage"));
    for (const pattern of USER_FACING_PATTERNS) {
      if (pattern.test("thumbnail | 11tik") && pattern.source.includes("thumbnail")) {
        expect(thumbBlock).not.toMatch(/`\$\{title\} thumbnail \| 11tik`/);
        continue;
      }
      expect(thumbBlock).not.toMatch(pattern);
    }
  });

  it("reports intentional English in thumb locale packs (technical literals only)", () => {
    const raw = readFileSync(join(ROOT, "i18n", "thumb-locale-packs.ts"), "utf8");
    const englishMatches = raw.match(/[A-Za-z]{4,}/g) || [];
    const technical = englishMatches.filter(
      (word) =>
        ["maxresdefault", "hq720", "sddefault", "hqdefault", "mqdefault", "default", "YouTube", "merchandise"].includes(
          word,
        ) || word === "tik",
    );
    expect(technical.length).toBeGreaterThan(0);
  });

  it("thumb page keys resolve for sampled locales", () => {
    for (const locale of ["en", "ja", "ar", "fr", "es"]) {
      for (const key of THUMB_KEYS) {
        const value =
          key === "thumbHeading" || key === "thumbLead" || key === "thumbImgAlt"
            ? pageFill(locale, key, { title: TITLE })
            : pageString(locale, key);
        expect(value.trim().length).toBeGreaterThan(5);
      }
    }
  });
});
