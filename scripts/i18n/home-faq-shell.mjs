import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHomeFaqArtifact } from "./translate-home-faq.mjs";
import { isTargetLocale } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function localizeAnswerHtml(html) {
  const parts = String(html || "").split(/(<a\s+[^>]+>[\s\S]*?<\/a>)/gi);
  return parts
    .map((part) => (part.match(/^<a\s/i) ? part : xmlEscape(part)))
    .join("");
}

function toDoc(artifact) {
  if (!artifact?.faq?.length) return null;
  return {
    heading: artifact.faqHeading || "FAQ",
    items: artifact.faq.map((row) => ({
      question: row.question,
      answerHtml: row.answerHtml || row.answer || "",
    })),
  };
}

export function loadHomeFaqDoc(locale) {
  const code = String(locale || "en").toLowerCase();
  const artifact = loadHomeFaqArtifact(code);
  const doc = toDoc(artifact);
  if (doc) return doc;
  if (code === "en") return null;
  if (isTargetLocale(code)) return toDoc(loadHomeFaqArtifact("en"));
  return null;
}

export function renderHomeFaqShellHtml(locale) {
  const doc = loadHomeFaqDoc(locale);
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

/** Plain-text FAQ answers for JSON-LD (must match visible FAQ after stripping tags). */
export function homeFaqPageLdNode(locale, pageUrl) {
  const doc = loadHomeFaqDoc(locale);
  if (!doc?.items?.length) return null;
  return {
    "@type": "FAQPage",
    "@id": `${String(pageUrl || "").replace(/\/$/, "") || "https://www.11tik.com"}/#faq`,
    mainEntity: doc.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: String(item.answerHtml || "")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      },
    })),
  };
}

/** EN-only featured hubs (How-to / Bulk / Study) — not a second product list. */
export function renderHomeHubLinksHtml(locale) {
  if (String(locale || "").toLowerCase() !== "en") return "";
  return `<section class="yte-home-hubs" aria-labelledby="yte-home-hubs-heading">
    <h2 id="yte-home-hubs-heading">Guides that support this tool</h2>
    <ul>
      <li><a href="https://www.11tik.com/how-to-download-youtube-thumbnail">Save a public YouTube thumbnail step by step</a> — Single-URL walkthrough, then return here to extract.</li>
      <li><a href="https://www.11tik.com/how-to-batch-download-youtube">Work through multiple thumbnail URLs</a> — Up to 50 public links with ZIP and CSV export in Bulk mode.</li>
      <li><a href="https://www.11tik.com/youtube-thumbnail-sizes-resolutions-study">Measured sizes across 300 videos</a> — Sample-based evidence on dimensions and maxres availability.</li>
    </ul>
  </section>`;
}

/** EN-only capability bullets for the same extractor product. */
export function renderHomeCapabilityBulletsHtml(locale) {
  if (String(locale || "").toLowerCase() !== "en") return "";
  return `<section class="yte-home-caps" aria-labelledby="yte-home-caps-heading">
    <h2 id="yte-home-caps-heading">What this extractor covers</h2>
    <ul>
      <li>Download or grab public YouTube thumbnail stills from a supported video URL (one product—not separate downloader or grabber tools).</li>
      <li>Bulk mode for up to <strong>50</strong> URLs per run, with ZIP of highest-quality stills and CSV export — see the <a href="https://www.11tik.com/how-to-batch-download-youtube">batch download guide</a>.</li>
      <li>Validates which public sizes actually load for watch links and Shorts, including honest maxres when YouTube publishes it.</li>
      <li>Optional <a href="https://addons.mozilla.org/en-US/firefox/addon/11tik-youtube-thumbnails/">11tik for Firefox</a> for the current YouTube tab; the website tool stays at <a href="https://www.11tik.com/">www.11tik.com</a>.</li>
    </ul>
  </section>`;
}
