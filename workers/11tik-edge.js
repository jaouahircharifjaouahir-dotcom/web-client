import {
  ISO6391_CODES,
  RTL_CODES,
  hreflangLinks,
  localeSitemapLocs,
} from "./iso6391.js";
import {
  SITEMAP_PAGE_SIZE,
  allPublicSitemapUrls,
  childSitemapUrls,
  chunkEntries,
  originFromHost,
  parseSitemapPath,
  rewriteLoc,
  robotsTxt,
  sitemapIndexXml,
  urlsetXml,
} from "./sitemaps.js";
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
  fetchYouTubeWatchMeta,
  resolveChannelVideos,
  saveLibraryRow,
  seedBudgetOk,
  slugTag,
  thumbnailApiPayload,
} from "./library.js";

const GITHUB = "https://jaouahircharifjaouahir-dotcom.github.io";
const SITE = "https://www.11tik.com";
const APP_ASSET_V = "51";
const GA_ID = "G-FW7B8NDZZ5";
const OG_IMAGE = "https://www.11tik.com/web-client/images/social/og-image-1200x630.png";
const ICON_32 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj3ow8HyWy9yRQFsg4KZb6tJUZwxmUUEuEBv5FzGZMbQrZ9wzK7tCB5GfEPlvGu4fTNSqAPeke2IJdpwubgUfq7XdryvcebCtYraxd6l2vUDo8hG3RimtLewbO1R4TB1_WehF-PziUil11Sb_rPJZ1YqlS5ikOWvartEdOCVK6s8SsmZaT-qK-HlzzAtG1n/s32/favicon-2.png";
const ICON_16 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEihb_sRR2V8NIZeXgIcfoASdqkVpP_dJJw0aWqqyrfEScm_bdpf5JrwNRLoEqlNhoM9S1c04HkxXeuNcwipE6U4uHtuoqmeMBHTC_oYjQfVuwE8vGuQd-HO9wQrnbT8FjnRanV5l12qwI7oQDo-79aeYKW1RsMZzgcWd-ECWdqJiRy0VCTeNVhycwFxz5bB/s16/favicon-1.png";
const ICON_APPLE =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgsK_kbqmn-MxxqHuxGNn_zB550uVfsk6tOxxn5aOqdpfctXcSb7v38a3W-jVKYS7plgByL7Ab2mslJd3juenu64QRnDc5qmC2yUtFTasYuGEqeJKwkPaag4XazIwU98clI_a6pOvlJ6uFjd9PsOGqW-spiCqDU11skry2hbU9inYPr3k8WUY64rqwl0wNx/s180/apple-touch-icon.png";
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const MAX_URLS = SITEMAP_PAGE_SIZE * 20;
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

function brandHead(copy) {
  return `<link rel="icon" type="image/png" sizes="32x32" href="${ICON_32}"/>
  <link rel="shortcut icon" href="${ICON_32}"/>
  <link rel="icon" type="image/png" sizes="16x16" href="${ICON_16}"/>
  <link rel="apple-touch-icon" sizes="180x180" href="${ICON_APPLE}"/>
  <meta property="og:image" content="${OG_IMAGE}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:image:type" content="image/png"/>
  <meta property="og:image:alt" content="${copy.title}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${copy.title}"/>
  <meta name="twitter:description" content="${copy.description}"/>
  <meta name="twitter:image" content="${OG_IMAGE}"/>
  <meta name="twitter:image:alt" content="${copy.title}"/>`;
}

function assetUrl(file) {
  return `/web-client/${file}?v=${APP_ASSET_V}`;
}

function rightsSnippet() {
  return `<script src="${assetUrl("rights-boot.js")}"></script>`;
}

function gaSnippet() {
  return `<script defer src="${assetUrl("ga-boot.js")}"></script>`;
}

const EMPTY_SOURCEMAP = JSON.stringify({
  version: 3,
  file: "blogger-app.js",
  sources: ["blogger-app.js"],
  names: [],
  mappings: "",
});

