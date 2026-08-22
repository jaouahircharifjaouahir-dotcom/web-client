const SITE = "https://www.11tik.com";
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_ADD_PER_HOUR = 80;
const MAX_SEED_PER_DAY = 12;
const TAG_INDEX_MIN = 6;

export function parseYouTubeWatchMeta(html) {
  const tags = [];
  const seen = new Set();
  const push = (value) => {
    const tag = String(value || "")
      .trim()
      .replace(/^#+/, "")
      .trim();
    if (!tag || seen.has(tag.toLowerCase())) return;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  };
  const meta = String(html || "").match(/<meta name="keywords" content="([^"]*)"/i);
  if (meta?.[1]) {
    for (const part of meta[1].split(",")) push(part);
  }
  if (!tags.length) {
    const idx = String(html || "").indexOf('"keywords":[');
    if (idx >= 0) {
      const slice = String(html).slice(idx + '"keywords":'.length, idx + 12000);
      const raw = slice.match(/^\[[\s\S]*?\]/);
      if (raw) {
        try {
          const list = JSON.parse(raw[0]);
          if (Array.isArray(list)) for (const item of list) push(item);
        } catch {
          /* keep empty */
        }
      }
    }
  }
  const title =
    String(html || "").match(/<meta name="title" content="([^"]+)"/i)?.[1] ||
    String(html || "").match(/"title":{"runs":\[{"text":"([^"]+)"/)?.[1] ||
    "";
  const author =
    String(html || "").match(/<link itemprop="name" content="([^"]+)"/i)?.[1] ||
    String(html || "").match(/"ownerChannelName":"([^"]+)"/)?.[1] ||
    "";
  return { title: decodeHtml(title), authorName: decodeHtml(author), tags: tags.slice(0, 40) };
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

const YT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.8",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function fetchWatchHtml(videoId) {
  const urls = [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://m.youtube.com/watch?v=${videoId}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: YT_HEADERS, cf: { cacheTtl: 120 } });
      if (!res.ok) continue;
      const parsed = parseYouTubeWatchMeta(await res.text());
      if (parsed.tags.length || parsed.title) {
        return { ok: true, videoId, ...parsed };
      }
    } catch {
      /* try next host */
    }
  }
  return null;
}

async function fetchInnertubeMeta(videoId) {
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: { ...YT_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "WEB", clientVersion: "2.20240821.01.00", hl: "en" } },
        videoId,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const details = data?.videoDetails || {};
    const tags = [];
    const seen = new Set();
    for (const item of details.keywords || []) {
      const tag = String(item || "")
        .trim()
        .replace(/^#+/, "")
        .trim();
      if (!tag || seen.has(tag.toLowerCase())) continue;
      seen.add(tag.toLowerCase());
      tags.push(tag);
    }
    const title = String(details.title || "").trim();
    const authorName = String(details.author || "").trim();
    if (!tags.length && !title) return null;
    return { ok: true, videoId, title, authorName, tags: tags.slice(0, 40) };
  } catch {
    return null;
  }
}

export async function fetchYouTubeWatchMeta(videoId) {
  if (!YT_ID.test(videoId || "")) return { ok: false, tags: [], title: "", authorName: "" };
  return (
    (await fetchWatchHtml(videoId)) ||
    (await fetchInnertubeMeta(videoId)) || { ok: false, tags: [], title: "", authorName: "" }
  );
}

