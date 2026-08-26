import catalog from "./catalog.json";
import nativeNames from "./native-names.json";
import { ISO6391, ISO6391_CODES, RTL_CODES } from "../../workers/iso6391.js";
import { GUIDE_POSTS } from "../content/posts";
import {
  getPublishabilityCache,
  loadPublishability,
  resolveLocaleDestination,
  resolveLocalizedHref,
  warmPublishabilityCache,
} from "./publishability";

export type UiKey = keyof (typeof catalog)["en"]["ui"];

export { warmPublishabilityCache };

function hostLocale(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const match = /^([a-z]{2})\.11tik\.com$/i.exec(host);
  if (match) {
    const code = match[1].toLowerCase();
    if (code === "en") return "en";
    if (ISO6391_CODES.has(code)) return code;
  }
  if (host === "www.11tik.com" || host === "11tik.com") return "en";
  return "";
}

export function readLocale(): string {
  const fromHost = hostLocale();
  if (fromHost) return fromHost;
  if (typeof window === "undefined") return "en";
  const query = new URLSearchParams(window.location.search).get("lang")?.toLowerCase() || "";
  if (query && ISO6391_CODES.has(query)) return query;
  try {
    const stored = localStorage.getItem("yte-lang") || "";
    if (stored && ISO6391_CODES.has(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "en";
}

export function localeHomeUrl(code = readLocale()): string {
  if (code === "en") return "https://www.11tik.com/";
  return `https://${code}.11tik.com/l/${code}/`;
}

export function publicOrigin(): string {
  if (typeof window !== "undefined" && /(^|\.)11tik\.com$/i.test(window.location.hostname)) {
    const host = window.location.hostname.toLowerCase();
    if (host === "11tik.com") return "https://www.11tik.com";
    return `https://${host}`;
  }
  const code = readLocale();
  if (code === "en") return "https://www.11tik.com";
  return `https://${code}.11tik.com`;
}

export function t(key: UiKey): string {
  const locale = readLocale();
  const pack = catalog[locale as keyof typeof catalog] || catalog.en;
  return pack.ui[key] || catalog.en.ui[key];
}

export function languageOptions(): { code: string; label: string }[] {
  return ISO6391.map(([code, english]) => ({
    code,
    label: (nativeNames as Record<string, string>)[code] || english,
  }));
}

export function isRtl(code = readLocale()): boolean {
  return RTL_CODES.has(code);
}

export function guidePosts() {
  const locale = readLocale();
  const pack = catalog[locale as keyof typeof catalog] || catalog.en;
  const doc = getPublishabilityCache();
  return GUIDE_POSTS.map((post, index) => ({
    ...post,
    href: resolveLocalizedHref(post.href, locale, doc),
    title: pack.posts[index]?.title || post.title,
    summary: pack.posts[index]?.summary || post.summary,
  }));
}

/**
 * Path-aware language switch: ready publishability URL when the current page
 * maps to localizable content; otherwise locale home.
 */
export async function switchLocale(code: string): Promise<void> {
  if (!ISO6391_CODES.has(code)) return;
  try {
    localStorage.setItem("yte-lang", code);
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return;
  const here = new URL(window.location.href);
  const onProduct = /(^|\.)11tik\.com$/i.test(here.hostname);
  if (!onProduct) {
    here.searchParams.set("lang", code);
    window.location.assign(here.href);
    return;
  }

  const doc = (await loadPublishability()) || getPublishabilityCache();
  const dest = resolveLocaleDestination(here.href, code, doc, localeHomeUrl);
  window.location.assign(dest);
}
