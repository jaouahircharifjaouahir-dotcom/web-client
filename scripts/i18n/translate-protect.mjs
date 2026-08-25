/**
 * Protect URLs, code, IDs, and technical tokens during translation.
 */

const URL_RE =
  /https?:\/\/[^\s<>"']+|(?:www\.)?[a-z0-9][-a-z0-9]*\.(?:com|org|net|io|jpg|png|webp)(?:\/[^\s<>"']*)?/gi;
const VIDEO_ID_RE = /\b[A-Za-z0-9_-]{11}\b/g;
const DOMAIN_RE = /\b(?:11tik\.com|i\.ytimg\.com|youtube\.com|youtu\.be|googleusercontent\.com)\b/gi;
const CODE_BLOCK_RE = /<(?:pre|code)\b[^>]*>[\s\S]*?<\/(?:pre|code)>/gi;
const HREF_SRC_RE = /(?:href|src)=["']([^"']+)["']/gi;

export function collectProtectedTokens(text) {
  const tokens = new Set();
  const add = (v) => {
    const s = String(v || "").trim();
    if (s.length >= 3) tokens.add(s);
  };

  for (const m of String(text || "").matchAll(HREF_SRC_RE)) add(m[1]);
  for (const m of String(text || "").matchAll(URL_RE)) add(m[0]);
  for (const m of String(text || "").matchAll(DOMAIN_RE)) add(m[0]);
  for (const m of String(text || "").matchAll(CODE_BLOCK_RE)) add(m[0]);
  add("11tik");
  add("maxresdefault.jpg");
  add("i.ytimg.com");
  return [...tokens];
}

export function protectText(text, tokens) {
  let out = String(text || "");
  const map = new Map();
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  sorted.forEach((token, i) => {
    const key = `[[P${i}]]`;
    map.set(key, token);
    out = out.split(token).join(key);
  });
  return { text: out, map };
}

export function restoreProtected(text, map) {
  let out = String(text || "");
  for (const [key, token] of map.entries()) {
    out = out.split(key).join(token);
  }
  return out;
}

export function restoreStructured(obj, map) {
  if (typeof obj === "string") return restoreProtected(obj, map);
  if (Array.isArray(obj)) return obj.map((v) => restoreStructured(v, map));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = restoreStructured(v, map);
    return out;
  }
  return obj;
}

function normalizeComparable(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/** pre/code blocks may be re-serialized by JSDOM; require URLs inside to survive. */
function codeBlockPreserved(token, hay) {
  if (hay.includes(token)) return true;
  if (normalizeComparable(hay).includes(normalizeComparable(token))) return true;
  const urls = [...token.matchAll(/https?:\/\/[^\s<>"'\\]+/g)].map((m) => m[0]);
  return urls.length > 0 && urls.every((u) => hay.includes(u));
}

export function validatePreservedTokens(translatedBlob, tokens) {
  const errors = [];
  const hay = typeof translatedBlob === "string" ? translatedBlob : JSON.stringify(translatedBlob);
  for (const token of tokens) {
    if (token.length < 4) continue;
    // URLs and code must survive unchanged.
    if (/^https?:\/\//.test(token)) {
      if (!hay.includes(token)) errors.push(`missing-token:${token.slice(0, 48)}`);
      continue;
    }
    if (token.startsWith("<pre") || token.startsWith("<code")) {
      if (!codeBlockPreserved(token, hay)) errors.push(`missing-token:${token.slice(0, 48)}`);
      continue;
    }
    // Brand must remain ASCII 11tik.
    if (token === "11tik" && !/\b11tik\b/.test(hay)) errors.push("missing-brand-11tik");
  }
  return { ok: errors.length === 0, errors };
}
