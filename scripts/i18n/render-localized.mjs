import { RTL_CODES } from "../../workers/iso6391.js";
import { localizeInternalLinksInHtml } from "./internal-links.mjs";

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildHreflangLinks({ englishUrl, alternates }) {
  const lines = [
    `<link rel="alternate" hreflang="en" href="${xmlEscape(englishUrl)}"/>`,
    `<link rel="alternate" hreflang="x-default" href="${xmlEscape(englishUrl)}"/>`,
  ];
  for (const { locale, url } of alternates) {
    if (locale === "en") continue;
    lines.push(`<link rel="alternate" hreflang="${xmlEscape(locale)}" href="${xmlEscape(url)}"/>`);
  }
  return lines.join("\n  ");
}

/**
 * Generic localized page renderer for article/utility artifacts.
 */
export function renderLocalizedHtml(item, artifact, { alternates = [], pathLinkIndex = null } = {}) {
  const locale = artifact.locale;
  const dir = RTL_CODES.has(locale) ? "rtl" : "ltr";
  const canonical = alternates.find((a) => a.locale === locale)?.url;
  if (!canonical) throw new Error("missing self alternate for render");
  const localize = (html) =>
    pathLinkIndex ? localizeInternalLinksInHtml(html, locale, pathLinkIndex) : html;
  const title = xmlEscape(artifact.title);
  const description = xmlEscape(artifact.description);
  const ogTitle = xmlEscape(artifact.ogTitle || artifact.title);
  const ogDescription = xmlEscape(artifact.ogDescription || artifact.description);
  const hero =
    artifact.images?.[0] || {
      src: "https://www.11tik.com/web-client/images/social/og-image-1200x630.png",
      alt: artifact.imageAlt || "",
    };
  const sectionsHtml = (artifact.sections || [])
    .map((section) => {
      const heading = section.heading ? `<h2>${xmlEscape(section.heading)}</h2>` : "";
      return `${heading}\n${localize(section.html || "")}`;
    })
    .join("\n");
  const faqHtml = (artifact.faq || [])
    .map(
      (faq) =>
        `<h3>${xmlEscape(faq.question)}</h3>\n<p>${localize(faq.answerHtml || xmlEscape(faq.answer || ""))}</p>`,
    )
    .join("\n");
  const schemaType = item.type === "utility" ? "WebPage" : "Article";
  const faqLd = (artifact.faq || []).map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: String(faq.answer || "").replace(/<[^>]+>/g, ""),
    },
  }));
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": schemaType,
        headline: artifact.h1,
        name: artifact.h1,
        description: artifact.description,
        inLanguage: locale,
        mainEntityOfPage: canonical,
        author: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/p/about.html" },
        publisher: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/" },
        image: { "@type": "ImageObject", url: hero.src, width: 1200, height: 630 },
      },
      ...(faqLd.length ? [{ "@type": "FAQPage", mainEntity: faqLd }] : []),
    ],
  };

  return `<!DOCTYPE html>
<html lang="${xmlEscape(locale)}" dir="${dir}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <meta name="description" content="${description}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${xmlEscape(canonical)}"/>
  ${buildHreflangLinks({ englishUrl: item.canonicalUrl, alternates })}
  <meta property="og:type" content="${item.type === "utility" ? "website" : "article"}"/>
  <meta property="og:locale" content="${xmlEscape(`${locale}_${locale.toUpperCase()}`)}"/>
  <meta property="og:site_name" content="11tik"/>
  <meta property="og:title" content="${ogTitle}"/>
  <meta property="og:description" content="${ogDescription}"/>
  <meta property="og:url" content="${xmlEscape(canonical)}"/>
  <meta property="og:image" content="${xmlEscape(hero.src)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${ogTitle}"/>
  <meta name="twitter:description" content="${ogDescription}"/>
  <meta name="twitter:image" content="${xmlEscape(hero.src)}"/>
  <style>
.yte-page{max-width:720px;margin:32px auto 64px;padding:0 20px;font-family:system-ui,Segoe UI,sans-serif;color:#17141c;line-height:1.65}
.yte-page h1{font-size:2rem;line-height:1.15;margin:0 0 12px}
.yte-page h2{font-size:1.2rem;margin:28px 0 8px}
.yte-page h3{font-size:1.05rem;margin:18px 0 6px}
.yte-page p,.yte-page li,.yte-page td,.yte-page th{color:#5c5666}
.yte-page a{color:#c2410c}
.yte-byline,.yte-updated,.yte-caption{font-size:14px;color:#5c5666;margin:0 0 8px}
.yte-hero{display:block;width:100%;max-width:1200px;height:auto;margin:12px 0 8px;border-radius:12px}
.yte-bio{margin-top:36px;padding-top:16px;border-top:1px solid #d9d3dc;font-size:14px;color:#5c5666}
.yte-page table{width:100%;border-collapse:collapse;margin:16px 0 20px;font-size:15px}
.yte-page th,.yte-page td{border:1px solid #d9d3dc;padding:10px 12px;text-align:left;vertical-align:top}
.yte-page th{background:#f6f1ea;color:#17141c;font-weight:700}
.yte-page code{font-size:0.92em;background:#f6f1ea;padding:0.1em 0.35em;border-radius:4px}
.yte-page pre{background:#17141c;color:#f6f1ea;padding:14px;border-radius:12px;overflow:auto;font-size:13px;line-height:1.45}
.yte-page ol,.yte-page ul{padding-left:1.25rem}
  </style>
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<article class="yte-page" itemscope itemtype="https://schema.org/${schemaType}">
  <h1 itemprop="headline name">${xmlEscape(artifact.h1)}</h1>
  <p itemprop="description">${description}</p>
  ${sectionsHtml}
  ${faqHtml ? `<h2>${xmlEscape(artifact.faqHeading || "FAQ")}</h2>\n${faqHtml}` : ""}
  ${localize(artifact.conclusionHtml || "")}
  ${artifact.bioHtml ? `<p class="yte-bio">${localize(artifact.bioHtml)}</p>` : ""}
</article>
</body>
</html>
`;
}
