import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { providerConfigReport, validateProviderConfig, LEGACY_PROVIDER_IDS } from "../../scripts/i18n/provider-config.mjs";
import { collectProtectedTokens, protectText, restoreProtected, validatePreservedTokens } from "../../scripts/i18n/translate-protect.mjs";
import { extractStructuredSource } from "../../scripts/i18n/extract-source.mjs";
import { planTranslationWork } from "../../scripts/i18n/translate-pipeline.mjs";
import { validateTranslationOutput } from "../../scripts/i18n/translate-quality.mjs";
import { validateTranslationArtifact } from "../../scripts/i18n/validate-artifact.mjs";
import { loadTranslationArtifact } from "../../scripts/i18n/translation-store.mjs";
import {
  extractTextNodesFromHtml,
  translatePlainStrings,
  countPayloadCharacters,
} from "../../scripts/i18n/dom-translate.mjs";
import { getTargetLocales } from "../../scripts/i18n/target-languages.mjs";

describe("i18n translation provider abstraction (GTX + TARGET_LANGUAGES)", () => {
  it("validates chrome_gtx as the only active provider", () => {
    const prev = { ...process.env };
    process.env.TRANSLATE_ENABLED = "1";
    process.env.TRANSLATION_PROVIDER = "chrome_gtx";
    const report = providerConfigReport();
    expect(report.provider).toBe("chrome_gtx");
    expect(report.credentialsPresent).toBe(true);
    expect(report.localEngine).toBe(true);
    process.env = prev;
  });

  it("rejects legacy providers on the active path", () => {
    for (const provider of LEGACY_PROVIDER_IDS) {
      const bad = validateProviderConfig({
        enabled: true,
        provider,
        rateLimitMs: 80,
        maxRetries: 3,
        batchSize: 1,
        timeoutMs: 120000,
        concurrency: 4,
        gtxConcurrency: 8,
      });
      expect(bad.ok).toBe(false);
      expect(bad.errors.some((e) => e.includes("unsupported provider"))).toBe(true);
    }
  });

  it("protects and restores URLs during translation payloads", () => {
    const text = 'Visit <a href="https://www.11tik.com/thumb/dQw4w9WgXcQ">11tik</a> and i.ytimg.com';
    const tokens = collectProtectedTokens(text);
    const { text: protectedText, map } = protectText(text, tokens);
    expect(protectedText).not.toContain("https://www.11tik.com");
    const restored = restoreProtected(protectedText, map);
    expect(restored).toContain("https://www.11tik.com/thumb/dQw4w9WgXcQ");
    expect(validatePreservedTokens(restored, tokens).ok).toBe(true);
  });

  it("extracts DOM text nodes without altering HTML attributes", () => {
    const html = '<p>Hello <a href="https://www.11tik.com/">11tik</a> world</p>';
    const { strings, root } = extractTextNodesFromHtml(html);
    expect(strings.length).toBeGreaterThan(0);
    expect(root.querySelector("a").getAttribute("href")).toBe("https://www.11tik.com/");
  });

  it("translates plain strings via callback while preserving tokens", async () => {
    const out = await translatePlainStrings(["Save at https://i.ytimg.com/vi/abc/maxresdefault.jpg"], async (batch) =>
      batch.map((s) => s.replace("Save", "Speichern")),
    );
    expect(out[0]).toContain("https://i.ytimg.com/vi/abc/maxresdefault.jpg");
    expect(out[0]).toContain("Speichern");
  });

  it("extracts structured fields from English Blogger HTML", () => {
    const html = readFileSync(
      join(process.cwd(), "docs/blogger-pages/blog/11tik-share-links-thumb-vs-watch.html"),
      "utf8",
    );
    const structured = extractStructuredSource(html, { contentType: "article" });
    expect(structured.h1).toContain("11tik Share Links");
    expect(structured.sections.length).toBeGreaterThan(5);
    expect(structured.faq.length).toBeGreaterThan(3);
    expect(structured.imageAlt).toContain("Diagram");
    expect(countPayloadCharacters(structured)).toBeGreaterThan(1000);
  });

  it("falls back to meta description when itemprop description is absent", () => {
    const html = readFileSync(
      join(process.cwd(), "docs/blogger-pages/blog/youtube-shorts-thumbnail-download.html"),
      "utf8",
    );
    const structured = extractStructuredSource(html, { contentType: "article" });
    expect(structured.description).toContain("YouTube Shorts thumbnail");
    expect(structured.ogDescription).toContain("YouTube Shorts thumbnail");
  });

  it("falls back to intro paragraph for Blogger fragment articles", () => {
    const html = readFileSync(
      join(process.cwd(), "docs/blogger-pages/blog/youtube-studio-thumbnail-2026.html"),
      "utf8",
    );
    const structured = extractStructuredSource(html, { contentType: "article" });
    expect(structured.description).toContain("eligible YouTube channels");
    expect(structured.ogDescription).toContain("eligible YouTube channels");
  });

  it("orders locale-first rollout by language then content", () => {
    const targets = getTargetLocales();
    const plan = planTranslationWork({ locales: targets, rolloutMode: "locale-first" });
    expect(plan.rolloutMode).toBe("locale-first");
    if (plan.queue.length >= 2) {
      const firstLocale = plan.queue[0].locale;
      const sameLocaleBlock = plan.queue.filter((q) => q.locale === firstLocale);
      expect(sameLocaleBlock.length).toBeGreaterThan(1);
      for (const job of sameLocaleBlock) {
        expect(job.locale).toBe(firstLocale);
      }
    }
  });

  it("does not require imageAlt when the page has no images", () => {
    const artifact = {
      contentId: "embed",
      locale: "fr",
      sourceHash: "abc",
      status: "draft",
      title: "Embed | 11tik",
      description: "Desc",
      h1: "Embed tool",
      ogTitle: "Embed tool",
      ogDescription: "Desc",
      imageAlt: "",
      images: [],
      sections: [{ heading: "Snippet", html: "<p>Text</p>" }],
      faq: [],
      conclusionHtml: "",
      bioHtml: "",
    };
    const v = validateTranslationArtifact(artifact, {
      contentId: "embed",
      locale: "fr",
      contentType: "utility",
    });
    expect(v.ok).toBe(true);
  });

  it("skips ready+current artifacts in TARGET_LANGUAGES plan", () => {
    const targets = getTargetLocales();
    const plan = planTranslationWork({ locales: targets });
    expect(plan.localeCount).toBe(targets.length);
    expect(plan.summary.ready).toBeGreaterThanOrEqual(1);
    const fr = loadTranslationArtifact("11tik-share-links-thumb-vs-youtube", "fr");
    expect(fr?.status).toBe("ready");
  });

  it("accepts pre blocks when JSDOM normalizes whitespace but URLs remain", () => {
    const source = {
      title: "Test | 11tik",
      description: "Desc",
      h1: "Test",
      ogTitle: "Test",
      ogDescription: "Desc",
      imageAlt: "Alt",
      sections: [{
        heading: "Example",
        html: '<p>See below.</p><pre>&lt;img\r\n  src="https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg"\n/&gt;</pre>',
      }],
      faq: [{ question: "Q", answer: "A", answerHtml: "A" }],
      conclusionHtml: "",
      bioHtml: "",
    };
    const translated = {
      ...source,
      contentId: "x",
      locale: "fr",
      sourceHash: "abc",
      status: "draft",
      sections: [{
        heading: "Exemple",
        html: '<p>Voir ci-dessous.</p><pre>&lt;img\n  src="https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg"\n/&gt;</pre>',
      }],
    };
    const result = validateTranslationOutput(translated, source, {
      contentId: "x",
      locale: "fr",
      sourceHash: "abc",
      contentType: "article",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects translations that drop protected URLs", () => {
    const source = {
      title: "Test | 11tik",
      description: "Desc",
      h1: "Test",
      ogTitle: "Test",
      ogDescription: "Desc",
      imageAlt: "Alt",
      sections: [{ heading: "A", html: '<a href="https://www.11tik.com/">11tik</a>' }],
      faq: [{ question: "Q", answer: "A", answerHtml: "A" }],
      conclusionHtml: "",
      bioHtml: "",
    };
    const bad = {
      ...source,
      contentId: "x",
      locale: "fr",
      sourceHash: "abc",
      status: "draft",
      sections: [{ heading: "A", html: "<p>no urls</p>" }],
    };
    const result = validateTranslationOutput(bad, source, {
      contentId: "x",
      locale: "fr",
      sourceHash: "abc",
      contentType: "article",
    });
    expect(result.ok).toBe(false);
  });
});
