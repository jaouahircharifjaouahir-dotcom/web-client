import {
  ISO6391_CODES,
  RTL_CODES,
  hreflangLinks,
  localeSitemapLocs,
} from "./iso6391.js";
import localeMeta from "./locale-meta.json";
import {
  embedWidgetHtml,
  imageSitemapXml,
  jsonResponse,
  listHoldQueue,
  listIndexedExtracts,
  listIndexedTags,
  pickTrendingSeedId,
  qualityForVideo,
  rateLimitOk,
  readLibraryRow,
  readTag,
  resolveChannelVideos,
  saveLibraryRow,
  seedBudgetOk,
  slugTag,
  thumbnailApiPayload,
} from "./library.js";

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

async function saveExtract(env, platform, videoId, extra = {}) {
  const loc = locFor(platform, videoId);
  const lastmod = new Date().toISOString();
  const tags = Array.isArray(extra.tags) ? extra.tags.map(slugTag).filter(Boolean).slice(0, 12) : [];
  const row = {
    loc,
    lastmod,
    platform,
    videoId,
    title: String(extra.title || "").slice(0, 180),
    tags,
    thumb: String(extra.thumb || extra.thumbnail || ""),
    source: extra.source === "seed" ? "seed" : "user",
  };
  const map = await loadCacheMap();
  map[`${platform}:${videoId}`] = { loc, lastmod };
  await saveCacheMap(map);
  await saveLibraryRow(env, row);
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
  if (!(await seedBudgetOk(env))) return;
  const videoId = (await pickTrendingSeedId()) || (await pickHourlyVideoId(env));
  if (!videoId) return;
  let title = "";
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { headers: HOURLY_UA },
    );
    if (oembed.ok) {
      const data = await oembed.json();
      title = String(data.title || "");
    }
  } catch {
    /* title optional until gate */
  }
  let thumb = "";
  for (const file of THUMB_FILES) {
    const host = file.endsWith(".webp") ? "vi_webp" : "vi";
    const url = `https://i.ytimg.com/${host}/${videoId}/${file}`;
    try {
      const res = await fetch(url, { headers: HOURLY_UA, cf: { cacheTtl: 300 } });
      if (res.ok) {
        thumb = url;
        break;
      }
    } catch {
      /* next */
    }
  }
  const tags = title
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g)
    ?.slice(0, 6) || ["youtube", "thumbnail"];
  await saveExtract(env, "youtube", videoId, { title, tags, thumb, source: "seed" });
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
  const url = new URL(request.url);
  let platform = url.searchParams.get("platform") || "youtube";
  let videoId = url.searchParams.get("videoId") || "";
  let extra = {};
  if (request.method !== "GET") {
    try {
      extra = await request.json();
      if (extra?.platform) platform = extra.platform;
      if (extra?.videoId) videoId = extra.videoId;
    } catch {
      extra = {};
    }
  }
  const parsed = parseIds(platform, videoId);
  if (!parsed) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_id" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }
  const ip = request.headers.get("cf-connecting-ip") || "";
  if (!(await rateLimitOk(env, ip))) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429);
  }
  const loc = await saveExtract(env, parsed.platform, parsed.videoId, extra);
  const stored = await readLibraryRow(env, parsed.platform, parsed.videoId);
  const gate = stored?.gate || qualityForVideo(stored || {});
  ctx?.waitUntil(gate.decision === "INDEX" ? pingCrawlers() : Promise.resolve());
  return new Response(JSON.stringify({ ok: true, loc, pinged: gate.decision === "INDEX", gate }), {
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
  blogger.set(`${SITE}/trending-tags`, newest);
  blogger.set(`${SITE}/stats`, newest);
  blogger.set(`${SITE}/copyright`, newest);
  blogger.set(`${SITE}/guide/youtube-thumbnails`, newest);
  for (const loc of localeSitemapLocs()) {
    if (!blogger.has(loc)) blogger.set(loc, newest);
  }
  const indexedTags = await listIndexedTags(env);
  for (const tag of indexedTags) {
    blogger.set(`${SITE}/tag/${tag.slug}`, tag.updated || newest);
  }
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const [loc, lastmod] of blogger) {
    parts.push(urlEntry(loc, lastmod || newest));
  }
  for (const row of extracts) {
    if (row?.gate && row.gate.decision !== "INDEX") continue;
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

function localeCopy(code) {
  const meta = localeMeta[code] || localeMeta.en;
  return {
    lang: code,
    locale: `${code}_${code.toUpperCase()}`,
    dir: RTL_CODES.has(code) ? "rtl" : meta.dir || "ltr",
    title: xmlEscape(meta.title),
    description: xmlEscape(meta.description),
  };
}

function legalPageRedirect(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/about") return `${SITE}/p/about.html`;
  if (path === "/privacy") return `${SITE}/p/privacy.html`;
  if (path === "/contact") return `${SITE}/p/contact.html`;
  if (path === "/terms") return `${SITE}/p/terms-of-use.html`;
  return "";
}

function isAppShellPath(pathname) {
  return /^(?:\/tag\/[^/]+\/?$|\/trending-tags\/?$|\/stats\/?$|\/copyright\/?$|\/p\/copyright\.html$|\/embed\/?$|\/guide(?:\/[\w-]+)?\/?$|\/hold-queue\/?$)/.test(
    pathname,
  );
}

function localeAppPage(code, host) {
  const copy = localeCopy(code);
  const origin = `https://${host}/`;
  const html = `<!DOCTYPE html>
<html lang="${copy.lang}" dir="${copy.dir}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${copy.title}</title>
  <meta name="description" content="${copy.description}"/>
  <link rel="canonical" href="${origin}"/>
  ${hreflangLinks()}
  <meta property="og:type" content="website"/>
  <meta property="og:locale" content="${copy.locale}"/>
  <meta property="og:site_name" content="11tik"/>
  <meta property="og:title" content="${copy.title}"/>
  <meta property="og:description" content="${copy.description}"/>
  <meta property="og:url" content="${origin}"/>
  <meta property="og:image" content="https://www.11tik.com/web-client/images/social/og-image-1200x630.png"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <style>html,body{margin:0;background:#f4efe6}#yte-root{display:block;min-height:100vh}</style>
  <link rel="preload" href="https://www.11tik.com/web-client/blogger-app.css?v=36" as="style"/>
  <link rel="preload" href="https://www.11tik.com/web-client/blogger-app.js?v=36" as="script"/>
</head>
<body>
  <div id="yte-root"></div>
  <script defer src="https://www.11tik.com/web-client/blogger-app.js?v=36"></script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function localeHostCode(host) {
  const match = /^([a-z]{2})\.11tik\.com$/i.exec(host || "");
  if (!match) return "";
  const code = match[1].toLowerCase();
  if (!ISO6391_CODES.has(code)) return "";
  return code;
}

async function handleLibraryApi(url, request, env) {
  if (url.pathname === "/image-sitemap.xml") {
    const rows = await listIndexedExtracts(env, 10000);
    return new Response(imageSitemapXml(rows), {
      headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  }
  if (url.pathname === "/embed" || url.pathname === "/embed/") {
    return new Response(embedWidgetHtml(url.searchParams.get("v") || ""), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" },
    });
  }
  if (url.pathname === "/api/thumbnail" || url.pathname === "/web-client/api/thumbnail") {
    const target = url.searchParams.get("url") || "";
    const yt = target.match(/([A-Za-z0-9_-]{11})/);
    const vimeo = target.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/i);
    if (vimeo) return jsonResponse(thumbnailApiPayload("vimeo", vimeo[1]));
    if (yt && /youtu/i.test(target)) return jsonResponse(thumbnailApiPayload("youtube", yt[1]));
    if (url.searchParams.get("v") && YT_ID.test(url.searchParams.get("v"))) {
      return jsonResponse(thumbnailApiPayload("youtube", url.searchParams.get("v")));
    }
    return jsonResponse({ ok: false, error: "url required, example ?url=https://www.youtube.com/watch?v=ID" }, 400);
  }
  if (url.pathname === "/web-client/channel-videos") {
    const data = await resolveChannelVideos(url.searchParams.get("url") || "", url.searchParams.get("limit") || 20);
    return jsonResponse(data, data.ok ? 200 : 422);
  }
  if (url.pathname === "/web-client/tags/trending.json" || url.pathname === "/trending-tags.json") {
    const tags = await listIndexedTags(env);
    return jsonResponse({ ok: true, tags: tags.slice(0, 80).map((row) => ({ slug: row.slug, name: row.name, count: row.count })) });
  }
  if (url.pathname.startsWith("/web-client/tags/") && url.pathname.endsWith(".json")) {
    const slug = url.pathname.slice("/web-client/tags/".length, -".json".length);
    const pack = await readTag(env, slug);
    if (!pack) return jsonResponse({ ok: false, error: "not_found" }, 404);
    const videos = [];
    for (const key of (pack.videos || []).slice(-48).reverse()) {
      const raw = await env.SITEMAP_URLS?.get(key);
      if (!raw) continue;
      try {
        videos.push(JSON.parse(raw));
      } catch {
        /* skip */
      }
    }
    return jsonResponse({ ok: true, tag: pack, videos, robots: pack.gate?.decision === "INDEX" ? "index,follow" : "noindex,follow" });
  }
  if (url.pathname === "/web-client/hold-queue.json" || url.pathname === "/hold-queue.json") {
    const hold = await listHoldQueue(env);
    return jsonResponse({ ok: true, hold: hold.slice(0, 200) });
  }
  return null;
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(hourlyExtract(env));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
    const lang = localeHostCode(host);

    const api = await handleLibraryApi(url, request, env);
    if (api) return api;

    const legal = legalPageRedirect(url.pathname);
    if (legal) {
      return Response.redirect(legal, 301);
    }

    if (lang) {
      if (lang === "en") {
        return Response.redirect("https://www.11tik.com/" + url.pathname + url.search + url.hash, 301);
      }
      if (url.pathname === "/robots.txt") {
        return new Response("User-agent: *\nAllow: /\nSitemap: https://www.11tik.com/sitemap.xml\n", {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      if (url.pathname === "/sitemap.xml") {
        return handleSitemapGet(request, env);
      }
      if (url.pathname.startsWith("/web-client/") && !url.pathname.includes("..")) {
        const isAsset = /\.(js|css|map|svg|png|ico|woff2?)$/i.test(url.pathname);
        const upstream = await fetch(GITHUB + url.pathname + url.search, {
          cf: { cacheEverything: true, cacheTtl: isAsset ? 60 : 300 },
        });
        return new Response(upstream.body, upstream);
      }
      return localeAppPage(lang, host);
    }

    if (url.pathname === "/sitemap.xml") {
      return handleSitemapGet(request, env);
    }

    if (isAppShellPath(url.pathname)) {
      return localeAppPage("en", "www.11tik.com");
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
