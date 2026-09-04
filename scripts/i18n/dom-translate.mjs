/**
 * DOM-aware HTML translation — translate visible text nodes only.
 * Never modifies href, src, code, pre, script, style, or JSON-LD.
 */
import { JSDOM } from "jsdom";
import { collectProtectedTokens, protectText, restoreProtected } from "./translate-protect.mjs";

const SKIP_TAGS = new Set(["script", "style", "code", "pre", "noscript", "svg", "template"]);

function walkTextNodes(node, visit, insideSkip = false) {
  if (!node) return;
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      if (!insideSkip && child.textContent?.trim()) visit(child);
    } else if (child.nodeType === 1) {
      const tag = child.tagName?.toLowerCase?.() || "";
      const skip = insideSkip || SKIP_TAGS.has(tag);
      walkTextNodes(child, visit, skip);
    }
  }
}

export function extractTextNodesFromHtml(html) {
  if (!String(html || "").trim()) {
    return { wrapper: null, root: null, nodes: [], strings: [] };
  }
  const dom = new JSDOM(`<div data-i18n-root="1">${html}</div>`, { contentType: "text/html" });
  const root = dom.window.document.querySelector("[data-i18n-root]");
  const nodes = [];
  walkTextNodes(root, (node) => nodes.push(node));
  return {
    wrapper: dom,
    root,
    nodes,
    strings: nodes.map((n) => n.textContent),
  };
}

export function applyTranslatedStringsToHtml(html, translatedStrings) {
  const { root, nodes } = extractTextNodesFromHtml(html);
  if (!root || !nodes.length) return html;
  nodes.forEach((node, i) => {
    if (translatedStrings[i] != null) node.textContent = translatedStrings[i];
  });
  return root.innerHTML;
}

/**
 * Protect technical tokens, translate plain strings via callback, restore tokens.
 * @param {string[]} strings
 * @param {(protectedStrings: string[]) => Promise<string[]>} translateFn
 */
export async function translatePlainStrings(strings, translateFn) {
  if (!strings.length) return [];
  const blob = strings.join("\n");
  const tokens = collectProtectedTokens(blob);
  const protectedEntries = strings.map((s) => protectText(s, tokens));
  const toSend = protectedEntries.map((p) => p.text);
  const translated = await translateFn(toSend);
  if (!Array.isArray(translated) || translated.length !== strings.length) {
    throw new Error(`translateFn returned ${translated?.length ?? 0} strings; expected ${strings.length}`);
  }
  return translated.map((t, i) => restoreProtected(t, protectedEntries[i].map));
}

/**
 * DOM-aware HTML fragment translation.
 */
export async function translateHtmlFragment(html, translateFn) {
  if (!String(html || "").trim()) return html;
  const { strings } = extractTextNodesFromHtml(html);
  if (!strings.length) return html;
  const translated = await translatePlainStrings(strings, translateFn);
  return applyTranslatedStringsToHtml(html, translated);
}

/**
 * Collect all translatable plain-text strings from a structured translation payload.
 */
export function collectPayloadStrings(payload) {
  const entries = [];
  const add = (path, value) => {
    if (typeof value === "string" && value.trim()) entries.push({ path, value });
  };

  add("title", payload.title);
  add("description", payload.description);
  add("h1", payload.h1);
  add("ogTitle", payload.ogTitle);
  add("ogDescription", payload.ogDescription);
  add("imageAlt", payload.imageAlt);
  add("faqHeading", payload.faqHeading);
  add("conclusionHtml", payload.conclusionHtml);
  add("bioHtml", payload.bioHtml);
  add("heroTitle", payload.heroTitle);
  add("heroIntro", payload.heroIntro);
  add("capsHeading", payload.capsHeading);
  add("hubsHeading", payload.hubsHeading);
  add("entityHeading", payload.entityHeading);
  add("entityIntro", payload.entityIntro);
  add("entityDoesHeading", payload.entityDoesHeading);
  add("entityDoes1", payload.entityDoes1);
  add("entityDoes2", payload.entityDoes2);
  add("entityDoes3", payload.entityDoes3);
  add("entityDoesNotHeading", payload.entityDoesNotHeading);
  add("entityDoesNot1", payload.entityDoesNot1);
  add("entityDoesNot2", payload.entityDoesNot2);
  add("entityDoesNot3", payload.entityDoesNot3);
  add("entityDoesNot4", payload.entityDoesNot4);

  for (let i = 0; i < (payload.capsItems?.length || 0); i++) {
    add(`capsItems.${i}.html`, payload.capsItems[i]?.html);
  }
  for (let i = 0; i < (payload.hubsItems?.length || 0); i++) {
    add(`hubsItems.${i}.html`, payload.hubsItems[i]?.html);
  }

  for (let i = 0; i < (payload.sections?.length || 0); i++) {
    const s = payload.sections[i];
    add(`sections.${i}.heading`, s.heading);
    add(`sections.${i}.html`, s.html);
  }
  for (let i = 0; i < (payload.faq?.length || 0); i++) {
    const f = payload.faq[i];
    add(`faq.${i}.question`, f.question);
    add(`faq.${i}.answer`, f.answer);
    add(`faq.${i}.answerHtml`, f.answerHtml);
  }
  for (let i = 0; i < (payload.images?.length || 0); i++) {
    add(`images.${i}.alt`, payload.images[i]?.alt);
    add(`images.${i}.captionHtml`, payload.images[i]?.captionHtml);
  }
  return entries;
}

export function setPayloadString(payload, path, value) {
  const parts = path.split(".");
  let cur = payload;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const idx = Number(key);
    cur = Number.isInteger(idx) && String(idx) === key ? cur[idx] : cur[key];
  }
  const last = parts[parts.length - 1];
  const idx = Number(last);
  if (Number.isInteger(idx) && String(idx) === last) cur[idx] = value;
  else cur[last] = value;
}

export function countPayloadCharacters(payload) {
  return collectPayloadStrings(payload).reduce((sum, e) => sum + e.value.length, 0);
}
