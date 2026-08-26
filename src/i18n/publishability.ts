/**
 * Client-side lookup against /web-client/i18n/publishability.json
 * (compact ready-locale URLs only). Build-time source of truth remains scripts/i18n/publish.mjs.
 */

export type PublishabilityEntry = {
  path: string;
  en: string;
  locales: Record<string, string>;
};

export type PublishabilityDoc = {
  v?: number;
  contents: Record<string, PublishabilityEntry>;
};

export const PUBLISHABILITY_URL = "https://www.11tik.com/web-client/i18n/publishability.json";

let cachedDoc: PublishabilityDoc | null = null;
let inflight: Promise<PublishabilityDoc | null> | null = null;

/** Strip /l/{lang} prefix and restore .html for article/utility paths when CF strips the extension. */
export function normalizeContentPath(pathname: string): string {
  let path = String(pathname || "").replace(/\/+$/, "") || "/";
  const localePrefixed = path.match(/^\/l\/([a-z]{2})(\/.*)?$/i);
  if (localePrefixed) {
    path = localePrefixed[2] || "/";
  }
  if (path !== "/" && !/\.html$/i.test(path) && /^\/(2026|p)\//i.test(path)) {
    path = `${path}.html`;
  }
  return path;
}

export function findPublishabilityEntry(
  doc: PublishabilityDoc | null | undefined,
  pathname: string,
): PublishabilityEntry | null {
  if (!doc?.contents) return null;
  const path = normalizeContentPath(pathname);
  for (const entry of Object.values(doc.contents)) {
    if (entry?.path === path) return entry;
  }
  return null;
}

export function localizedUrlForLocale(entry: PublishabilityEntry, locale: string): string | null {
  if (locale === "en") return entry.en || null;
  const url = entry.locales?.[locale];
  return url || null;
}

/**
 * Resolve destination for a language switch.
 * Ready localized URL when available; English canonical when target missing but content known;
 * locale home when current page is not in the manifest.
 */
export function resolveLocaleDestination(
  currentHref: string,
  targetLocale: string,
  doc: PublishabilityDoc | null | undefined,
  localeHome: (code: string) => string,
): string {
  const here = new URL(currentHref);
  const home = localeHome(targetLocale);
  const entry = findPublishabilityEntry(doc, here.pathname);
  if (!entry) return withSearchAndHash(home, here, true);

  const ready = localizedUrlForLocale(entry, targetLocale);
  const dest = ready || entry.en || home;
  return withSearchAndHash(dest, here, true);
}

/** Guide / legal link: ready locale URL, else English canonical. Never invent a /l/ URL. */
export function resolveLocalizedHref(
  englishHref: string,
  targetLocale: string,
  doc: PublishabilityDoc | null | undefined,
): string {
  if (targetLocale === "en") return englishHref;
  try {
    const path = new URL(englishHref, "https://www.11tik.com").pathname;
    const entry = findPublishabilityEntry(doc, path);
    if (!entry) return englishHref;
    return localizedUrlForLocale(entry, targetLocale) || entry.en || englishHref;
  } catch {
    return englishHref;
  }
}

function withSearchAndHash(dest: string, from: URL, dropLangParam: boolean): string {
  const out = new URL(dest);
  out.search = from.search;
  out.hash = from.hash;
  if (dropLangParam) out.searchParams.delete("lang");
  return out.href;
}

export function getPublishabilityCache(): PublishabilityDoc | null {
  return cachedDoc;
}

export function setPublishabilityCache(doc: PublishabilityDoc | null): void {
  cachedDoc = doc;
}

export async function loadPublishability(fetchImpl: typeof fetch = fetch): Promise<PublishabilityDoc | null> {
  if (cachedDoc) return cachedDoc;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetchImpl(PUBLISHABILITY_URL, { credentials: "omit", cache: "no-cache" });
      if (!res.ok) return null;
      const doc = (await res.json()) as PublishabilityDoc;
      if (!doc || typeof doc !== "object" || !doc.contents) return null;
      cachedDoc = doc;
      return doc;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Fire-and-forget warm for SPA shells. */
export function warmPublishabilityCache(): void {
  if (typeof window === "undefined") return;
  void loadPublishability();
}
