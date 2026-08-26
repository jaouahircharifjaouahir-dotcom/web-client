/**
 * Shared 11tik site header for static HTML (articles, utilities, locale homes).
 * Visual/behavior mirror of src/App.tsx header.yte-top — one source for all static pages.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTargetLanguageEntries } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CATALOG = JSON.parse(readFileSync(join(ROOT, "src", "i18n", "catalog.json"), "utf8"));
const NATIVE_NAMES = JSON.parse(readFileSync(join(ROOT, "src", "i18n", "native-names.json"), "utf8"));

const SITE_HEADER_ASSET_V = "2";

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function uiPack(locale) {
  const pack = CATALOG[locale]?.ui || CATALOG.en.ui;
  return {
    posts: pack.posts || CATALOG.en.ui.posts,
    bulk: pack.bulk || CATALOG.en.ui.bulk,
    theme: pack.theme || CATALOG.en.ui.theme,
    language: pack.language || CATALOG.en.ui.language,
    themeSystem: pack.themeSystem || CATALOG.en.ui.themeSystem,
    themeLight: pack.themeLight || CATALOG.en.ui.themeLight,
    themeDark: pack.themeDark || CATALOG.en.ui.themeDark,
  };
}

/** English + enabled target locales (native labels). Same set SPA should use. */
export function headerLanguageOptions() {
  const targets = getTargetLanguageEntries()
    .map((row) => ({
      code: row.code,
      label: row.nativeName || NATIVE_NAMES[row.code] || row.language || row.code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
  return [{ code: "en", label: NATIVE_NAMES.en || "English" }, ...targets];
}

export function localeHomeUrl(code = "en") {
  if (code === "en") return "https://www.11tik.com/";
  return `https://${code}.11tik.com/l/${code}/`;
}

/**
 * CSS tokens + header chrome. Does not constrain .yte-page (article stays 720px).
 */
export const SITE_HEADER_CSS = `:root,html{color-scheme:light;--yte-bg:#f4efe6;--yte-ink:#17141c;--yte-muted:#5c5666;--yte-paper:rgba(255,252,247,.88);--yte-line:rgba(23,20,28,.12);--yte-accent:#c2410c;--yte-accent-2:#0f766e;--yte-shadow:0 18px 50px rgba(23,20,28,.08);--yte-font:system-ui,"Segoe UI",sans-serif}
html[data-yte-theme="dark"]{color-scheme:dark;--yte-bg:#110f14;--yte-ink:#f6f1ea;--yte-muted:#b7aea3;--yte-paper:rgba(24,21,28,.92);--yte-line:rgba(246,241,234,.12);--yte-accent:#fb923c;--yte-accent-2:#5eead4;--yte-shadow:0 18px 50px rgba(0,0,0,.28)}
html{margin:0;-webkit-text-size-adjust:100%;text-size-adjust:100%;overflow-x:clip}
body{margin:0;min-height:100%;font-family:var(--yte-font);color:var(--yte-ink);background:var(--yte-bg)}
.yte-static-chrome{width:min(920px,calc(100% - 24px));margin:0 auto;padding:16px 0 0;box-sizing:border-box}
.yte-static-chrome *,.yte-static-chrome *::before,.yte-static-chrome *::after{box-sizing:border-box}
.yte-top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:28px}
.yte-brand{display:flex;align-items:center;gap:10px;font-weight:700;color:inherit;text-decoration:none}
a.yte-brand:hover{opacity:.82}
a.yte-brand:focus-visible{outline:3px solid var(--yte-accent-2);outline-offset:3px;border-radius:12px}
.yte-mark{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,var(--yte-accent),#ea580c);color:#fff;font-size:14px;font-weight:800}
.yte-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.yte-chip{border:1px solid var(--yte-line);background:transparent;color:var(--yte-ink);border-radius:999px;padding:10px 14px;cursor:pointer;font:inherit;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;min-height:44px}
a.yte-chip:hover{opacity:.9}
.yte-chip:focus-visible{outline:3px solid var(--yte-accent-2);outline-offset:2px}
.yte-chip[aria-pressed="true"]{background:var(--yte-ink);color:var(--yte-bg)}
.yte-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.yte-lang{display:inline-flex;align-items:center;gap:6px;padding:0 10px 0 14px;max-width:min(240px,100%)}
.yte-lang select{appearance:none;-webkit-appearance:none;border:0;background:transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%235c5666' d='M1 1l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 4px center;color:inherit;font:inherit;font-weight:700;padding:10px 22px 10px 0;min-width:7.5rem;max-width:200px;cursor:pointer}
.yte-lang select:focus{outline:none}
.yte-lang:focus-within{outline:3px solid var(--yte-accent-2);outline-offset:2px;border-radius:999px}
@media (max-width:700px){
.yte-static-chrome{width:100%;padding:12px 16px 0}
.yte-top{flex-direction:column;align-items:stretch;gap:14px;margin-bottom:16px}
.yte-actions{width:100%}
.yte-chip{flex:1 1 auto;text-align:center}
.yte-lang{flex:1 1 100%;max-width:100%}
.yte-lang select{width:100%;max-width:100%}
}`;

export function siteHeaderStyleTag() {
  return `<style id="yte-site-header-css">\n${SITE_HEADER_CSS}\n</style>`;
}

/** Apply stored theme before paint (avoids flash). */
export function siteHeaderThemeBootScript() {
  return `<script>(function(){try{var k="yte-theme",m=localStorage.getItem(k);if(m!=="light"&&m!=="dark"&&m!=="system")m="system";var r=m==="light"||m==="dark"?m:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-yte-theme",r);}catch(e){}})();</script>`;
}

export function siteHeaderScriptTag() {
  return `<script defer src="/web-client/site-header.js?v=${SITE_HEADER_ASSET_V}"></script>`;
}

/**
 * @param {{
 *   locale?: string,
 *   homeUrl?: string,
 *   contentPath?: string,
 *   variant?: "static" | "spa-shell",
 * }} [options]
 */
export function renderSiteHeaderHtml(options = {}) {
  const locale = String(options.locale || "en").toLowerCase();
  const homeUrl = options.homeUrl || localeHomeUrl(locale);
  const contentPath = options.contentPath || "";
  const variant = options.variant === "spa-shell" ? "spa-shell" : "static";
  const labels = uiPack(locale);
  const currentLabel =
    headerLanguageOptions().find((item) => item.code === locale)?.label ||
    NATIVE_NAMES[locale] ||
    locale;
  const optionsHtml = headerLanguageOptions()
    .map((item) => {
      const selected = item.code === locale ? " selected" : "";
      return `<option value="${xmlEscape(item.code)}"${selected}>${xmlEscape(item.label)}</option>`;
    })
    .join("");

  const postsUrl = new URL(homeUrl);
  postsUrl.searchParams.delete("bulk");
  postsUrl.searchParams.set("posts", "1");
  const bulkUrl = new URL(homeUrl);
  bulkUrl.searchParams.delete("posts");
  bulkUrl.searchParams.set("bulk", "1");
  const postsHref = postsUrl.href;
  const bulkHref = bulkUrl.href;

  // Always real links (URL-addressable). Active aria state synced by App / site-header.js.
  const postsControl = `<a class="yte-chip" id="yte-posts-btn" data-yte-action="posts" href="${xmlEscape(postsHref)}" aria-pressed="false">${xmlEscape(labels.posts)}</a>`;
  const bulkControl = `<a class="yte-chip" id="yte-bulk-btn" data-yte-action="bulk" href="${xmlEscape(bulkHref)}" aria-pressed="false">${xmlEscape(labels.bulk)}</a>`;

  return `<div class="yte-static-chrome" data-yte-header-root>
<header id="yte-site-header" class="yte-top" role="banner" data-yte-locale="${xmlEscape(locale)}" data-yte-home="${xmlEscape(homeUrl)}" data-yte-content-path="${xmlEscape(contentPath)}" data-yte-variant="${variant}">
  <a class="yte-brand" href="${xmlEscape(homeUrl)}">
    <span class="yte-mark" aria-hidden="true">11</span>
    <span>11tik</span>
  </a>
  <nav class="yte-actions" aria-label="Site">
    ${postsControl}
    ${bulkControl}
    <button class="yte-chip" type="button" id="yte-theme-btn" data-yte-action="theme" aria-label="${xmlEscape(labels.theme)}" data-yte-theme-prefix="${xmlEscape(labels.theme)}" data-yte-label-system="${xmlEscape(labels.themeSystem)}" data-yte-label-light="${xmlEscape(labels.themeLight)}" data-yte-label-dark="${xmlEscape(labels.themeDark)}">
      <span data-yte-theme-label>${xmlEscape(labels.theme)}: ${xmlEscape(labels.themeSystem)}</span>
    </button>
    <label class="yte-chip yte-lang">
      <span class="yte-sr">${xmlEscape(labels.language)}</span>
      <select id="yte-lang-select" aria-label="${xmlEscape(labels.language)}" data-yte-current-label="${xmlEscape(currentLabel)}">
        ${optionsHtml}
      </select>
    </label>
  </nav>
</header>
</div>`;
}

/** Head fragments for static article/utility pages. */
export function siteHeaderHeadTags() {
  return `${siteHeaderThemeBootScript()}
  ${siteHeaderStyleTag()}`;
}

/** Body open: header markup + closing script (call after content). */
export function siteHeaderBodyOpen(options) {
  return renderSiteHeaderHtml(options);
}

export function siteHeaderBodyClose() {
  return siteHeaderScriptTag();
}
