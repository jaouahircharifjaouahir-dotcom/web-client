const HOME_BLURB = /Download YouTube thumbnails instantly|highest available quality, free|Paste a video or Shorts URL/i;
const GARBAGE = /Last updated:|By 11tik|\bBy\s+11tik\b/i;

export function clipDescription(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

export function isGarbageDescription(value) {
  const text = String(value || "");
  return GARBAGE.test(text) || HOME_BLURB.test(text);
}

export function extractBodyDescription(html) {
  const item = String(html || "").match(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/p>/i);
  if (item?.[1]) {
    const text = clipDescription(item[1]);
    if (text.length > 40 && !isGarbageDescription(text)) return text;
  }
  return "";
}

export function metaEscape(value) {
  return clipDescription(value)
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

export function resolvePageDescription(pathname, html, mapped) {
  const fromMap = clipDescription(mapped || "");
  if (fromMap.length > 40 && !isGarbageDescription(fromMap)) return fromMap;
  return extractBodyDescription(html);
}
