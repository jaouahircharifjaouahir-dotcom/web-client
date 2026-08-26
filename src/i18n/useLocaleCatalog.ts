import { useEffect, useState } from "react";
import { loadLocaleCatalog, postsFromCatalog, type LocaleCatalogDoc } from "./localeCatalog";
import { readLocale } from "./ui";

/** Load build-time Posts catalog for the active locale. */
export function useLocaleCatalog(locale = readLocale()) {
  const [doc, setDoc] = useState<LocaleCatalogDoc | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadLocaleCatalog(locale).then((next) => {
      if (cancelled) return;
      setDoc(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return {
    doc,
    ready,
    posts: postsFromCatalog(doc, locale),
  };
}
