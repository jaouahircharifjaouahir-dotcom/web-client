import { useEffect, useState } from "react";
import { readLocale } from "../i18n/ui";
import homeDetailsPack from "../i18n/home-details-pack.json";

const DETAILS_PATH = "/web-client/i18n/home-details";

type DetailsItem = { id: string; heading: string; bodyHtml: string };
type DetailsDoc = { blockId: string; summary: string; items: DetailsItem[] };

const cache = new Map<string, DetailsDoc>();

function packToDoc(locale: string): DetailsDoc | null {
  const pack = (homeDetailsPack as Record<string, Record<string, string>>)[locale];
  if (!pack?.legalTitle || !pack.legalQ1) return null;
  return {
    blockId: "yte-home-details-legal",
    summary: pack.legalTitle,
    items: [
      { id: "legal-q1", heading: pack.legalQ1, bodyHtml: pack.legalA1 },
      { id: "legal-q2", heading: pack.legalQ2, bodyHtml: pack.legalA2 },
      { id: "legal-q3", heading: pack.legalQ3, bodyHtml: pack.legalA3 },
    ],
  };
}

/** Copyright & Usage details panel — matches crawlable homepage shell. */
export function HomeDetails() {
  const locale = readLocale();
  const [doc, setDoc] = useState<DetailsDoc | null>(() => {
    const code = String(locale || "en").toLowerCase();
    return cache.get(code) ?? packToDoc(code) ?? packToDoc("en");
  });

  useEffect(() => {
    const code = String(locale || "en").toLowerCase();
    if (cache.has(code)) {
      setDoc(cache.get(code) ?? null);
      return;
    }
    const fromPack = packToDoc(code);
    if (fromPack) {
      cache.set(code, fromPack);
      setDoc(fromPack);
      return;
    }
    let cancelled = false;
    fetch(`${DETAILS_PATH}/${code}.json`, { credentials: "same-origin", cache: "force-cache" })
      .then(async (res) => (res.ok ? ((await res.json()) as DetailsDoc) : packToDoc("en")))
      .then((loaded) => {
        if (cancelled || !loaded?.items?.length) return;
        cache.set(code, loaded);
        setDoc(loaded);
      })
      .catch(() => {
        if (!cancelled) setDoc(packToDoc("en"));
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (!doc?.items?.length) return null;

  return (
    <details className="yte-panel yte-home-details" id={doc.blockId || "yte-home-details-legal"}>
      <summary>{doc.summary}</summary>
      {doc.items.map((item) => (
        <div key={item.id}>
          <h3>{item.heading}</h3>
          <p dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
        </div>
      ))}
    </details>
  );
}
