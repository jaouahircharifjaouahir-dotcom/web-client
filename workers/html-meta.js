const HOME_BLURB = /Download YouTube thumbnails instantly|highest available quality, free|Paste a video or Shorts URL/i;
const GARBAGE = /Last updated:|By 11tik|\bBy\s+11tik\b/i;

/** Ahrefs "Meta description too long" is >160; project posts use ≤150. */
export const META_DESCRIPTION_MAX = 150;
/** Ahrefs Site Audit "Meta description too short" — lengths 87–96 were flagged (File 19). */
export const META_DESCRIPTION_MIN = 120;

/** Ahrefs "Title too short" — File 20 lengths were 11–14 (threshold ~30). */
export const META_TITLE_MIN = 30;
/** Ahrefs commonly flags titles over ~60 characters. */
export const META_TITLE_MAX = 60;

/** Ahrefs Site Audit flags img alt text longer than 100 characters (File 26). */
export const ALT_TEXT_MAX = 100;

const META_DESCRIPTION_PAD =
  "Free YouTube thumbnail extractor on 11tik — public stills only, no signup.";
const TITLE_PRODUCT_PAD = "YouTube Thumbnail Extractor";
const TITLE_STILLS_PAD = "free public stills";

export function clipDescription(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, META_DESCRIPTION_MAX);
}

/** Clip to max, then pad if under Ahrefs min so shells/posts stay in the 120–150 band. */
export function fitDescription(value) {
  let text = clipDescription(value);
  if (!text) return "";
  const pad = META_DESCRIPTION_PAD;
  while (text.length < META_DESCRIPTION_MIN) {
    const sep = /\s$/.test(text) ? "" : /[.!?。…]$/.test(text) ? " " : ". ";
    const next = clipDescription(`${text}${sep}${pad}`);
    if (next.length <= text.length) break;
    text = next;
  }
  return text;
}

export function clipTitle(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, META_TITLE_MAX);
}

/**
 * Keep document titles in the Ahrefs-safe 30–60 band.
 * Short utility titles like "Kontak | 11tik" / CJK homes get a product pad.
 */
export function fitTitle(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";

  const brandRe = /\s*\|\s*11tik\s*$/i;
  const hadBrand = brandRe.test(raw);
  let core = hadBrand ? raw.replace(brandRe, "").trim() : raw;

  let out = hadBrand ? `${core} | 11tik` : core;
  if (out.length >= META_TITLE_MIN) return clipTitle(out);

  const hasProduct =
    /youtube/i.test(core) ||
    /thumbnail|extractor|缩略图|サムネ|썸네일|duimnael|miniatur|vignette/i.test(core);

  if (!hasProduct) core = `${core} · ${TITLE_PRODUCT_PAD}`;
  else core = `${core} — ${TITLE_STILLS_PAD}`;

  out = `${core} | 11tik`;
  if (out.length < META_TITLE_MIN) {
    out = `${core} · ${TITLE_PRODUCT_PAD} | 11tik`;
  }
  return clipTitle(out);
}

/** Keep img alt text within Ahrefs-safe length without keyword-stuffing. */
export function fitAlt(value) {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length <= ALT_TEXT_MAX) return text;
  const cut = text.slice(0, ALT_TEXT_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace >= Math.floor(ALT_TEXT_MAX * 0.55)) {
    return cut.slice(0, lastSpace).trim();
  }
  return cut.trim();
}

