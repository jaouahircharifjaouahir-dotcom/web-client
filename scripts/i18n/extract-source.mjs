/**
 * Extract structured English source from Blogger HTML for translation.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashSource, normalizeSource } from "./translation-store.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html, pattern) {
  const m = pattern.exec(html);
  return m ? m[1].trim() : "";
}

function decodeBasicEntities(text) {
  return String(text || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

/** Read `<meta name=…>` or `<meta property=…>` content from document head/body. */
function metaTagContent(html, { name, property } = {}) {
  const attr = name ? `name=['"]${name}['"]` : `property=['"]${property}['"]`;
  const patterns = [
    new RegExp(`<meta[^>]+${attr}[^>]+content=['"]([^'"]*)['"]`, "i"),
    new RegExp(`<meta[^>]+content=['"]([^'"]*)['"][^>]+${attr}`, "i"),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]?.trim()) return decodeBasicEntities(m[1].trim());
  }
  return "";
}

function articleInner(html) {
  const m = /<article[^>]*>([\s\S]*)<\/article>/i.exec(html);
  return m ? m[1] : html;
}

function splitSections(inner) {
  const parts = inner.split(/<h2\b[^>]*>/i);
  const sections = [];
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const headingEnd = chunk.indexOf("</h2>");
    if (headingEnd === -1) continue;
    const heading = stripTags(chunk.slice(0, headingEnd));
    let htmlBlock = chunk.slice(headingEnd + 5);
    const nextH2 = htmlBlock.search(/<h2\b/i);
    if (nextH2 !== -1) htmlBlock = htmlBlock.slice(0, nextH2);
    sections.push({ heading, html: htmlBlock.trim() });
  }
  return sections;
}

function extractFaq(inner, jsonLd) {
  const faqSection = sectionsNamed(inner, ["FAQ"]).sections[0];
  const fromHtml = [];
  if (faqSection) {
    const chunks = faqSection.html.split(/<h3\b[^>]*>/i);
    for (let i = 1; i < chunks.length; i++) {
      const c = chunks[i];
      const qEnd = c.indexOf("</h3>");
      if (qEnd === -1) continue;
      const question = stripTags(c.slice(0, qEnd));
      const answerHtml = c.slice(qEnd + 5).trim();
      const answer = stripTags(answerHtml);
      if (question) fromHtml.push({ question, answer, answerHtml });
    }
  }
  if (fromHtml.length) return fromHtml;
  if (jsonLd?.faq?.length) return jsonLd.faq;
  return [];
}

function sectionsNamed(inner, names) {
  const all = splitSections(inner);
  const set = new Set(names.map((n) => n.toLowerCase()));
  const matched = [];
  const rest = [];
  for (const s of all) {
    if (set.has(s.heading.toLowerCase())) matched.push(s);
    else rest.push(s);
  }
  return { sections: matched, rest };
}

function parseJsonLd(html) {
  const m = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return {};
  try {
    const doc = JSON.parse(m[1]);
    const graph = doc["@graph"] || [doc];
    const article = graph.find((n) => n["@type"] === "Article" || n["@type"]?.includes?.("Article"));
    const faqPage = graph.find((n) => n["@type"] === "FAQPage");
    const howTo = graph.find((n) => n["@type"] === "HowTo");
    const faq =
      faqPage?.mainEntity?.map((q) => ({
        question: q.name,
        answer: q.acceptedAnswer?.text || "",
        answerHtml: q.acceptedAnswer?.text || "",
      })) || [];
    return {
      title: article?.headline || "",
      description: article?.description || "",
      datePublished: article?.datePublished || "",
      dateModified: article?.dateModified || "",
      image: article?.image || null,
      howTo: howTo || null,
      faq,
    };
  } catch {
    return {};
  }
}

function extractImages(inner) {
  const images = [];
  const re = /<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(inner))) {
    const tag = m[0];
    const src = /src=["']([^"']+)["']/i.exec(tag)?.[1] || "";
    const alt = /alt=["']([^"']*)["']/i.exec(tag)?.[1] || "";
    if (!src) continue;
    images.push({ src, alt });
  }
  return images;
}

function sanitizeContentHtml(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\s*(iframe|object|embed|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .trim();
}

/** Drop document H1 from body fragments — renderer emits a single page-level H1. */
function stripDocumentH1(html) {
  return String(html || "")
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, "")
    .trim();
}

