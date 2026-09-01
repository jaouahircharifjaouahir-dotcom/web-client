import homeFaqEn from "./home-faq.en.json";

export type HomeFaqItem = {
  question: string;
  answerHtml: string;
};

export type HomeFaqDoc = {
  heading: string;
  items: HomeFaqItem[];
};

const EN_DOC: HomeFaqDoc = {
  heading: homeFaqEn.heading,
  items: homeFaqEn.items as HomeFaqItem[],
};

const cache = new Map<string, HomeFaqDoc>([["en", EN_DOC]]);

/** Load homepage FAQ for a locale (sync — uses build-time bundled EN; locales load via async). */
export function homeFaqFor(locale: string): HomeFaqDoc | null {
  const code = String(locale ?? "").trim().toLowerCase();
  if (!code) return null;
  if (cache.has(code)) return cache.get(code) ?? null;
  return code === "en" ? EN_DOC : null;
}

export function setHomeFaqCache(locale: string, doc: HomeFaqDoc | null) {
  const code = String(locale || "en").toLowerCase();
  if (doc) cache.set(code, doc);
  else cache.delete(code);
}

export function homeFaqHeading(locale: string): string | null {
  return homeFaqFor(locale)?.heading ?? null;
}

export function homeFaqItems(locale: string): HomeFaqItem[] {
  return homeFaqFor(locale)?.items ?? [];
}