function altAttrEscape(value) {
  return String(value || "").replace(/"/g, "&quot;");
}

/** Clamp every img alt in static HTML (English + localized render output). */
export function clampImgAltsInHtml(html) {
  return String(html || "").replace(/<img\b([^>]*)\/?>/gi, (full, attrs) => {
    const altMatch = /\balt\s*=\s*(["'])([\s\S]*?)\1/i.exec(attrs);
    if (!altMatch) return full;
    const fitted = fitAlt(altMatch[2]);
    const nextAttrs = attrs.replace(
      /\balt\s*=\s*(["'])[\s\S]*?\1/i,
      `alt="${altAttrEscape(fitted)}"`,
    );
    return `<img${nextAttrs}>`;
  });
}

export function isGarbageDescription(value) {
  const text = String(value || "");
  return GARBAGE.test(text) || HOME_BLURB.test(text);
}

export function extractBodyDescription(html) {
  const item = String(html || "").match(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/p>/i);
  if (item?.[1]) {
    const text = fitDescription(item[1]);
    if (text.length >= META_DESCRIPTION_MIN && !isGarbageDescription(text)) return text;
  }
  return "";
}

export function metaEscape(value) {
  return fitDescription(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function upsertHeadDescription(html, description) {
  const desc = metaEscape(description);
  if (!desc || isGarbageDescription(description)) return html;
  const block = `<meta content='${desc}' name='description'/>
    <meta content='${desc}' property='og:description'/>
    <meta content='${desc}' name='twitter:description'/>`;
  let out = String(html || "")
    .replace(/<meta\b[^>]*name=['"]description['"][^>]*>/gi, "")
    .replace(/<meta\b[^>]*property=['"]og:description['"][^>]*>/gi, "")
    .replace(/<meta\b[^>]*name=['"]twitter:description['"][^>]*>/gi, "");
  if (out.includes("</title>")) return out.replace("</title>", `</title>\n    ${block}`);
  if (/<head[^>]*>/i.test(out)) return out.replace(/<head[^>]*>/i, (open) => `${open}\n    ${block}`);
  return out;
}

/** Replace <title> / og+twitter titles with a length-safe value (Ahrefs File 20). */
export function upsertHeadTitle(html, title) {
  const safe = fitTitle(title)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  if (!safe) return html;
  let out = String(html || "");
  if (/<title>[^<]*<\/title>/i.test(out)) {
    out = out.replace(/<title>[^<]*<\/title>/i, `<title>${safe}</title>`);
  } else if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (open) => `${open}\n    <title>${safe}</title>`);
  }
  if (/property=['"]og:title['"]/i.test(out)) {
    out = out.replace(
      /<meta\b[^>]*property=['"]og:title['"][^>]*>/gi,
      `<meta content='${safe}' property='og:title'/>`,
    );
  }
  if (/name=['"]twitter:title['"]/i.test(out)) {
    out = out.replace(
      /<meta\b[^>]*name=['"]twitter:title['"][^>]*>/gi,
      `<meta content='${safe}' name='twitter:title'/>`,
    );
  }
  return out;
}

export function resolvePageDescription(pathname, html, mapped) {
  const fromMap = fitDescription(mapped || "");
  if (fromMap.length >= META_DESCRIPTION_MIN && !isGarbageDescription(fromMap)) return fromMap;
  return extractBodyDescription(html);
}

/** Force https:// for 11tik absolute URLs (Ahrefs File 21 — no http canonicals). */
export function toHttpsUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://www.11tik.com/");
    if (url.protocol === "http:" && /(^|\.)11tik\.com$/i.test(url.hostname)) {
      url.protocol = "https:";
    }
    return url.toString();
  } catch {
    return raw.replace(/^http:\/\//i, "https://");
  }
}

/** Upgrade http:// canonical + og:url on 11tik hosts to https://. */
export function upgradeHttpCanonicals(html) {
  return String(html || "")
    .replace(
      /(<link\b[^>]*\brel\s*=\s*['"]canonical['"][^>]*\bhref\s*=\s*['"])http:\/\//gi,
      "$1https://",
    )
    .replace(
      /(<link\b[^>]*\bhref\s*=\s*['"])http:\/\/([^'"]*)(['"][^>]*\brel\s*=\s*['"]canonical['"])/gi,
      "$1https://$2$3",
    )
    .replace(
      /(<meta\b[^>]*\bproperty\s*=\s*['"]og:url['"][^>]*\bcontent\s*=\s*['"])http:\/\//gi,
      "$1https://",
    )
    .replace(
      /(<meta\b[^>]*\bcontent\s*=\s*['"])http:\/\/([^'"]*)(['"][^>]*\bproperty\s*=\s*['"]og:url['"])/gi,
      "$1https://$2$3",
    );
}
