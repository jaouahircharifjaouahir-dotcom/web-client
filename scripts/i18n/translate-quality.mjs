import { validateTranslationArtifact } from "./validate-artifact.mjs";
import { collectProtectedTokens, validatePreservedTokens } from "./translate-protect.mjs";

export function validateTranslationOutput(artifact, sourceStructured, { contentId, locale, sourceHash, contentType }) {
  const structural = validateTranslationArtifact(artifact, {
    contentId,
    locale,
    currentSourceHash: sourceHash,
    contentType,
  });
  if (!structural.ok) return structural;

  const sourceBlob = JSON.stringify(sourceStructured);
  const tokens = collectProtectedTokens(sourceBlob);
  const translatedBlob = JSON.stringify(artifact);
  const preserved = validatePreservedTokens(translatedBlob, tokens);
  if (!preserved.ok) {
    return { ok: false, errors: [...structural.errors, ...preserved.errors.map((e) => `preserve:${e}`)] };
  }

  if (sourceStructured.sections?.length !== artifact.sections?.length) {
    return { ok: false, errors: ["section-count-mismatch"] };
  }
  if (contentType === "article" && sourceStructured.faq?.length !== artifact.faq?.length) {
    return { ok: false, errors: ["faq-count-mismatch"] };
  }

  return { ok: true, errors: [] };
}