async function proxyGithub(pathname, search) {
  if (/\.map$/i.test(pathname)) {
    return new Response(EMPTY_SOURCEMAP, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=86400",
      },
    });
  }
  const isAsset = /\.(?:js|css|svg|png|ico|webp|woff2?|json|webmanifest)$/i.test(pathname);
  const ttl = isAsset ? 2592000 : 600;
  const upstream = await fetch(GITHUB + pathname + search, {
    cf: {
      cacheEverything: true,
      cacheTtl: ttl,
      cacheTtlByStatus: { "200-299": ttl, "404": 30, "500-599": 0 },
    },
  });
  const headers = new Headers(upstream.headers);
  headers.set(
    "cache-control",
    isAsset
      ? "public, max-age=31536000, immutable"
      : "public, max-age=300, stale-while-revalidate=86400",
  );
  headers.set("cdn-cache-control", isAsset ? "max-age=2592000" : "max-age=600");
  headers.set("x-content-type-options", "nosniff");
  if (!headers.has("access-control-allow-origin")) headers.set("access-control-allow-origin", "*");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function locFor(platform, videoId) {
  if (platform === "vimeo") return `${SITE}/?vimeo=${encodeURIComponent(videoId)}`;
  return `${SITE}/?v=${encodeURIComponent(videoId)}`;
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
  let tags = Array.isArray(extra.tags)
    ? extra.tags.map((tag) => String(tag || "").trim().replace(/^#+/, "").trim()).filter(Boolean).slice(0, 40)
    : [];
  let title = String(extra.title || "").slice(0, 180);
  if (platform === "youtube" && (!tags.length || !title)) {
    const watch = await fetchYouTubeWatchMeta(videoId);
    if (!tags.length) tags = watch.tags;
    if (!title && watch.title) title = String(watch.title).slice(0, 180);
  }
  const row = {
    loc,
    lastmod,
    platform,
    videoId,
    title,
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
  const watch = await fetchYouTubeWatchMeta(videoId);
  const title = watch.title || "";
  const tags = watch.tags.length ? watch.tags : ["youtube"];
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
  await saveExtract(env, "youtube", videoId, { title, tags, thumb, source: "seed" });
  await pingCrawlers();
}

function pingEndpoints(sitemapUrl) {
  const sitemap = encodeURIComponent(sitemapUrl);
  return [
    `https://www.google.com/ping?sitemap=${sitemap}`,
    `https://www.bing.com/ping?sitemap=${sitemap}`,
    `https://webmaster.yandex.com/ping?sitemap=${sitemap}`,
  ];
}

async function pingCrawlers(sitemapUrls = [`${SITE}/sitemap.xml`]) {
  const targets = [...new Set(sitemapUrls)].flatMap(pingEndpoints);
  await Promise.allSettled(targets.map((target) => fetch(target, { method: "GET", redirect: "follow" })));
}

async function readShardMeta(env) {
  const raw = await env?.SITEMAP_URLS?.get("meta:sitemap-shards");
  if (!raw) return { urlShards: 1, imageShards: 1 };
  try {
    const parsed = JSON.parse(raw);
    return {
      urlShards: Math.max(1, Number(parsed.urlShards) || 1),
      imageShards: Math.max(1, Number(parsed.imageShards) || 1),
    };
  } catch {
    return { urlShards: 1, imageShards: 1 };
  }
}

async function announceIfNewShards(env, urlShards, imageShards) {
  const next = { urlShards: Math.max(1, urlShards), imageShards: Math.max(1, imageShards) };
  const prev = await readShardMeta(env);
  const changed = next.urlShards !== prev.urlShards || next.imageShards !== prev.imageShards;
  const grew = next.urlShards > prev.urlShards || next.imageShards > prev.imageShards;
  if (changed && env?.SITEMAP_URLS) {
    await env.SITEMAP_URLS.put("meta:sitemap-shards", JSON.stringify(next));
  }
  if (grew) {
    await pingCrawlers(allPublicSitemapUrls(next.urlShards, next.imageShards));
  }
  return grew;
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
  const requestOrigin = originFromHost(new URL(request.url).hostname);
  const pingList = [`${SITE}/sitemap.xml`, `${SITE}/image-sitemap.xml`];
  if (requestOrigin !== SITE) {
    pingList.push(`${requestOrigin}/sitemap.xml`, `${requestOrigin}/image-sitemap.xml`);
  }
  ctx?.waitUntil(gate.decision === "INDEX" ? pingCrawlers(pingList) : Promise.resolve());
  return new Response(JSON.stringify({ ok: true, loc, pinged: gate.decision === "INDEX", gate }), {
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

async function collectPageEntries(env, origin = SITE) {
  const blogger = origin === SITE ? await bloggerLocs() : new Map();
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
  blogger.set(`${origin}/`, newest);
  blogger.set(`${origin}/trending-tags`, newest);
  blogger.set(`${origin}/stats`, newest);
  blogger.set(`${origin}/copyright`, newest);
  blogger.set(`${origin}/guide/youtube-thumbnails`, newest);
  if (origin !== SITE) {
    for (const page of [
      "/p/about.html",
      "/p/privacy.html",
      "/p/terms-of-use.html",
      "/p/contact.html",
      "/p/embed.html",
      "/p/keyword-tools.html",
    ]) {
      blogger.set(`${origin}${page}`, newest);
    }
  }
  if (origin === SITE) {
    for (const loc of localeSitemapLocs()) {
      if (!blogger.has(loc)) blogger.set(loc, newest);
    }
  }
  const indexedTags = await listIndexedTags(env);
  for (const tag of indexedTags) {
    blogger.set(`${origin}/tag/${tag.slug}`, tag.updated || newest);
  }
  const entries = [];
  for (const [loc, lastmod] of blogger) {
    entries.push({ loc: rewriteLoc(loc, origin), lastmod: lastmod || newest });
  }
  for (const row of extracts) {
    if (row?.gate && row.gate.decision !== "INDEX") continue;
    if (!row?.loc) continue;
    const loc = rewriteLoc(row.loc, origin);
    if (seen.has(loc)) continue;
    seen.add(loc);
    entries.push({ loc, lastmod: row.lastmod || newest });
  }
  return { entries, newest };
}

async function collectImageEntries(env, origin = SITE) {
  const rows = await listIndexedExtracts(env, MAX_URLS);
  const entries = [];
  let newest = "1970-01-01T00:00:00.000Z";
  for (const row of rows) {
    if (!row?.loc || !row?.thumb) continue;
    entries.push({ ...row, loc: rewriteLoc(row.loc, origin) });
    if (row.lastmod && row.lastmod > newest) newest = row.lastmod;
  }
  if (newest === "1970-01-01T00:00:00.000Z") newest = new Date().toISOString();
  return { entries, newest };
}

function sitemapResponse(xml, newest, request) {
  const etag = sitemapEtag(xml);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag,
        "last-modified": new Date(newest).toUTCString(),
        "cache-control": "public, max-age=300, must-revalidate",
      },
    });
  }
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, must-revalidate",
      etag,
      "last-modified": new Date(newest).toUTCString(),
      "x-robots-tag": "noarchive",
    },
  });
}

