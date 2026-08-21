/**
 * Keep IndexNow on durable, indexable URLs only.
 * Query landings (?v=, ?k=) and tag farms stay out.
 */
export function indexNowQuality(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return { ok: false, score: 0, reason: "not https" };
    if (parsed.hostname !== "www.11tik.com") return { ok: false, score: 0, reason: "wrong host" };
    if (parsed.pathname.startsWith("/search") || parsed.pathname.startsWith("/tag/")) {
      return { ok: false, score: 20, reason: "thin or non-canonical path" };
    }
    if ([...parsed.searchParams.keys()].some((key) => ["k", "v", "vimeo", "embed", "m"].includes(key))) {
      return { ok: false, score: 25, reason: "query landing (share/UX only)" };
    }
    if (parsed.pathname === "/" || parsed.pathname.startsWith("/p/") || /\/20\d{2}\//.test(parsed.pathname)) {
      return { ok: true, score: 90, reason: "static page or post" };
    }
    return { ok: true, score: 80, reason: "same-host path" };
  } catch {
    return { ok: false, score: 0, reason: "invalid url" };
  }
}

export function filterIndexNowUrls(urls) {
  const eligible = [];
  const hold = [];
  for (const url of urls) {
    const gate = indexNowQuality(url);
    if (gate.ok && gate.score >= 80) eligible.push(url);
    else hold.push({ url, ...gate });
  }
  return { eligible, hold };
}
