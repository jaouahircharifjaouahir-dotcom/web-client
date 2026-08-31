import enPack from "./catalog-en.json";

export type UiPack = typeof enPack;

const cache = new Map<string, UiPack>([["en", enPack]]);
const inflight = new Map<string, Promise<UiPack>>();

export const UI_CATALOG_PATH = "/web-client/i18n/ui";

export function uiPackFor(locale: string): UiPack {
  return cache.get(locale) || cache.get("en") || enPack;
}

export async function loadUiCatalog(locale: string): Promise<UiPack> {
  const code = String(locale || "en").toLowerCase();
  if (code === "en" || cache.has(code)) return uiPackFor(code);
  if (inflight.has(code)) return inflight.get(code)!;

  const pending = fetch(`${UI_CATALOG_PATH}/${code}.json`, { credentials: "same-origin", cache: "force-cache" })
    .then(async (res) => {
      if (!res.ok) return enPack;
      const doc = (await res.json()) as UiPack;
      if (!doc?.ui) return enPack;
      cache.set(code, doc);
      return doc;
    })
    .catch(() => enPack)
    .finally(() => inflight.delete(code));

  inflight.set(code, pending);
  return pending;
}

/** Prefetch active locale UI before first React paint (non-en hosts). */
export async function preloadUiCatalog(locale: string): Promise<void> {
  await loadUiCatalog(locale);
}

export function uiHeroIntro(locale: string): string {
  return uiPackFor(locale).ui.heroIntro || enPack.ui.heroIntro;
}

export function uiFoot(locale: string): string {
  return uiPackFor(locale).ui.foot || enPack.ui.foot;
}
