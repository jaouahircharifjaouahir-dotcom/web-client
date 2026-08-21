const KEY = "9f3a7c1e4b8d2f06a5c9e3b7d1f48a26";
const GITHUB = "https://jaouahircharifjaouahir-dotcom.github.io";
const SITE = "https://www.11tik.com";
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const MAX_URLS = 45000;
const CACHE_REQ = new Request(`${SITE}/web-client/__extracts.json`);

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    ...extra,
  };
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function locFor(platform, videoId) {
  if (platform === "vimeo") return `${SITE}/?vimeo=${encodeURIComponent(videoId)}`;
  return `${SITE}/?v=${encodeURIComponent(videoId)}`;
}

function urlEntry(loc, lastmod) {
  const mod = lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : "";
  return `<url><loc>${xmlEscape(loc)}</loc>${mod}</url>`;
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll(">", "&gt;")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function parseIds(platform, videoId) {
  const p = platform === "vimeo" ? "vimeo" : "youtube";
  const id = String(videoId || "").trim();
  if (p === "youtube" && !YT_ID.test(id)) return null;
  if (p === "vimeo" && !VIMEO_ID.test(id)) return null;
  return { platform: p, videoId: id };
}

async function loadCacheMap() {
  const hit = await caches.default.match(CACHE_REQ);
  if (!hit) return {};
  try {
    return await hit.json();
  } catch {
    return {};
  }
}

async function saveCacheMap(map) {
  await caches.default.put(
    CACHE_REQ,
    new Response(JSON.stringify(map), {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=31536000",
      },
    }),
  );
}

async function saveExtract(env, platform, videoId) {
  const loc = locFor(platform, videoId);
  const lastmod = new Date().toISOString();
  const row = { loc, lastmod };
  const map = await loadCacheMap();
  map[`${platform}:${videoId}`] = row;
  await saveCacheMap(map);
  if (env?.SITEMAP_URLS) {
    await env.SITEMAP_URLS.put(`u:${platform}:${videoId}`, JSON.stringify(row));
  }
  return loc;
}

async function listExtracts(env) {
  const out = [];
  const seen = new Set();
  const cacheMap = await loadCacheMap();
  for (const row of Object.values(cacheMap)) {
    if (row?.loc && !seen.has(row.loc)) {
      seen.add(row.loc);
      out.push(row);
    }
  }
  if (env?.SITEMAP_URLS) {
    let cursor;
    do {
      const page = await env.SITEMAP_URLS.list({ prefix: "u:", cursor, limit: 1000 });
      for (const key of page.keys) {
        const raw = await env.SITEMAP_URLS.get(key.name);
        if (!raw) continue;
        try {
          const row = JSON.parse(raw);
          if (row?.loc && !seen.has(row.loc)) {
            seen.add(row.loc);
            out.push(row);
          }
        } catch {
          /* skip */
        }
      }
      cursor = page.list_complete ? "" : page.cursor;
    } while (cursor);
  }
  return out.slice(0, MAX_URLS);
}

async function bloggerLocs() {
  const locs = new Map();
  locs.set(`${SITE}/`, new Date().toISOString());
  const feeds = [`${SITE}/feeds/posts/default?alt=rss&max-results=150`, `${SITE}/sitemap-pages.xml`];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed, { cf: { cacheTtl: 300 } });
      if (!res.ok) continue;
      const text = await res.text();
      for (const match of text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
        const loc = decodeXml(match[1].trim());
        if (loc.startsWith(SITE)) locs.set(loc, null);
      }
      for (const match of text.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/gi)) {
        const loc = decodeXml(match[1].trim());
        if (loc.startsWith(SITE) && !loc.includes("/feeds/")) locs.set(loc, null);
      }
    } catch {
      /* keep homepage */
    }
  }
  return locs;
}

async function handleSitemapAdd(request, env) {
  let platform = "youtube";
  let videoId = "";
  if (request.method === "GET") {
    const url = new URL(request.url);
    platform = url.searchParams.get("platform") || "youtube";
    videoId = url.searchParams.get("videoId") || "";
  } else {
    try {
      const body = await request.json();
      platform = body.platform;
      videoId = body.videoId;
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders() },
      });
    }
  }
  const parsed = parseIds(platform, videoId);
  if (!parsed) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_id" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }
  const loc = await saveExtract(env, parsed.platform, parsed.videoId);
  return new Response(JSON.stringify({ ok: true, loc }), {
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

async function handleSitemapGet(env) {
  const blogger = await bloggerLocs();
  const extracts = await listExtracts(env);
  const seen = new Set(blogger.keys());
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const [loc, lastmod] of blogger) {
    parts.push(urlEntry(loc, lastmod));
  }
  for (const row of extracts) {
    if (!row?.loc || seen.has(row.loc)) continue;
    seen.add(row.loc);
    parts.push(urlEntry(row.loc, row.lastmod));
  }
  parts.push("</urlset>");
  return new Response(parts.join(""), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === `/${KEY}.txt`) {
      return new Response(KEY, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      });
    }

    if (url.pathname === "/sitemap.xml") {
      return handleSitemapGet(env);
    }

    if (url.pathname === "/web-client/sitemap-add") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      if (request.method === "POST" || request.method === "GET") {
        return handleSitemapAdd(request, env);
      }
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }

    if (!url.pathname.startsWith("/web-client/") || url.pathname.includes("..")) {
      return new Response("Not found", { status: 404 });
    }

    const isAsset = /\.(js|css|map|svg|png|ico|woff2?)$/i.test(url.pathname);
    const upstream = await fetch(GITHUB + url.pathname + url.search, {
      cf: { cacheEverything: true, cacheTtl: isAsset ? 60 : 300 },
    });

    const response = new Response(upstream.body, upstream);
    response.headers.set(
      "Cache-Control",
      isAsset ? "public, max-age=60, must-revalidate" : "public, max-age=300",
    );
    return response;
  },
};