function trimConclusionHtml(html) {
  let out = String(html || "");
  // Stop before author bio or JSON-LD — those are separate fields.
  out = out.split(/<p\b[^>]*class=["'][^"']*yte-bio/i)[0];
  out = out.split(/<script\b/i)[0];
  return sanitizeContentHtml(out);
}

/** First body paragraph when meta / JSON-LD / itemprop description is absent (Blogger fragments). */
function extractIntroParagraph(inner) {
  const skipClass = /yte-byline|yte-updated|yte-caption|yte-bio/i;
  const re = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(inner))) {
    const attrs = m[1] || "";
    if (skipClass.test(attrs)) continue;
    if (/itemprop=["']description["']/i.test(attrs)) continue;
    const text = stripTags(m[2]);
    if (text.length >= 20) return text;
  }
  return "";
}

export function extractStructuredSource(html, { contentType = "article" } = {}) {
  const inner = articleInner(html);
  const jsonLd = parseJsonLd(html);
  const h1 = stripTags(firstMatch(inner, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i));
  const description = stripTags(
    firstMatch(inner, /<p\b[^>]*itemprop=["']description["'][^>]*>([\s\S]*?)<\/p>/i),
  );
  const metaDescription = metaTagContent(html, { name: "description" });
  const metaOgDescription = metaTagContent(html, { property: "og:description" });
  const introDescription = extractIntroParagraph(inner);
  const title = jsonLd.title || h1;
  const desc = jsonLd.description || description || metaDescription || metaOgDescription || introDescription;
  const ogDesc =
    jsonLd.description || metaOgDescription || metaDescription || description || introDescription || desc;

  const { sections: conclusionParts, rest: afterConclusion } = sectionsNamed(inner, ["Conclusion"]);
  const { sections: faqParts, rest: bodySections } = sectionsNamed(
    afterConclusion.length ? afterConclusion.join("") : inner,
    ["FAQ"],
  );
  void faqParts;

  const sections = splitSections(inner)
    .filter((s) => {
      const h = s.heading.toLowerCase();
      return h !== "faq" && h !== "conclusion";
    })
    .map((s) => ({
      heading: s.heading,
      html: sanitizeContentHtml(stripDocumentH1(s.html)),
    }));

  const faq = extractFaq(inner, jsonLd).map((item) => ({
    ...item,
    answerHtml: sanitizeContentHtml(item.answerHtml),
  }));
  const images = extractImages(inner);
  const hero = images.find((img) => img.src.includes("/images/")) || images[0];
  const bioMatch = /<p\b[^>]*class=["'][^"']*yte-bio[^"']*["'][^>]*>([\s\S]*?)<\/p>/i.exec(inner);
  const bioHtml = bioMatch ? sanitizeContentHtml(bioMatch[0]) : "";
  const conclusionHtml = conclusionParts.length
    ? trimConclusionHtml(`<h2>${conclusionParts[0].heading}</h2>\n${conclusionParts[0].html}`)
    : "";

  const datePublished =
    jsonLd.datePublished ||
    firstMatch(inner, /<time\b[^>]*itemprop=["']datePublished["'][^>]*datetime=["']([^"']+)["']/i) ||
    firstMatch(inner, /<time\b[^>]*datetime=["']([^"']+)["'][^>]*itemprop=["']datePublished["']/i);
  const dateModified =
    jsonLd.dateModified ||
    firstMatch(inner, /<time\b[^>]*itemprop=["']dateModified["'][^>]*datetime=["']([^"']+)["']/i) ||
    firstMatch(inner, /<time\b[^>]*datetime=["']([^"']+)["'][^>]*itemprop=["']dateModified["']/i) ||
    datePublished;

  return {
    title: title ? `${title} | 11tik` : "",
    description: desc,
    h1: h1 || title,
    ogTitle: h1 || title,
    ogDescription: ogDesc,
    datePublished: datePublished || "",
    dateModified: dateModified || "",
    howTo: jsonLd.howTo || null,
    imageAlt: hero?.alt || "",
    faqHeading: "FAQ",
    images: images.map((img) => ({
      src: img.src,
      alt: img.alt,
      captionHtml: "",
    })),
    sections: sections.length
      ? sections
      : bodySections.length
        ? bodySections.map((s) => ({
            heading: s.heading,
            html: sanitizeContentHtml(stripDocumentH1(s.html)),
          }))
        : [
            {
              heading: "",
              html: sanitizeContentHtml(stripDocumentH1(inner)),
            },
          ],
    faq: contentType === "article" ? faq : faq.length ? faq : [],
    conclusionHtml,
    bioHtml,
    contentType,
  };
}

export function loadStructuredSource(sourceRel, contentType = "article") {
  const raw = readFileSync(sourceRel, "utf8");
  return {
    sourceHash: hashSource(raw),
    normalized: normalizeSource(raw),
    structured: extractStructuredSource(raw, { contentType }),
  };
}

export function loadStructuredSourceFromItem(item) {
  if (!item?.sourceRel) return null;
  const abs = join(ROOT, item.sourceRel);
  if (!existsSync(abs)) return null;
  return loadStructuredSource(abs, item.type);
}
