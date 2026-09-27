/**
 * Crawlable <details class="yte-panel"> shell for homepage legal block.
 */
import { loadHomeDetailsArtifact } from "./translate-home-details.mjs";
import { isTargetLocale } from "./target-languages.mjs";

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Preserve safe HTML tags (a, strong) while escaping text nodes. */
function localizeBodyHtml(html) {
  const parts = String(html || "").split(/(<a\s+[^>]+>[\s\S]*?<\/a>|<strong>[\s\S]*?<\/strong>)/gi);
  return parts
    .map((part) => (part.match(/^<(a|strong)\b/i) ? part : xmlEscape(part)))
    .join("");
}

export function loadHomeDetailsDoc(locale) {
  const code = String(locale || "en").toLowerCase();
  let artifact = loadHomeDetailsArtifact(code);
  if (!artifact?.items?.length && code !== "en" && isTargetLocale(code)) {
    artifact = loadHomeDetailsArtifact("en");
  }
  if (!artifact?.items?.length) return null;
  return artifact;
}

/** Homepage Copyright & Usage details panel (same semantic set as React). */
export function renderHomeDetailsShellHtml(locale) {
  const doc = loadHomeDetailsDoc(locale);
  if (!doc?.items?.length) return "";
  const body = doc.items
    .map(
      (item) =>
        `<h3>${xmlEscape(item.heading)}</h3>\n<p>${localizeBodyHtml(item.bodyHtml)}</p>`,
    )
    .join("\n");
  const id = xmlEscape(doc.blockId || "yte-home-details-legal");
  return `<details class="yte-panel yte-home-details" id="${id}">
<summary>${xmlEscape(doc.summary)}</summary>
${body}
</details>`;
}