export function slugTag(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function qualityForVideo(row) {
  const title = String(row?.title || "").trim();
  const tags = Array.isArray(row?.tags) ? row.tags.filter(Boolean) : [];
  const thumb = String(row?.thumb || "");
  if (!title || tags.length < 1 || !/^https:\/\//i.test(thumb)) {
    return { score: 40, decision: "NOINDEX", reason: "incomplete extract (title, tags, or thumbnail)" };
  }
  if (row?.source === "seed" && !row?.userConfirmed) {
    return { score: 82, decision: "INDEX", reason: "trending seed with complete metadata" };
  }
  return { score: 88, decision: "INDEX", reason: "complete user extract" };
}

export function qualityForTag(count) {
  if (count < 3) return { score: 40, decision: "NOINDEX", reason: `tag has ${count} videos (need 6)` };
  if (count < TAG_INDEX_MIN) return { score: 70, decision: "HOLD", reason: `tag has ${count} videos (need 6)` };
  return { score: 90, decision: "INDEX", reason: `${count} videos` };
}

export async function rateLimitOk(env, ip) {
  if (!env?.SITEMAP_URLS) return true;
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = `rl:${hour}:${ip || "anon"}`;
  const current = Number((await env.SITEMAP_URLS.get(key)) || "0");
  if (current >= MAX_ADD_PER_HOUR) return false;
  await env.SITEMAP_URLS.put(key, String(current + 1), { expirationTtl: 7200 });
  return true;
}

export async function seedBudgetOk(env) {
  if (!env?.SITEMAP_URLS) return true;
  const day = new Date().toISOString().slice(0, 10);
  const key = `seed:${day}`;
  const current = Number((await env.SITEMAP_URLS.get(key)) || "0");
  if (current >= MAX_SEED_PER_DAY) return false;
  await env.SITEMAP_URLS.put(key, String(current + 1), { expirationTtl: 172800 });
  return true;
}

export async function saveLibraryRow(env, row) {
  if (!env?.SITEMAP_URLS) return row;
  const key = `u:${row.platform}:${row.videoId}`;
  const gate = qualityForVideo(row);
  const stored = { ...row, gate, lastmod: row.lastmod || new Date().toISOString() };
  await env.SITEMAP_URLS.put(key, JSON.stringify(stored));
  await env.SITEMAP_URLS.put(`log:${Date.now()}:${row.videoId}`, JSON.stringify({
    at: stored.lastmod,
    url: stored.loc,
    score: gate.score,
    decision: gate.decision,
    reason: gate.reason,
  }), { expirationTtl: 60 * 60 * 24 * 120 });
  for (const tag of stored.tags || []) {
    const slug = slugTag(tag);
    if (!slug) continue;
    const tKey = `t:${slug}`;
    let pack = { slug, name: tag, videos: [] };
    try {
      const raw = await env.SITEMAP_URLS.get(tKey);
      if (raw) pack = JSON.parse(raw);
    } catch {
      /* new tag */
    }
    if (!pack.videos.includes(key)) pack.videos.push(key);
    pack.count = pack.videos.length;
    pack.updated = stored.lastmod;
    pack.gate = qualityForTag(pack.count);
    await env.SITEMAP_URLS.put(tKey, JSON.stringify(pack));
  }
  return stored;
}

export async function readLibraryRow(env, platform, videoId) {
  if (!env?.SITEMAP_URLS) return null;
  const raw = await env.SITEMAP_URLS.get(`u:${platform}:${videoId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readTag(env, slug) {
  if (!env?.SITEMAP_URLS) return null;
  const raw = await env.SITEMAP_URLS.get(`t:${slugTag(slug)}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function listIndexedExtracts(env, max = 45000) {
  const out = [];
  if (!env?.SITEMAP_URLS) return out;
  let cursor;
  do {
    const page = await env.SITEMAP_URLS.list({ prefix: "u:", cursor, limit: 1000 });
    for (const key of page.keys) {
      const raw = await env.SITEMAP_URLS.get(key.name);
      if (!raw) continue;
      try {
        const row = JSON.parse(raw);
        if (row?.gate?.decision === "INDEX" && row.loc) out.push(row);
      } catch {
        /* skip */
      }
      if (out.length >= max) return out;
    }
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);
  return out;
}

export async function listIndexedTags(env) {
  const out = [];
  if (!env?.SITEMAP_URLS) return out;
  let cursor;
  do {
    const page = await env.SITEMAP_URLS.list({ prefix: "t:", cursor, limit: 1000 });
    for (const key of page.keys) {
      const raw = await env.SITEMAP_URLS.get(key.name);
      if (!raw) continue;
      try {
        const row = JSON.parse(raw);
        if (row?.gate?.decision === "INDEX") out.push(row);
      } catch {
        /* skip */
      }
    }
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);
  out.sort((a, b) => (b.count || 0) - (a.count || 0));
  return out;
}

export async function listHoldQueue(env) {
  const hold = [];
  if (!env?.SITEMAP_URLS) return hold;
  let cursor;
  do {
    const page = await env.SITEMAP_URLS.list({ prefix: "t:", cursor, limit: 1000 });
    for (const key of page.keys) {
      const raw = await env.SITEMAP_URLS.get(key.name);
      if (!raw) continue;
      try {
        const row = JSON.parse(raw);
        if (row?.gate?.decision === "HOLD" || row?.gate?.decision === "NOINDEX") hold.push(row);
      } catch {
        /* skip */
      }
    }
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);
  return hold;
}

export function jsonResponse(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=60",
      ...extra,
    },
  });
}

export function thumbnailApiPayload(platform, videoId) {
  if (platform === "vimeo") {
    return {
      ok: true,
      platform,
      videoId,
      note: "Vimeo sizes are discovered in the browser extractor.",
      share: `${SITE}/thumb/vimeo/${encodeURIComponent(videoId)}`,
    };
  }
  const files = ["maxresdefault.jpg", "hq720.jpg", "sddefault.jpg", "hqdefault.jpg", "mqdefault.jpg", "default.jpg"];
  return {
    ok: true,
    platform: "youtube",
    videoId,
    share: `${SITE}/thumb/${encodeURIComponent(videoId)}`,
    thumbnails: files.map((file) => ({
      file,
      url: `https://i.ytimg.com/vi/${videoId}/${file}`,
    })),
    poweredBy: SITE,
  };
}

