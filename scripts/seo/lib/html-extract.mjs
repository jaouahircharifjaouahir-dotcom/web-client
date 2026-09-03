/**
 * Deterministic HTML metadata extraction for SEO automation (Phase 26).
 */

export function extractMeta(html) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  const desc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
    "";
  const robots =
    html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["']/i)?.[1] ??
    "";
  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ??
    "";
  const lang = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] ?? "";
  const dir = html.match(/<html[^>]+dir=["']([^"']+)["']/i)?.[1] ?? "ltr";
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
  const hreflang = [...html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["']/gi)].map(
    (m) => m[1],
  );
  const schemaBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const schemaTypes = [];
  for (const block of schemaBlocks) {
    try {
      const json = JSON.parse(block[1]);
      const types = Array.isArray(json["@graph"])
        ? json["@graph"].map((n) => n["@type"]).filter(Boolean)
        : [json["@type"]].filter(Boolean);
      schemaTypes.push(...types.flat());
    } catch {
      schemaTypes.push("PARSE_ERROR");
    }
  }
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? "";
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? "";
  const twitterCard = html.match(/<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? "";
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
  const internalLinks = [...html.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((h) => h.startsWith("/") || h.includes("11tik.com"));
  const wordCount = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const hasPicture = /<picture>/i.test(html);
  const hasWebp = /\.webp/i.test(html);
  const jsPreload = /<link[^>]+rel=["']preload["'][^>]+as=["']script["']/i.test(html);
  const cssPreload = /<link[^>]+rel=["']preload["'][^>]+as=["']style["']/i.test(html);
  return {
    title,
    description: desc,
    robots,
    canonical,
    lang,
    dir,
    h1,
    hreflang,
    hreflangCount: hreflang.length,
    schemaTypes: [...new Set(schemaTypes)],
    ogTitle,
    ogImage,
    twitterCard,
    imgCount: imgs.length,
    imgsWithDimensions: imgs.filter((t) => /width=/i.test(t) && /height=/i.test(t)).length,
    internalLinks,
    wordCount,
    hasPicture,
    hasWebp,
    jsPreload,
    cssPreload,
  };
}

export function classifyPageType(relPath, publicUrl) {
  const rel = relPath.replace(/\\/g, "/");
  if (rel === "index.html") return "spa-home";
  if (/^l\/[a-z]{2}\/index\.html$/i.test(rel)) return "locale-home";
  if (rel.startsWith("2026/")) return "article";
  if (rel.startsWith("p/")) return "utility";
  if (rel === "copyright/index.html") return "legal";
  if (/^l\/[a-z]{2}\/2026\//i.test(rel)) return "localized-article";
  if (/^l\/[a-z]{2}\/p\//i.test(rel)) return "localized-utility";
  if (publicUrl?.includes("/thumb/")) return "thumb-spa";
  return "other";
}

export function localeFromPath(relPath, publicUrl) {
  const rel = relPath.replace(/\\/g, "/");
  const m = rel.match(/^l\/([a-z]{2})\//i);
  if (m) return m[1].toLowerCase();
  try {
    const host = new URL(publicUrl).hostname;
    const sub = host.split(".")[0];
    if (sub && sub !== "www" && sub.length === 2) return sub;
  } catch {
    /* ignore */
  }
  return "en";
}

export function isIndexableRobots(robots) {
  const r = String(robots || "").toLowerCase();
  if (!r) return true;
  return !r.includes("noindex");
}
