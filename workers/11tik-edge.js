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
  const id = String(videoId || "").trim();
  let p = platform === "vimeo" ? "vimeo" : "youtube";
  if (p === "youtube" && !YT_ID.test(id) && VIMEO_ID.test(id)) p = "vimeo";
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
  locs.set(`${SITE}/`, null);
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

function sitemapEtag(xml) {
  let hash = 2166136261;
  for (let i = 0; i < xml.length; i += 1) hash = Math.imul(hash ^ xml.charCodeAt(i), 16777619);
  return `"${(hash >>> 0).toString(16)}"`;
}

const KEEP_IDS = ["dQw4w9WgXcQ", "jNQXAC9IVRw", "kJQP7kiw5Fk", "9bZkp7q19f0", "L_jWHffIx5E", "fJ9rUzIMcZQ"];
const THUMB_FILES = ["maxresdefault.webp", "maxresdefault.jpg", "hq720.jpg", "sddefault.jpg", "hqdefault.jpg"];
const HOURLY_UA = { "user-agent": "11tik-hourly-extract/1.0" };

async function pickHourlyVideoId(env) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const extras = [];
  if (env?.SITEMAP_URLS) {
    try {
      const page = await env.SITEMAP_URLS.list({ prefix: "u:youtube:", limit: 40 });
      for (const key of page.keys) {
        const id = key.name.replace(/^u:youtube:/, "");
        if (YT_ID.test(id)) extras.push(id);
      }
    } catch {
      /* seed list is enough */
    }
  }
  const pool = [...KEEP_IDS, ...extras];
  return pool[hour % pool.length];
}

async function hourlyExtract(env) {
  const videoId = await pickHourlyVideoId(env);
  const loc = locFor("youtube", videoId);
  await Promise.allSettled([
    fetch(loc, { headers: HOURLY_UA, redirect: "follow", cf: { cacheTtl: 0 } }),
    fetch(`${SITE}/web-client/blogger-app.js?v=31`, { headers: HOURLY_UA, cf: { cacheTtl: 60 } }),
    fetch(`${SITE}/sitemap.xml`, { headers: HOURLY_UA, cf: { cacheTtl: 0 } }),
    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, {
      headers: HOURLY_UA,
    }),
  ]);
  for (const file of THUMB_FILES) {
    const host = file.endsWith(".webp") ? "vi_webp" : "vi";
    const thumb = `https://i.ytimg.com/${host}/${videoId}/${file}`;
    try {
      const res = await fetch(thumb, { headers: HOURLY_UA, cf: { cacheTtl: 300 } });
      if (res.ok) break;
    } catch {
      /* try next size */
    }
  }
  await saveExtract(env, "youtube", videoId);
  await pingCrawlers();
}

async function pingCrawlers() {
  const sitemap = encodeURIComponent(`${SITE}/sitemap.xml`);
  const targets = [
    `https://www.google.com/ping?sitemap=${sitemap}`,
    `https://www.bing.com/ping?sitemap=${sitemap}`,
    `https://webmaster.yandex.com/ping?sitemap=${sitemap}`,
  ];
  await Promise.allSettled(targets.map((target) => fetch(target, { method: "GET", redirect: "follow" })));
}

async function handleSitemapAdd(request, env, ctx) {
  let platform = "youtube";
  let videoId = "";
  if (request.method === "GET") {
    const url = new URL(request.url);
    platform = url.searchParams.get("platform") || "youtube";
    videoId = url.searchParams.get("videoId") || "";
  } else {
    const url = new URL(request.url);
    platform = url.searchParams.get("platform") || "youtube";
    videoId = url.searchParams.get("videoId") || "";
    try {
      const body = await request.json();
      if (body?.platform) platform = body.platform;
      if (body?.videoId) videoId = body.videoId;
    } catch {
      /* query string is enough (sendBeacon / empty POST) */
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
  ctx?.waitUntil(pingCrawlers());
  return new Response(JSON.stringify({ ok: true, loc, pinged: true }), {
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

async function buildSitemapXml(env) {
  const blogger = await bloggerLocs();
  const extracts = await listExtracts(env);
  const seen = new Set(blogger.keys());
  let newest = "1970-01-01T00:00:00.000Z";
  for (const row of extracts) {
    if (row?.lastmod && row.lastmod > newest) newest = row.lastmod;
  }
  for (const lastmod of blogger.values()) {
    if (lastmod && lastmod > newest) newest = lastmod;
  }
  if (newest === "1970-01-01T00:00:00.000Z") newest = new Date().toISOString();
  blogger.set(`${SITE}/`, newest);
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const [loc, lastmod] of blogger) {
    parts.push(urlEntry(loc, lastmod || newest));
  }
  for (const row of extracts) {
    if (!row?.loc || seen.has(row.loc)) continue;
    seen.add(row.loc);
    parts.push(urlEntry(row.loc, row.lastmod || newest));
  }
  parts.push("</urlset>");
  return { xml: parts.join(""), newest };
}

async function handleSitemapGet(request, env) {
  const { xml, newest } = await buildSitemapXml(env);
  const etag = sitemapEtag(xml);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag,
        "last-modified": new Date(newest).toUTCString(),
        "cache-control": "public, max-age=0, must-revalidate",
      },
    });
  }
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      etag,
      "last-modified": new Date(newest).toUTCString(),
      "x-robots-tag": "noarchive",
    },
  });
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(hourlyExtract(env));
  },
  async fetch(request, env, ctx) {
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
      return handleSitemapGet(request, env);
    }

    if (url.pathname === "/web-client/sitemap-add") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      if (request.method === "POST" || request.method === "GET") {
        return handleSitemapAdd(request, env, ctx);
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
