import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AHREFS_ANALYTICS_KEY,
  AHREFS_ANALYTICS_SRC,
  ahrefsAnalyticsHeadTag,
  ahrefsAnalyticsHeadTagBlogger,
} from "../../scripts/i18n/ahrefs-analytics.mjs";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { loadTranslationArtifact } from "../../scripts/i18n/translation-store.mjs";
import { renderEnglishStaticHtml } from "../../scripts/i18n/render-english-static.mjs";
import { renderLocalizedHtml } from "../../scripts/i18n/render-localized.mjs";
import { siteHeaderHeadTags } from "../../scripts/i18n/site-header.mjs";

const EXACT_TAG = `<script src="${AHREFS_ANALYTICS_SRC}" data-key="${AHREFS_ANALYTICS_KEY}" async></script>`;
const SCRIPT_RE = /<script\b[^>]*\bsrc=["']https:\/\/analytics\.ahrefs\.com\/analytics\.js["'][^>]*>/gi;

function countAhrefsScripts(html: string): number {
  return [...html.matchAll(SCRIPT_RE)].length;
}

function assertPublicAhrefs(html: string, label: string) {
  expect(countAhrefsScripts(html), `${label}: exactly one Ahrefs script`).toBe(1);
  expect(html, label).toContain(AHREFS_ANALYTICS_SRC);
  expect(html, label).toContain(`data-key="${AHREFS_ANALYTICS_KEY}"`);
  expect(html, label).toMatch(
    /<script\b[^>]*\basync\b[^>]*analytics\.ahrefs\.com\/analytics\.js|<script\b[^>]*analytics\.ahrefs\.com\/analytics\.js[^>]*\basync\b/i,
  );
  if (html.includes(`src="${AHREFS_ANALYTICS_SRC}"`)) {
    expect(html, label).toContain(EXACT_TAG);
  }
}

function walkHtmlFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkHtmlFiles(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

function contentKey(item: { contentId?: string; id?: string }) {
  return item.contentId || item.id || "";
}

describe("Ahrefs Web Analytics head injection", () => {
  it("exports the exact required script tag", () => {
    expect(ahrefsAnalyticsHeadTag()).toBe(EXACT_TAG);
    expect(ahrefsAnalyticsHeadTag()).toContain("async");
    expect(ahrefsAnalyticsHeadTagBlogger()).toContain(AHREFS_ANALYTICS_SRC);
    expect(ahrefsAnalyticsHeadTagBlogger()).toContain(AHREFS_ANALYTICS_KEY);
    expect(ahrefsAnalyticsHeadTagBlogger()).toMatch(/\basync=/);
  });

  it("includes Ahrefs once in siteHeaderHeadTags (EN + localized static path)", () => {
    const head = siteHeaderHeadTags();
    assertPublicAhrefs(head, "siteHeaderHeadTags");
  });

  it("renders Ahrefs once on English article and utility HTML", () => {
    const items = localizableContent(buildContentInventory());
    const article = items.find((i) => i.type === "article")!;
    const utility = items.find((i) => i.type === "utility")!;
    for (const item of [article, utility]) {
      const html = renderEnglishStaticHtml(item, {
        alternates: [{ locale: "en", url: item.canonicalUrl }],
      });
      assertPublicAhrefs(html, contentKey(item));
    }
  });

  it("renders Ahrefs once on localized article and utility HTML", () => {
    const items = localizableContent(buildContentInventory());
    const article = items.find((i) => i.type === "article")!;
    const utility = items.find((i) => i.type === "utility")!;
    for (const item of [article, utility]) {
      const id = contentKey(item);
      const artifact = loadTranslationArtifact(id, "ar");
      expect(artifact, `${id}/ar`).toBeTruthy();
      const html = renderLocalizedHtml(item, artifact, {
        alternates: [
          { locale: "en", url: item.canonicalUrl },
          { locale: "ar", url: `https://ar.11tik.com/l/ar${item.canonicalPath}` },
        ],
      });
      assertPublicAhrefs(html, `${id}/ar`);
    }
  });

  it("injects Ahrefs exactly once on every generated public HTML page", () => {
    const dir = getStagedStaticSite();
    const htmlFiles = walkHtmlFiles(dir);
      // Homepage + locale homes + English static + localized content.
      expect(htmlFiles.length).toBeGreaterThan(900);

      const missing: string[] = [];
      const dupes: string[] = [];
      for (const file of htmlFiles) {
        const html = readFileSync(file, "utf8");
        const n = countAhrefsScripts(html);
        if (n === 0) missing.push(file);
        if (n > 1) dupes.push(`${file} (${n})`);
      }
      expect(dupes, dupes.slice(0, 8).join("; ")).toEqual([]);
      expect(missing, missing.slice(0, 8).join("; ")).toEqual([]);

      assertPublicAhrefs(readFileSync(join(dir, "index.html"), "utf8"), "home");
      assertPublicAhrefs(readFileSync(join(dir, "l", "ar", "index.html"), "utf8"), "ar-home");
      assertPublicAhrefs(
        readFileSync(join(dir, "2026", "08", "youtube-thumbnail-url.html"), "utf8"),
        "en-article",
      );
      assertPublicAhrefs(readFileSync(join(dir, "p", "about.html"), "utf8"), "en-utility");
      assertPublicAhrefs(
        readFileSync(join(dir, "l", "ar", "2026", "08", "youtube-thumbnail-url.html"), "utf8"),
        "ar-article",
      );
      assertPublicAhrefs(readFileSync(join(dir, "l", "fr", "p", "about.html"), "utf8"), "fr-utility");

      expect(readFileSync(join(dir, "robots.txt"), "utf8")).not.toContain("analytics.ahrefs.com");
      expect(readFileSync(join(dir, "sitemap.xml"), "utf8")).not.toContain("analytics.ahrefs.com");
      const pub = join(dir, "web-client", "i18n", "publishability.json");
      if (existsSync(pub)) {
        expect(readFileSync(pub, "utf8")).not.toContain("analytics.ahrefs.com");
      }
  });

  it("includes Ahrefs once in Blogger theme source head (XML-safe)", () => {
    const theme = readFileSync(join(process.cwd(), "docs", "blogger-theme.xml"), "utf8");
    const head = theme.slice(0, theme.indexOf("</head>"));
    expect(countAhrefsScripts(head)).toBe(1);
    expect(countAhrefsScripts(theme)).toBe(1);
    expect(theme).toContain(AHREFS_ANALYTICS_SRC);
    expect(theme).toContain(AHREFS_ANALYTICS_KEY);
    expect(theme).toMatch(
      /analytics\.ahrefs\.com\/analytics\.js[^>]*\basync|\basync[^>]*analytics\.ahrefs\.com\/analytics\.js/,
    );
    expect(theme).not.toContain("googletagmanager.com/gtm.js");
  });
});

describe("Ahrefs analytics in staged dist-assets (after build)", () => {
  it("keeps exactly one Ahrefs script on public HTML when dist-assets is current", () => {
    const root = join(process.cwd(), "dist-assets");
    const home = join(root, "index.html");
    if (!existsSync(home)) return;
    const homeHtml = readFileSync(home, "utf8");
    // Skip stale trees from before this change (npm test runs before npm run build).
    if (!homeHtml.includes(AHREFS_ANALYTICS_SRC)) return;

    const htmlFiles = walkHtmlFiles(root).filter(
      (f) => !f.replaceAll("\\", "/").includes("/web-client/"),
    );
    expect(htmlFiles.length).toBeGreaterThan(100);

    const missing: string[] = [];
    const dupes: string[] = [];
    for (const file of htmlFiles) {
      const html = readFileSync(file, "utf8");
      const n = countAhrefsScripts(html);
      if (n === 0) missing.push(file);
      if (n > 1) dupes.push(`${file} (${n})`);
    }
    expect(dupes, dupes.slice(0, 10).join("; ")).toEqual([]);
    expect(missing, missing.slice(0, 10).join("; ")).toEqual([]);

    for (const rel of ["robots.txt", "sitemap.xml", "web-client/i18n/publishability.json"]) {
      const p = join(root, ...rel.split("/"));
      if (!existsSync(p)) continue;
      expect(readFileSync(p, "utf8")).not.toContain("analytics.ahrefs.com");
    }
  });
});
