import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHomeFaqArtifact } from "./translate-home-faq.mjs";
import { loadHomeCapsHubsArtifact } from "./translate-home-caps-hubs.mjs";
import { isTargetLocale } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Preserve safe HTML tags (a, strong) while escaping text nodes. */
function localizeAnswerHtml(html) {
  const parts = String(html || "").split(/(<a\s+[^>]+>[\s\S]*?<\/a>|<strong>[\s\S]*?<\/strong>)/gi);
  return parts
    .map((part) => (part.match(/^<(a|strong)\b/i) ? part : xmlEscape(part)))
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

function loadCapsHubsDoc(locale) {
  const code = String(locale || "en").toLowerCase();
  let artifact = loadHomeCapsHubsArtifact(code);
  if (!artifact?.capsItems?.length && code !== "en" && isTargetLocale(code)) {
    artifact = loadHomeCapsHubsArtifact("en");
  }
  if (!artifact?.capsItems?.length || !artifact?.hubsItems?.length) return null;
  return artifact;
}

/** Locale hub links (How-to / Bulk / Study) — same semantic set as EN. */
export function renderHomeHubLinksHtml(locale) {
  const doc = loadCapsHubsDoc(locale);
  if (!doc) return "";
  const items = doc.hubsItems.map((row) => `<li>${localizeAnswerHtml(row.html)}</li>`).join("\n      ");
  return `<section class="yte-home-hubs" aria-labelledby="yte-home-hubs-heading">
    <h2 id="yte-home-hubs-heading">${xmlEscape(doc.hubsHeading)}</h2>
    <ul>
      ${items}
    </ul>
  </section>`;
}

/** Locale capability bullets for the same extractor product. */
export function renderHomeCapabilityBulletsHtml(locale) {
  const doc = loadCapsHubsDoc(locale);
  if (!doc) return "";
  const items = doc.capsItems.map((row) => `<li>${localizeAnswerHtml(row.html)}</li>`).join("\n      ");
  return `<section class="yte-home-caps" aria-labelledby="yte-home-caps-heading">
    <h2 id="yte-home-caps-heading">${xmlEscape(doc.capsHeading)}</h2>
    <ul>
      ${items}
    </ul>
  </section>`;
}
