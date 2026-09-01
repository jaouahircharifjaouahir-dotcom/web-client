import homeFaqEn from "./home-faq.en.json";

export type HomeFaqItem = {
  question: string;
  answerHtml: string;
};

export type HomeFaqDoc = {
  heading: string;
  items: HomeFaqItem[];
};

const EN_DOC = homeFaqEn as HomeFaqDoc;

/** English homepage tool FAQ — locale homes unchanged until translated via i18n pipeline. */
export function homeFaqFor(locale: string): HomeFaqDoc | null {
  const code = String(locale ?? "").trim().toLowerCase();
  if (!code || code !== "en") return null;
  return EN_DOC;
}

export function homeFaqHeading(locale: string): string | null {
  return homeFaqFor(locale)?.heading ?? null;
}

export function homeFaqItems(locale: string): HomeFaqItem[] {
  return homeFaqFor(locale)?.items ?? [];
}
