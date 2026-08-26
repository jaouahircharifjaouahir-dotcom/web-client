/**
 * Home app view state — URL-addressable via ?posts=1 | ?bulk=1 (mutually exclusive).
 * SEO: application views on the locale home; canonical stays the home URL (no extra indexable variants).
 */
export type HomeView = "home" | "posts" | "bulk";

export function readHomeView(href: string = typeof window !== "undefined" ? window.location.href : ""): HomeView {
  try {
    const q = new URL(href, "https://www.11tik.com").searchParams;
    if (q.get("bulk") === "1") return "bulk";
    if (q.get("posts") === "1") return "posts";
  } catch {
    /* ignore */
  }
  return "home";
}

/** Build href for a home view on a locale home base (absolute or path). */
export function homeViewHref(view: HomeView, homeBase: string): string {
  const base = homeBase.endsWith("/") || homeBase.includes("?") ? homeBase : `${homeBase}/`;
  const url = new URL(base, "https://www.11tik.com");
  url.searchParams.delete("posts");
  url.searchParams.delete("bulk");
  if (view === "posts") url.searchParams.set("posts", "1");
  if (view === "bulk") url.searchParams.set("bulk", "1");
  // Prefer absolute when base was absolute; else path+search for same-origin pushState.
  if (/^https?:\/\//i.test(homeBase)) return url.href;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Mutate a URL string to the given view (preserves other params except posts/bulk). */
export function withHomeView(href: string, view: HomeView): string {
  const url = new URL(href, "https://www.11tik.com");
  url.searchParams.delete("posts");
  url.searchParams.delete("bulk");
  if (view === "posts") url.searchParams.set("posts", "1");
  if (view === "bulk") url.searchParams.set("bulk", "1");
  return url.href;
}
