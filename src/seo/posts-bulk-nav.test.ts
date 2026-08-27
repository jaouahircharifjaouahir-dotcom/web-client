import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLocaleCatalogDoc, writeLocaleCatalogs } from "../../scripts/i18n/write-locale-catalogs.mjs";
import { getTargetLocales } from "../../scripts/i18n/target-languages.mjs";
import { GUIDE_POSTS } from "../content/posts";
import { postsFromCatalog } from "../i18n/localeCatalog";
import { resolveLocaleDestination } from "../i18n/publishability";
import { homeViewHref, readHomeView, withHomeView } from "../routing/homeView";
import { localeHomeUrl } from "../i18n/ui";
import { renderSiteHeaderHtml } from "../../scripts/i18n/site-header.mjs";

describe("home view URL state", () => {
  it("reads posts and bulk as mutually exclusive views", () => {
    expect(readHomeView("https://www.11tik.com/?posts=1")).toBe("posts");
    expect(readHomeView("https://ar.11tik.com/l/ar/?bulk=1")).toBe("bulk");
    expect(readHomeView("https://www.11tik.com/?bulk=1&posts=1")).toBe("bulk");
    expect(readHomeView("https://www.11tik.com/")).toBe("home");
  });

  it("activates Posts then Bulk then Posts via URL helpers", () => {
    let href = "https://fr.11tik.com/l/fr/";
    href = withHomeView(href, "posts");
    expect(readHomeView(href)).toBe("posts");
    expect(href).toContain("posts=1");
    expect(href).not.toContain("bulk=1");
    href = withHomeView(href, "bulk");
    expect(readHomeView(href)).toBe("bulk");
    expect(href).toContain("bulk=1");
    expect(href).not.toContain("posts=1");
    href = withHomeView(href, "posts");
    expect(readHomeView(href)).toBe("posts");
  });

  it("preserves Posts/Bulk across language switch destination search", () => {
    const fromPosts = "https://ar.11tik.com/l/ar/?posts=1";
    const dest = resolveLocaleDestination(fromPosts, "fr", null, localeHomeUrl);
    expect(dest).toContain("fr.11tik.com");
    expect(dest).toContain("posts=1");
    const fromBulk = "https://ar.11tik.com/l/ar/?bulk=1";
    const destBulk = resolveLocaleDestination(fromBulk, "fr", null, localeHomeUrl);
    expect(destBulk).toContain("bulk=1");
  });

  it("builds direct Posts/Bulk hrefs for locale homes", () => {
    expect(homeViewHref("posts", "https://es.11tik.com/l/es/")).toContain("?posts=1");
    expect(homeViewHref("bulk", "https://es.11tik.com/l/es/")).toContain("?bulk=1");
    expect(homeViewHref("home", "https://es.11tik.com/l/es/?posts=1")).not.toContain("posts=1");
  });
});