async function handleSitemapRoute(request, env, parsed) {
  const origin = originFromHost(new URL(request.url).hostname);
  const data =
    parsed.kind === "images" ? await collectImageEntries(env, origin) : await collectPageEntries(env, origin);
  const pages = chunkEntries(data.entries);
  await announceIfNewShards(
    env,
    parsed.kind === "pages" ? pages.length : (await readShardMeta(env)).urlShards,
    parsed.kind === "images" ? pages.length : (await readShardMeta(env)).imageShards,
  );
  if (parsed.role === "index") {
    if (pages.length <= 1) {
      const only = pages[0] || [];
      if (parsed.kind === "images") return sitemapResponse(imageSitemapXml(only), data.newest, request);
      return sitemapResponse(urlsetXml(only), data.newest, request);
    }
    const locs = childSitemapUrls(parsed.kind === "images" ? "images" : "pages", pages.length, origin);
    return sitemapResponse(sitemapIndexXml(locs, data.newest), data.newest, request);
  }
  const page = parsed.role === "legacy" ? 1 : parsed.page;
  const slice = pages[page - 1];
  if (!slice) return new Response("Not found", { status: 404 });
  if (parsed.kind === "images") {
    return sitemapResponse(imageSitemapXml(slice), data.newest, request);
  }
  return sitemapResponse(urlsetXml(slice), data.newest, request);
}

