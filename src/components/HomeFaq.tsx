import { useEffect, useState } from "react";
import { homeFaqFor, setHomeFaqCache, type HomeFaqDoc, type HomeFaqItem } from "../i18n/homeFaq";
import { readLocale } from "../i18n/ui";

const FAQ_PATH = "/web-client/i18n/home-faq";

export function HomeFaq() {
  const locale = readLocale();
  const [doc, setDoc] = useState<HomeFaqDoc | null>(() => homeFaqFor(locale));

  useEffect(() => {
    const code = String(locale || "en").toLowerCase();
    const cached = homeFaqFor(code);
    if (cached?.items.length) {
      setDoc(cached);
      return;
    }
    let cancelled = false;
    fetch(`${FAQ_PATH}/${code}.json`, { credentials: "same-origin", cache: "force-cache" })
      .then(async (res) => (res.ok ? ((await res.json()) as HomeFaqDoc) : homeFaqFor("en")))
      .then((loaded) => {
        if (cancelled || !loaded?.items?.length) return;
        setHomeFaqCache(code, loaded);
        setDoc(loaded);
      })
      .catch(() => {
        if (!cancelled) setDoc(homeFaqFor("en"));
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (!doc?.items.length) return null;

  return (
    <section className="yte-panel yte-home-faq" aria-labelledby="home-faq-heading">
      <h2 id="home-faq-heading">{doc.heading}</h2>
      {doc.items.map((item: HomeFaqItem) => (
        <div className="yte-home-faq-item" key={item.question}>
          <h3>{item.question}</h3>
          <p dangerouslySetInnerHTML={{ __html: item.answerHtml }} />
        </div>
      ))}
    </section>
  );
}
