const HOME_BLURB = /Download YouTube thumbnails instantly|highest available quality, free|Paste a video or Shorts URL/i;

export function clipDescription(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function extractBodyDescription(html) {
  const item = String(html || "").match(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/p>/i);
  if (item?.[1]) {
    const text = clipDescription(item[1]);
    if (text.length > 40) return text;
  }
  const paras = String(html || "").matchAll(/<p(?![^>]*class=['"][^'"]*yte-(?:byline|updated|caption|kicker))[^>]*>([\s\S]*?)<\/p>/gi);
  for (const match of paras) {
    const text = clipDescription(match[1]);
    if (text.length > 60 && !HOME_BLURB.test(text)) return text.slice(0, 160);
  }
  const h1 = String(html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) {
    return clipDescription(`${h1[1]}. Public YouTube thumbnail guide on 11tik. Stills only; no video download.`);
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
  if (!desc) return html;
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
  if (fromMap.length > 40) return fromMap;
  return extractBodyDescription(html);
}
