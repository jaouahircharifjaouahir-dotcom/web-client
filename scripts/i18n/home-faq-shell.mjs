/**
 * Build-time homepage FAQ HTML for English SPA shells only.
 */
import homeFaqEn from "../../src/i18n/home-faq.en.json" with { type: "json" };

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Preserve intentional <a href="..."> links; escape everything else. */
function localizeAnswerHtml(html) {
  const parts = String(html || "").split(/(<a\s+[^>]+>[\s\S]*?<\/a>)/gi);
  return parts
    .map((part) => (part.match(/^<a\s/i) ? part : xmlEscape(part)))
    .join("");
}

export function renderHomeFaqShellHtml(locale) {
  if (String(locale || "en").toLowerCase() !== "en") return "";
  const doc = homeFaqEn;
  if (!doc?.items?.length) return "";
  const blocks = doc.items
    .map(
      (item) =>
        `<h3>${xmlEscape(item.question)}</h3>\n<p>${localizeAnswerHtml(item.answerHtml)}</p>`,
    )
    .join("\n");
  return `<section class="yte-home-faq" aria-labelledby="home-faq-heading">
    <h2 id="home-faq-heading">${xmlEscape(doc.heading)}</h2>
${blocks}
  </section>`;
}
