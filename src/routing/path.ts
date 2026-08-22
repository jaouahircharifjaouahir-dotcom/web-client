export type AppRoute =
  | { name: "home" }
  | { name: "tag"; slug: string }
  | { name: "trending" }
  | { name: "stats" }
  | { name: "copyright" }
  | { name: "guide"; slug: string }
  | { name: "hold" }
  | { name: "about" }
  | { name: "privacy" }
  | { name: "terms" }
  | { name: "contact" }
  | { name: "embed" }
  | { name: "keywords" };

export function parseAppRoute(pathname = typeof location === "undefined" ? "/" : location.pathname): AppRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  const tag = path.match(/\/tag\/([^/]+)$/);
  if (tag) return { name: "tag", slug: decodeURIComponent(tag[1]) };
  if (path.endsWith("/trending-tags")) return { name: "trending" };
  if (path.endsWith("/stats")) return { name: "stats" };
  if (path.endsWith("/copyright") || path.endsWith("/p/copyright.html")) return { name: "copyright" };
  if (path.endsWith("/hold-queue")) return { name: "hold" };
  if (path.endsWith("/about") || path.endsWith("/p/about.html")) return { name: "about" };
  if (path.endsWith("/privacy") || path.endsWith("/p/privacy.html")) return { name: "privacy" };
  if (path.endsWith("/terms") || path.endsWith("/p/terms-of-use.html") || path.endsWith("/terms-of-use.html")) return { name: "terms" };
  if (path.endsWith("/contact") || path.endsWith("/p/contact.html")) return { name: "contact" };
  if (path.endsWith("/embed") || path.endsWith("/p/embed.html")) return { name: "embed" };
  if (path.endsWith("/keyword-tools") || path.endsWith("/p/keyword-tools.html")) return { name: "keywords" };
  const guide = path.match(/\/guide\/([^/]+)$/) || (path.endsWith("/guide") ? ["", "youtube-thumbnails"] : null);
  if (guide) return { name: "guide", slug: guide[1] || "youtube-thumbnails" };
  return { name: "home" };
}
