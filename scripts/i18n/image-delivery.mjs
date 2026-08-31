/**
 * Build-time image delivery helpers (picture + WebP fallback).
 * OG/JSON-LD keep PNG URLs; in-page img uses WebP via <picture>.
 */

const DELIVERABLE_PNG = /^https:\/\/www\.11tik\.com\/web-client\/images\/blog\/[^"']+\.png$/i;

export function webpUrlFromPngUrl(pngUrl) {
  return String(pngUrl || "").replace(/\.png(\?.*)?$/i, ".webp$1");
}

/** Wrap eligible blog/social PNG img tags with WebP picture sources. */
export function upgradeStaticImagesToPicture(html) {
  const source = String(html || "");
  if (!source.includes("<img") || !source.includes("/web-client/images/")) return source;
  return source.replace(/<img\b([^>]*)>/gi, (full, attrs, offset) => {
    const before = source.slice(Math.max(0, offset - 120), offset);
    if (/<picture>\s*<source[^>]+>\s*$/is.test(before)) return full;
    const srcMatch = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(attrs);
    if (!srcMatch) return full;
    const src = srcMatch[2];
    if (!DELIVERABLE_PNG.test(src)) return full;
    const webp = webpUrlFromPngUrl(src);
    return `<picture><source type="image/webp" srcset="${webp}"/>${full}</picture>`;
  });
}
