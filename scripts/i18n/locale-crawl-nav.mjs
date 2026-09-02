/**
 * Crawlable static nav for locale subdomain pages (Semrush orphaned sitemap URLs).
 * Build-time only — no translation / sourceHash changes.
 */
import { INDEXABLE_UTILITY_PATHS, SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";
import { buildContentInventory } from "./content-inventory.mjs";
import { buildLocaleCatalogDoc } from "./write-locale-catalogs.mjs";
import { scanPublishability } from "./publish.mjs";

const SKIP_UTILITY_PATHS = new Set(["/keyword-tools"]);

const UTILITY_LABELS = Object.freeze({
  "/about": "About",
  "/contact": "Contact",
  "/embed": "Embed",
  "/privacy": "Privacy",
  "/terms-of-use": "Terms",
});

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function localeHomeHref(locale) {
  if (locale === "en") return `${SITE_ORIGIN}/`;
  return `https://${locale}.11tik.com/l/${locale}/`;
}

/** Ready article + utility hrefs for one locale (deduped). */
export function crawlNavLinksForLocale(locale, options = {}) {
  const code = String(locale || "en").toLowerCase();
  const inventory = options.inventory || buildContentInventory();
  const manifest = options.manifest || scanPublishability(inventory);
  const catalog =
    options.catalogDoc ||
    options.catalogByLocale?.[code] ||
    buildLocaleCatalogDoc(code, { inventory });
  const links = [];
  const seen = new Set();

  const push = (href, label) => {
    const url = String(href || "").trim();
    const text = String(label || "").trim();
    if (!url || !text || seen.has(url)) return;
    seen.add(url);
    links.push({ href: url, label: text });
  };

  push(localeHomeHref(code), code === "en" ? "YouTube Thumbnail Extractor" : "Home");

  for (const item of catalog.items) {
    if (!item.ready || !item.url) continue;
    push(item.url, item.title);
  }

  for (const entry of Object.values(manifest.contents || {})) {
    if (entry.type !== "utility") continue;
    const path = entry.canonicalPath;
    if (!path || SKIP_UTILITY_PATHS.has(path)) continue;
    const row = entry.locales?.[code];
    if (row?.status === "ready" && row.url) {
      push(row.url, UTILITY_LABELS[path] || path.replace(/^\//, ""));
    } else if (code === "en") {
      push(entry.canonicalUrl, UTILITY_LABELS[path] || "Page");
    }
  }

  if (code === "en") {
    push(`${SITE_ORIGIN}/copyright`, "Copyright");
  }

  return links;
}

export function renderLocaleCrawlNavHtml(locale, options = {}) {
  const code = String(locale || "en").toLowerCase();
  const links = crawlNavLinksForLocale(code, {
    ...options,
    catalogDoc: options.catalogDoc || options.catalogByLocale?.[code],
  });
  if (links.length <= 1) return "";
  const items = links
    .map((link) => `<li><a href="${xmlEscape(link.href)}">${xmlEscape(link.label)}</a></li>`)
    .join("\n      ");
  return `<nav class="yte-crawl-nav" aria-label="Site pages">
    <ul>
      ${items}
    </ul>
  </nav>`;
}

/** Guides section for SPA shells — crawlable hrefs (not text-only). */
export function renderShellGuideListHtml(locale, options = {}) {
  const code = String(locale || "en").toLowerCase();
  const catalog =
    options.catalogDoc ||
    options.catalogByLocale?.[code] ||
    buildLocaleCatalogDoc(code, options);
  const items = catalog.items
    .filter((item) => item.ready && item.url)
    .slice(0, 18)
    .map((item) => {
      const title = xmlEscape(item.title);
      const summary = xmlEscape(String(item.description || "").trim());
      return summary
        ? `<li><a href="${xmlEscape(item.url)}">${title}</a> — ${summary}</li>`
        : `<li><a href="${xmlEscape(item.url)}">${title}</a></li>`;
    })
    .join("\n      ");
  if (!items) return "";
  return `<section class="yte-shell-guides" aria-label="Guides">
    <ul>
      ${items}
    </ul>
  </section>`;
}
