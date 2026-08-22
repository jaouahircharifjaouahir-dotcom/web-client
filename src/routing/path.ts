export type AppRoute =
  | { name: "home" }
  | { name: "tag"; slug: string }
  | { name: "trending" }
  | { name: "stats" }
  | { name: "copyright" }
  | { name: "guide"; slug: string }
  | { name: "hold" };

export function parseAppRoute(pathname = typeof location === "undefined" ? "/" : location.pathname): AppRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  const tag = path.match(/\/tag\/([^/]+)$/);
  if (tag) return { name: "tag", slug: decodeURIComponent(tag[1]) };
  if (path.endsWith("/trending-tags")) return { name: "trending" };
  if (path.endsWith("/stats")) return { name: "stats" };
  if (path.endsWith("/copyright") || path.endsWith("/p/copyright.html")) return { name: "copyright" };
  if (path.endsWith("/hold-queue")) return { name: "hold" };
  const guide = path.match(/\/guide\/([^/]+)$/) || (path.endsWith("/guide") ? ["", "youtube-thumbnails"] : null);
  if (guide) return { name: "guide", slug: guide[1] || "youtube-thumbnails" };
  return { name: "home" };
}
