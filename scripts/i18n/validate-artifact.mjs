import { isSupportedLocale } from "./translation-store.mjs";

const FORBIDDEN_TAG = /<\s*(script|iframe|object|embed|link|meta|base)\b/i;
const EVENT_HANDLER = /\son[a-z]+\s*=/i;

export function validateTranslationArtifact(
  artifact,
  { contentId, locale, currentSourceHash, contentType = "article" } = {},
) {
  const errors = [];
  if (!artifact || typeof artifact !== "object") return { ok: false, errors: ["missing-artifact"] };

  const id = artifact.contentId || artifact.articleId;
  if (!id) errors.push("missing-contentId");
  if (contentId && id !== contentId) errors.push("contentId-mismatch");
  if (!artifact.locale) errors.push("missing-locale");
  if (locale && artifact.locale !== locale) errors.push("locale-mismatch");
  if (artifact.locale && !isSupportedLocale(artifact.locale)) errors.push("unsupported-locale");
  if (!["draft", "ready", "stale", "failed"].includes(artifact.status)) errors.push("invalid-status");
  if (!artifact.sourceHash) errors.push("missing-sourceHash");
  if (currentSourceHash && artifact.sourceHash !== currentSourceHash) errors.push("stale-sourceHash");

  for (const field of ["title", "description", "h1"]) {
    if (!String(artifact[field] || "").trim()) errors.push(`empty-${field}`);
  }

  if (!Array.isArray(artifact.sections) || artifact.sections.length === 0) errors.push("empty-sections");
  else {
    const headings = new Set();
    for (const [i, section] of artifact.sections.entries()) {
      if (!section || (!section.heading && !section.html)) errors.push(`empty-section-${i}`);
      if (section?.heading) {
        if (headings.has(section.heading)) errors.push(`duplicate-section-${i}`);
        headings.add(section.heading);
      }
      const html = String(section?.html || "");
      if (FORBIDDEN_TAG.test(html) || EVENT_HANDLER.test(html)) errors.push(`unsafe-html-section-${i}`);
    }
  }

  // Articles require FAQ; utility/homepage schemas may omit it.
  const requireFaq = contentType === "article";
  if (requireFaq && (!Array.isArray(artifact.faq) || artifact.faq.length === 0)) {
    errors.push("empty-faq");
  } else if (Array.isArray(artifact.faq)) {
    for (const [i, item] of artifact.faq.entries()) {
      if (!item?.question) errors.push(`faq-missing-q-${i}`);
      if (!item?.answer && !item?.answerHtml) errors.push(`faq-missing-a-${i}`);
      const html = String(item?.answerHtml || "");
      if (FORBIDDEN_TAG.test(html) || EVENT_HANDLER.test(html)) errors.push(`unsafe-html-faq-${i}`);
    }
  }

  if (Array.isArray(artifact.images) && artifact.images.some((img) => String(img?.src || "").trim())) {
    if (!String(artifact.imageAlt || artifact.images?.[0]?.alt || "").trim()) errors.push("missing-imageAlt");
  }
  if (!artifact.ogTitle) errors.push("missing-ogTitle");
  if (!artifact.ogDescription) errors.push("missing-ogDescription");

  for (const field of ["conclusionHtml", "bioHtml"]) {
    const html = String(artifact[field] || "");
    if (html && (FORBIDDEN_TAG.test(html) || EVENT_HANDLER.test(html))) errors.push(`unsafe-html-${field}`);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Publishable only when status=ready, hash matches, and structural validation passes.
 */
export function resolvePublishState(artifact, contentId, locale, currentSourceHash, contentType = "article") {
  if (!artifact) return { publishable: false, reason: "missing", artifact: null };
  if ((artifact.contentId || artifact.articleId) !== contentId) {
    return { publishable: false, reason: "contentId-mismatch", artifact };
  }
  if (artifact.locale !== locale) return { publishable: false, reason: "locale-mismatch", artifact };
  if (artifact.status !== "ready") return { publishable: false, reason: "not-ready", artifact };
  if (!currentSourceHash || artifact.sourceHash !== currentSourceHash) {
    return { publishable: false, reason: "stale", artifact };
  }
  const validation = validateTranslationArtifact(artifact, {
    contentId,
    locale,
    currentSourceHash,
    contentType,
  });
  if (!validation.ok) return { publishable: false, reason: "invalid", artifact, errors: validation.errors };
  return { publishable: true, reason: "ready", artifact };
}
