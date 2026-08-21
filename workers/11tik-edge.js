const KEY = "9f3a7c1e4b8d2f06a5c9e3b7d1f48a26";
const GITHUB = "https://jaouahircharifjaouahir-dotcom.github.io";
const SITE = "https://www.11tik.com";
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const MAX_URLS = 45000;

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

async function bloggerLocs() {
  const locs = new Map();
  locs.set(`${SITE}/`, new Date().toISOString());
  const feeds = [
    `${SITE}/feeds/posts/default?alt=rss&max-results=150`,
    `${SITE}/sitemap-pages.xml`,
  ];
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

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

async function listExtracts(kv) {
  const out = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: "u:", cursor, limit: 1000 });
    for (const key of page.keys) {
      const loc = await kv.get(key.name);
      if (loc) out.push(loc);
    }
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);
  return out.slice(0, MAX_URLS);
}

async function handleSitemapAdd(request, env) {
  if (!env?.SITEMAP_URLS) {
    return new Response(JSON.stringify({ ok: false, error: "kv_unbound" }), {
      status: 503,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }
  const platform = body.platform === "vimeo" ? "vimeo" : "youtube";
  const videoId = String(body.videoId || "").trim();
  if (platform === "youtube" && !YT_ID.test(videoId)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_id" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }
  if (platform === "vimeo" && !VIMEO_ID.test(videoId)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_id" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }
  const loc = locFor(platform, videoId);
  const lastmod = new Date().toISOString();
  await env.SITEMAP_URLS.put(`u:${platform}:${videoId}`, JSON.stringify({ loc, lastmod }));
  return new Response(JSON.stringify({ ok: true, loc }), {
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

async function handleSitemapGet(env) {
  const blogger = await bloggerLocs();
  const extracts = env?.SITEMAP_URLS ? await listExtracts(env.SITEMAP_URLS) : [];
  const seen = new Set(blogger.keys());
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const [loc, lastmod] of blogger) {
    parts.push(urlEntry(loc, lastmod));
  }
  for (const raw of extracts) {
    let row;
    try {
      row = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!row?.loc || seen.has(row.loc)) continue;
    seen.add(row.loc);
    parts.push(urlEntry(row.loc, row.lastmod));
  }
  parts.push("</urlset>");
  return new Response(parts.join(""), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
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
      if (request.method === "POST") return handleSitemapAdd(request, env);
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
