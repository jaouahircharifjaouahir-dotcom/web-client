import { useEffect, useState } from "react";
import { readLocale } from "../i18n/ui";

const CAPS_PATH = "/web-client/i18n/home-caps-hubs";

type CapsHubsDoc = {
  capsHeading: string;
  capsItems: { html: string }[];
  hubsHeading: string;
  hubsItems: { html: string }[];
};

const cache = new Map<string, CapsHubsDoc>();

/** Hub + capability blocks matching the crawlable homepage shell (all locales). */
export function HomeHubsCaps() {
  const locale = readLocale();
  const [doc, setDoc] = useState<CapsHubsDoc | null>(() => cache.get(locale) ?? null);

  useEffect(() => {
    const code = String(locale || "en").toLowerCase();
    if (cache.has(code)) {
      setDoc(cache.get(code) ?? null);
      return;
    }
    let cancelled = false;
    fetch(`${CAPS_PATH}/${code}.json`, { credentials: "same-origin", cache: "force-cache" })
      .then(async (res) => {
        if (res.ok) return (await res.json()) as CapsHubsDoc;
        if (code !== "en") {
          const enRes = await fetch(`${CAPS_PATH}/en.json`, {
            credentials: "same-origin",
            cache: "force-cache",
          });
          if (enRes.ok) return (await enRes.json()) as CapsHubsDoc;
        }
        return null;
      })
      .then((loaded) => {
        if (cancelled || !loaded?.capsItems?.length) return;
        cache.set(code, loaded);
        setDoc(loaded);
      })
      .catch(() => {
        if (!cancelled) setDoc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (!doc?.capsItems?.length || !doc?.hubsItems?.length) return null;

  return (
    <>
      <section className="yte-panel yte-home-caps" aria-labelledby="yte-home-caps-heading">
        <h2 id="yte-home-caps-heading">{doc.capsHeading}</h2>
        <ul>
          {doc.capsItems.map((item) => (
            <li key={item.html.slice(0, 48)} dangerouslySetInnerHTML={{ __html: item.html }} />
          ))}
        </ul>
      </section>
      <section className="yte-panel yte-home-hubs" aria-labelledby="yte-home-hubs-heading">
        <h2 id="yte-home-hubs-heading">{doc.hubsHeading}</h2>
        <ul>
          {doc.hubsItems.map((item) => (
            <li key={item.html.slice(0, 48)} dangerouslySetInnerHTML={{ __html: item.html }} />
          ))}
        </ul>
      </section>
    </>
  );
}
