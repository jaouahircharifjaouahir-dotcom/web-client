import { GUIDE_POSTS } from "../content/posts";
import { getPublishabilityCache, resolveLocalizedHref } from "./publishability";
import { readLocale } from "./ui";

export const LOCALE_CATALOG_PATH = "/web-client/i18n/catalog";

export type LocaleCatalogItem = {
  contentId: string;
  type: string;
  url: string;
  title: string;
  description: string;
  ready: boolean;
  sourceHash?: string | null;
};

export type LocaleCatalogDoc = {
  v?: number;
  locale: string;
  count?: number;
  items: LocaleCatalogItem[];
};

const cache = new Map<string, LocaleCatalogDoc | null>();
const inflight = new Map<string, Promise<LocaleCatalogDoc | null>>();

export function catalogUrlFor(locale: string): string {
  return `${LOCALE_CATALOG_PATH}/${locale}.json`;
}

export async function loadLocaleCatalog(locale: string): Promise<LocaleCatalogDoc | null> {
  if (cache.has(locale)) return cache.get(locale) ?? null;
  if (inflight.has(locale)) return inflight.get(locale)!;
  const pending = fetch(catalogUrlFor(locale), { credentials: "same-origin", cache: "no-cache" })
    .then(async (res) => {
      if (!res.ok) return null;
      const doc = (await res.json()) as LocaleCatalogDoc;
      if (!doc || !Array.isArray(doc.items)) return null;
      cache.set(locale, doc);
      return doc;
    })
    .catch(() => null)
    .finally(() => inflight.delete(locale));
  inflight.set(locale, pending);
  return pending;
}

/** Map catalog items to Posts card shape; fall back to GUIDE_POSTS + publishability. */
export function postsFromCatalog(
  doc: LocaleCatalogDoc | null | undefined,
  locale = readLocale(),
): Array<{ contentId?: string; href: string; title: string; summary: string; ready?: boolean }> {
  if (doc?.items?.length) {
    return doc.items.map((item) => ({
      contentId: item.contentId,
      href: item.url,
      title: item.title,
      summary: item.description,
      ready: item.ready,
    }));
  }
  const pub = getPublishabilityCache();
  return GUIDE_POSTS.map((post) => ({
    href: resolveLocalizedHref(post.href, locale, pub),
    title: post.title,
    summary: post.summary,
    ready: locale === "en",
  }));
}
