const KEY = "9f3a7c1e4b8d2f06a5c9e3b7d1f48a26";
const GITHUB = "https://jaouahircharifjaouahir-dotcom.github.io";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === `/${KEY}.txt`) {
      return new Response(KEY, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      });
    }

    if (!url.pathname.startsWith("/web-client/") || url.pathname.includes("..")) {
      return new Response("Not found", { status: 404 });
    }

    const upstream = await fetch(GITHUB + url.pathname + url.search, {
      cf: { cacheEverything: true, cacheTtl: 86400 },
    });

    const response = new Response(upstream.body, upstream);
    response.headers.set("Cache-Control", "public, max-age=86400");
    return response;
  },
};
