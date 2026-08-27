/**
 * Ahrefs Web Analytics — single shared head snippet for all public HTML generators.
 * Direct async script (not GTM). Keep this string identical across SPA shells,
 * English static, localized static, and the Blogger theme source.
 */

export const AHREFS_ANALYTICS_SRC = "https://analytics.ahrefs.com/analytics.js";
export const AHREFS_ANALYTICS_KEY = "X9YRRJVwfQiBRcTKYgzNJQ";

/** Exact head tag for static HTML generators (double-quoted attributes). */
export function ahrefsAnalyticsHeadTag() {
  return `<script src="${AHREFS_ANALYTICS_SRC}" data-key="${AHREFS_ANALYTICS_KEY}" async></script>`;
}

/**
 * Blogger theme XML prefers single-quoted HTML attributes.
 * Same src / data-key / async semantics as ahrefsAnalyticsHeadTag().
 */
export function ahrefsAnalyticsHeadTagBlogger() {
  return `<script async='async' data-key='${AHREFS_ANALYTICS_KEY}' src='${AHREFS_ANALYTICS_SRC}'></script>`;
}