async function handleRobots(request, env) {
  const meta = await readShardMeta(env);
  const body = robotsTxt({
    urlShards: meta.urlShards,
    imageShards: meta.imageShards,
    host: request.headers.get("host") || "www.11tik.com",
    origin: originFromHost(new URL(request.url).hostname),
  });
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
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

function localeLegalPath(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/about") return "/p/about.html";
  if (path === "/privacy") return "/p/privacy.html";
  if (path === "/contact") return "/p/contact.html";
  if (path === "/terms") return "/p/terms-of-use.html";
  if (path === "/embed") return "/p/embed.html";
  if (path === "/keyword-tools") return "/p/keyword-tools.html";
  return "";
}

function isAppShellPath(pathname) {
  return /^(?:\/tag\/[^/]+\/?$|\/trending-tags\/?$|\/stats\/?$|\/copyright\/?$|\/p\/copyright\.html$|\/embed\/?$|\/p\/embed\.html$|\/p\/keyword-tools\.html$|\/guide(?:\/[\w-]+)?\/?$|\/hold-queue\/?$|\/about\/?$|\/privacy\/?$|\/terms\/?$|\/contact\/?$)/.test(
    pathname,
  );
}

function localeAppPage(code, host, pathname = "/") {
  const copy = localeCopy(code);
  const origin = `https://${host}/`;
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  const pageUrl = path === "/" ? origin : `https://${host}${path}`;
  const css = assetUrl("blogger-app.css");
  const js = assetUrl("blogger-app.js");
  const html = `<!DOCTYPE html>
<html lang="${copy.lang}" dir="${copy.dir}">
<head>
  ${rightsSnippet()}
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${copy.title}</title>
  <meta name="description" content="${copy.description}"/>
  <link rel="canonical" href="${pageUrl}"/>
  ${hreflangLinks(path)}
  <meta property="og:type" content="website"/>
  <meta property="og:locale" content="${copy.locale}"/>
  <meta property="og:site_name" content="11tik"/>
  <meta property="og:title" content="${copy.title}"/>
  <meta property="og:description" content="${copy.description}"/>
  <meta property="og:url" content="${pageUrl}"/>
  ${brandHead(copy)}
  <link rel="dns-prefetch" href="https://www.googletagmanager.com"/>
  <style>html,body{margin:0;background:#f4efe6}#yte-root{display:block;min-height:100vh}</style>
  <link rel="preload" href="${css}" as="style"/>
  <link rel="preload" href="${js}" as="script"/>
</head>
<body>
  <div id="yte-root"></div>
  <script defer fetchpriority="high" src="${js}"></script>
  ${gaSnippet()}
</body>
</html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=600, stale-while-revalidate=86400",
      link: `<${css}>; rel=preload; as=style, <${js}>; rel=preload; as=script`,
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
  if (url.pathname === "/web-client/youtube-meta") {
    const videoId = url.searchParams.get("v") || "";
    const data = await fetchYouTubeWatchMeta(videoId);
    return jsonResponse(data, data.ok ? 200 : 422);
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

function isWorkerOwnedPath(pathname) {
  return (
    pathname.startsWith("/web-client/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap-pages.xml" ||
    Boolean(parseSitemapPath(pathname)) ||
    pathname.startsWith("/tag/") ||
    pathname === "/trending-tags" ||
    pathname === "/stats" ||
    pathname === "/copyright" ||
    pathname === "/p/copyright.html" ||
    pathname === "/embed" ||
    pathname.startsWith("/embed/") ||
    pathname === "/guide" ||
    pathname.startsWith("/guide/") ||
    pathname.startsWith("/api/") ||
    pathname === "/hold-queue" ||
    pathname === "/about" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/contact"
  );
}

function fetchBlogger(request) {
  const headers = new Headers(request.headers);
  headers.set("x-11tik-pass", "1");
  return fetch(new Request(request.url, { method: "GET", headers }), {
    cf: { resolveOverride: "ghs.googlehosted.com", cacheEverything: true, cacheTtl: 0 },
  });
}

const GH_PAGES = "https://jaouahircharifjaouahir-dotcom.github.io/web-client/";
const EDGE_ASSETS = "https://www.11tik.com/web-client/";

function rewriteGithubAsset(el, attr) {
  const value = el.getAttribute(attr) || "";
  if (value.startsWith(GH_PAGES)) el.setAttribute(attr, EDGE_ASSETS + value.slice(GH_PAGES.length));
}

function bloggerRuntimeStubs() {
  return `<script>window.cookieChoices=window.cookieChoices||{};function _WidgetInfo(){return this;}window._WidgetInfo=window._WidgetInfo||_WidgetInfo;window._WidgetManager=window._WidgetManager||new Proxy({},{get:function(t,p){if(p==="then")return;return function(){return t;}}});</script>`;
}

function polishBloggerHtml(response) {
  return new HTMLRewriter()
    .on("head", {
      element(el) {
        el.prepend(bloggerRuntimeStubs(), { html: true });
      },
    })
    .on("script[src]", {
      element(el) {
        const src = el.getAttribute("src") || "";
        if (src.includes("widgets.js") || src.includes("/static/v1/widgets/") || src.includes("cookienotice.js")) {
          el.remove();
        }
      },
    })
    .on("link[rel]", {
      element(el) {
        if ((el.getAttribute("rel") || "").toLowerCase() !== "preconnect") return;
        const href = el.getAttribute("href") || "";
        if (href.includes("www.11tik.com") || href.includes("i.ytimg.com")) el.remove();
      },
    })
    .on("img[src]", {
      element(el) {
        rewriteGithubAsset(el, "src");
      },
    })
    .on("img.yte-preview", {
      element(el) {
        el.setAttribute("src", `${EDGE_ASSETS}images/social/og-image-640x336.webp`);
        el.setAttribute(
          "srcset",
          `${EDGE_ASSETS}images/social/og-image-640x336.webp 640w, ${EDGE_ASSETS}images/social/og-image-1200x630.png 1200w`,
        );
        el.setAttribute("sizes", "(max-width: 640px) 100vw, 640px");
        el.setAttribute("width", "640");
        el.setAttribute("height", "336");
      },
    })
    .on("meta[content]", {
      element(el) {
        rewriteGithubAsset(el, "content");
      },
    })
    .transform(response);
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(hourlyExtract(env));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
    if (host === "www.11tik.com" && request.headers.get("x-11tik-pass") !== "1" && !isWorkerOwnedPath(url.pathname)) {
      return polishBloggerHtml(await fetchBlogger(request));
    }
    const lang = localeHostCode(host);

    const api = await handleLibraryApi(url, request, env);
    if (api) return api;

    if (host === "www.11tik.com") {
      const legal = legalPageRedirect(url.pathname);
      if (legal) {
        return Response.redirect(legal, 301);
      }
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

    if (url.pathname === "/robots.txt") {
      return handleRobots(request, env);
    }
    if (url.pathname === "/sitemap-pages.xml") {
      if (host === "www.11tik.com") return fetchBlogger(request);
      return new Response("Not found", { status: 404 });
    }
    const sitemapPath = parseSitemapPath(url.pathname);
    if (sitemapPath) {
      return handleSitemapRoute(request, env, sitemapPath);
    }

    if (lang) {
      if (lang === "en") {
        return Response.redirect("https://www.11tik.com/" + url.pathname + url.search + url.hash, 301);
      }
      const legalPath = localeLegalPath(url.pathname);
      if (legalPath) {
        return Response.redirect(`https://${host}${legalPath}${url.search}`, 301);
      }
      if (url.pathname.startsWith("/web-client/") && !url.pathname.includes("..")) {
        return proxyGithub(url.pathname, url.search);
      }
      return localeAppPage(lang, host, url.pathname);
    }

    if (isAppShellPath(url.pathname)) {
      return localeAppPage("en", "www.11tik.com", url.pathname);
    }

    if (!url.pathname.startsWith("/web-client/") || url.pathname.includes("..")) {
      return new Response("Not found", { status: 404 });
    }

    return proxyGithub(url.pathname, url.search);
  },
};
