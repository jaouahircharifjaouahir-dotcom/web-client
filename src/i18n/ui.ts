import enPack from "./catalog-en.json";
import nativeNames from "./native-names.json";
import targetLanguages from "../../config/target-languages.json";
import { ISO6391_CODES, RTL_CODES } from "../../workers/iso6391.js";
import { GUIDE_POSTS } from "../content/posts";
import {
  getPublishabilityCache,
  loadPublishability,
  resolveLocaleDestination,
  resolveLocalizedHref,
  warmPublishabilityCache,
  type PublishabilityDoc,
} from "./publishability";
import { loadUiCatalog, uiPackFor } from "./uiCatalog";

export type UiKey = keyof typeof enPack.ui;

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
  const pack = uiPackFor(locale);
  return pack.ui[key] || enPack.ui[key];
}

export function tFill(key: UiKey, vars: Record<string, string | number>): string {
  let text = t(key);
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

/** English + enabled target locales from config/target-languages.json (native labels). */
export function languageOptions(): { code: string; label: string }[] {
  const targets = (targetLanguages.languages || [])
    .filter((row: { enabled?: boolean }) => row.enabled !== false)
    .map((row: { code: string; nativeName?: string; language?: string }) => ({
      code: row.code,
      label:
        row.nativeName ||
        (nativeNames as Record<string, string>)[row.code] ||
        row.language ||
        row.code,
    }))
    .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "en"));
  return [{ code: "en", label: (nativeNames as Record<string, string>).en || "English" }, ...targets];
}

export function isRtl(code = readLocale()): boolean {
  return RTL_CODES.has(code);
}

export function guidePosts(options?: { locale?: string; doc?: PublishabilityDoc | null }) {
  const locale = options?.locale ?? readLocale();
  const pack = uiPackFor(locale);
  const doc = options && "doc" in options ? options.doc : getPublishabilityCache();
  return GUIDE_POSTS.map((post, index) => ({
    ...post,
    href: resolveLocalizedHref(post.href, locale, doc ?? null),
    title: pack.posts[index]?.title || post.title,
    summary: pack.posts[index]?.summary || post.summary,
  }));
}

/** Warm UI strings for the active locale (no-op for English). */
export function warmUiCatalog(locale = readLocale()): Promise<void> {
  return loadUiCatalog(locale).then(() => undefined);
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