describe("localized content catalogs", () => {
  it("builds Arabic catalog with localized titles/snippets/urls for ready articles", () => {
    const doc = buildLocaleCatalogDoc("ar");
    expect(doc.locale).toBe("ar");
    expect(doc.items.length).toBe(GUIDE_POSTS.length);
    const ready = doc.items.filter((item) => item.ready);
    expect(ready.length).toBeGreaterThan(10);
    for (const item of ready) {
      expect(item.url).toMatch(/^https:\/\/ar\.11tik\.com\/l\/ar\/2026\//);
      expect(item.title.length).toBeGreaterThan(3);
      expect(item.description.length).toBeGreaterThan(10);
      // Prefer non-ASCII / different from English GUIDE title when ready
      const en = GUIDE_POSTS.find((g) => g.href.endsWith(`/${item.contentId}.html`));
      if (en && /[^\x00-\x7f]/.test(item.title)) {
        expect(item.title).not.toBe(en.title);
      }
    }
  });

  it("builds French and Spanish catalogs with localized URLs", () => {
    for (const locale of ["fr", "es"] as const) {
      const doc = buildLocaleCatalogDoc(locale);
      expect(doc.items.length).toBe(GUIDE_POSTS.length);
      const ready = doc.items.filter((i) => i.ready);
      expect(ready.length).toBeGreaterThan(5);
      expect(ready.every((i) => i.url.includes(`${locale}.11tik.com/l/${locale}/`))).toBe(true);
    }
  });

  it("falls back to English URL/title when translation is not ready", () => {
    const doc = buildLocaleCatalogDoc("ar");
    const fallback = doc.items.find((item) => !item.ready);
    if (fallback) {
      expect(fallback.url).toMatch(/^https:\/\/www\.11tik\.com\/2026\//);
      const en = GUIDE_POSTS.find((g) => g.href.includes(fallback.contentId));
      expect(fallback.title).toBe(en?.title);
    }
  });

  it("writes one catalog per en + target locale without duplicate contentIds", () => {
    const dir = mkdtempSync(join(tmpdir(), "cats-"));
    try {
      const written = writeLocaleCatalogs((path, contents) => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, contents);
      }, dir);
      expect(written.length).toBe(1 + getTargetLocales().length);
      const ar = JSON.parse(readFileSync(join(dir, "web-client/i18n/catalog/ar.json"), "utf8"));
      const ids = ar.items.map((i: { contentId: string }) => i.contentId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(GUIDE_POSTS.length);
      // latest guide present
      const last = GUIDE_POSTS[GUIDE_POSTS.length - 1];
      const lastId = last.href.split("/").pop()!.replace(/\.html$/, "");
      expect(ids).toContain(lastId);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("postsFromCatalog maps catalog items for Posts UI", () => {
    const doc = buildLocaleCatalogDoc("fr");
    const posts = postsFromCatalog(doc, "fr");
    expect(posts.length).toBe(GUIDE_POSTS.length);
    expect(posts[0].title).toBeTruthy();
    expect(posts[0].href).toBeTruthy();
    expect(posts[0].summary).toBeTruthy();
  });

  it("English catalog mirrors GUIDE_POSTS order and www URLs", () => {
    const doc = buildLocaleCatalogDoc("en");
    expect(doc.items.every((i) => i.ready)).toBe(true);
    expect(doc.items.map((i) => i.url)).toEqual(GUIDE_POSTS.map((g) => g.href));
  });
});

describe("Posts/Bulk clickability (static anchors)", () => {
  it("Posts and Bulk are <a> tags, not buttons, with correct query hrefs", () => {
    const html = renderSiteHeaderHtml({ locale: "en" });
    expect(html).toContain('<a class="yte-chip" id="yte-posts-btn"');
    expect(html).toContain('<a class="yte-chip" id="yte-bulk-btn"');
    expect(html).not.toMatch(/<button[^>]*id="yte-posts-btn"/);
    expect(html).not.toMatch(/<button[^>]*id="yte-bulk-btn"/);
    expect(html).toContain("?posts=1");
    expect(html).toContain("?bulk=1");
  });

  it("preserves English, Arabic, and French locale homes in Posts/Bulk hrefs", () => {
    expect(renderSiteHeaderHtml({ locale: "en" })).toContain("https://www.11tik.com/?posts=1");
    expect(renderSiteHeaderHtml({ locale: "en" })).toContain("https://www.11tik.com/?bulk=1");
    expect(renderSiteHeaderHtml({ locale: "ar" })).toContain("https://ar.11tik.com/l/ar/?posts=1");
    expect(renderSiteHeaderHtml({ locale: "ar" })).toContain("https://ar.11tik.com/l/ar/?bulk=1");
    expect(renderSiteHeaderHtml({ locale: "fr" })).toContain("https://fr.11tik.com/l/fr/?posts=1");
    expect(renderSiteHeaderHtml({ locale: "fr" })).toContain("https://fr.11tik.com/l/fr/?bulk=1");
  });

  it("site-header.js never blocks link navigation without SPA handshake", () => {
    const src = readFileSync(join(process.cwd(), "public/site-header.js"), "utf8");
    expect(src).toContain("__yteNavigateView");
    expect(src).not.toMatch(/__yteAppReady && isSpaHomeContext\(\)[\s\S]{0,80}preventDefault/);
  });

  it("cache-busts blogger-app.js so immutable CDN cannot keep a stale SPA", () => {
    const src = readFileSync(join(process.cwd(), "scripts/generate-static-site.mjs"), "utf8");
    expect(src).toMatch(/APP_ASSET_V\s*=\s*"57"/);
  });

  it("Back/Forward helpers remain URL-driven (refresh-safe)", () => {
    const posts = withHomeView("https://www.11tik.com/", "posts");
    const bulk = withHomeView(posts, "bulk");
    expect(readHomeView(posts)).toBe("posts");
    expect(readHomeView(bulk)).toBe("bulk");
    expect(readHomeView(withHomeView(bulk, "posts"))).toBe("posts");
  });
});
