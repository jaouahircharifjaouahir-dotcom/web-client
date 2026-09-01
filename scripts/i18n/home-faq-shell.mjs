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