export async function resolveChannelVideos(channelUrl, limit = 20) {
  const cap = Math.min(50, Math.max(1, Number(limit) || 20));
  let feed = "";
  const raw = String(channelUrl || "").trim();
  let url;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "invalid_url", videos: [] };
  }
  const path = url.pathname;
  const channelId = path.match(/\/channel\/(UC[\w-]{20,})/i)?.[1];
  const user = path.match(/\/user\/([^/]+)/i)?.[1];
  if (channelId) feed = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  else if (user) feed = `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(user)}`;
  else {
    const page = await fetch(`https://www.youtube.com${path}`, {
      headers: { "user-agent": "11tik-channel/1.0" },
      cf: { cacheTtl: 300 },
    });
    const html = await page.text();
    const id = html.match(/"channelId":"(UC[\w-]{20,})"/)?.[1] || html.match(/\/channel\/(UC[\w-]{20,})/)?.[1];
    if (!id) return { ok: false, error: "channel_not_found", videos: [] };
    feed = `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
  }
  const res = await fetch(feed, { headers: { "user-agent": "11tik-channel/1.0" }, cf: { cacheTtl: 120 } });
  if (!res.ok) return { ok: false, error: "feed_failed", videos: [] };
  const xml = await res.text();
  const videos = [];
  const seen = new Set();
  for (const match of xml.matchAll(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/g)) {
    const id = match[1];
    if (seen.has(id) || !YT_ID.test(id)) continue;
    seen.add(id);
    videos.push({ videoId: id, url: `https://www.youtube.com/watch?v=${id}` });
    if (videos.length >= cap) break;
  }
  return { ok: true, videos, feed };
}

const SEED_FEEDS = [
  "https://www.youtube.com/feeds/videos.xml?channel_id=UC-lHJZR3Gqxm24_Vd_AJ5Yw",
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ",
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCX6OQ3DkcsbYNE6H8uQQuVA",
];

export async function pickTrendingSeedId() {
  const feed = SEED_FEEDS[Math.floor(Date.now() / 3_600_000) % SEED_FEEDS.length];
  const res = await fetch(feed, { headers: { "user-agent": "11tik-seed/1.0" }, cf: { cacheTtl: 600 } });
  if (!res.ok) return null;
  const xml = await res.text();
  const ids = [...xml.matchAll(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/g)].map((m) => m[1]);
  if (!ids.length) return null;
  return ids[Math.floor(Date.now() / 3_600_000) % ids.length];
}

export function imageSitemapXml(rows) {
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ];
  for (const row of rows) {
    if (!row.loc || !row.thumb) continue;
    parts.push(
      `<url><loc>${escapeXml(row.loc)}</loc><image:image><image:loc>${escapeXml(row.thumb)}</image:loc><image:title>${escapeXml(row.title || "YouTube thumbnail")}</image:title><image:caption>${escapeXml([row.title, ...(row.tags || [])].filter(Boolean).join(" – ") || "11tik YouTube thumbnail")}</image:caption></image:image></url>`,
    );
  }
  parts.push("</urlset>");
  return parts.join("");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function embedWidgetHtml(videoId) {
  const id = YT_ID.test(videoId || "") ? videoId : "dQw4w9WgXcQ";
  const img = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const share = `${SITE}/thumb/${id}`;
  const alt = `YouTube thumbnail ${id} | 11tik`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="icon" type="image/png" sizes="32x32" href="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj3ow8HyWy9yRQFsg4KZb6tJUZwxmUUEuEBv5FzGZMbQrZ9wzK7tCB5GfEPlvGu4fTNSqAPeke2IJdpwubgUfq7XdryvcebCtYraxd6l2vUDo8hG3RimtLewbO1R4TB1_WehF-PziUil11Sb_rPJZ1YqlS5ikOWvartEdOCVK6s8SsmZaT-qK-HlzzAtG1n/s32/favicon-2.png"/>
<meta property="og:image" content="https://www.11tik.com/web-client/images/social/og-image-1200x630.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:image" content="https://www.11tik.com/web-client/images/social/og-image-1200x630.png"/>
<script src="https://www.11tik.com/web-client/rights-boot.js"></script>
<title>11tik thumbnail</title>
<style>body{margin:0;font:14px/1.4 system-ui;background:#111;color:#f6f1ea}a{color:#fb923c}img{width:100%;display:block}</style></head>
<body><a href="${share}" target="_blank" rel="noopener"><img alt="${alt}" title="${alt}" src="${img}"/></a>
<p style="padding:8px 10px;margin:0">Powered by <a href="${SITE}" target="_blank" rel="noopener">11tik.com</a></p></body></html>`;
}

export { SITE, TAG_INDEX_MIN };
