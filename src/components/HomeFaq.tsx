import { homeFaqFor } from "../i18n/homeFaq";
import { readLocale } from "../i18n/ui";

export function HomeFaq() {
  const locale = readLocale();
  const doc = homeFaqFor(locale);
  if (!doc?.items.length) return null;

  return (
    <section className="yte-panel yte-home-faq" aria-labelledby="home-faq-heading">
      <h2 id="home-faq-heading">{doc.heading}</h2>
      {doc.items.map((item) => (
        <div className="yte-home-faq-item" key={item.question}>
          <h3>{item.question}</h3>
          <p dangerouslySetInnerHTML={{ __html: item.answerHtml }} />
        </div>
      ))}
    </section>
  );
}
