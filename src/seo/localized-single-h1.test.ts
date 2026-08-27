import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  renderLocalizedHtml,
  stripNestedDocumentH1,
} from "../../scripts/i18n/render-localized.mjs";
import { extractStructuredSource } from "../../scripts/i18n/extract-source.mjs";

describe("localized pages single H1", () => {
  it("stripNestedDocumentH1 removes page-duplicate H1 and demotes others", () => {
    expect(stripNestedDocumentH1("<h1>Contact</h1><p>Hi</p>", "Contact")).toBe("<p>Hi</p>");
    expect(stripNestedDocumentH1("<h1>Other</h1><p>Hi</p>", "Contact")).toBe(
      "<h2>Other</h2><p>Hi</p>",
    );
  });

  it("utility contact/keyword-tools render with exactly one H1", () => {
    for (const contentId of ["contact", "keyword-tools"]) {
      const artifact = JSON.parse(
        readFileSync(`content/translations/${contentId}/fr.json`, "utf8"),
      );
      const item = {
        contentId,
        type: "utility",
        canonicalPath: `/p/${contentId}.html`,
        canonicalUrl: `https://www.11tik.com/p/${contentId}.html`,
      };
      const html = renderLocalizedHtml(item, artifact, {
        alternates: [
          { locale: "en", url: item.canonicalUrl },
          { locale: "fr", url: `https://fr.11tik.com/l/fr/p/${contentId}.html` },
        ],
      });
      const h1s = [...html.matchAll(/<h1\b/gi)];
      expect(h1s.length, contentId).toBe(1);
      expect(html).toMatch(/<h1 itemprop="headline name">/);
      expect(html).not.toMatch(/<h2>[^<]*<\/h2>\s*<h1/i);
    }
  });

  it("English utility extract no longer keeps document H1 inside sections", () => {
    const contact = readFileSync("docs/blogger-pages/contact.html", "utf8");
    const structured = extractStructuredSource(contact, { contentType: "utility" });
    expect(structured.h1).toMatch(/Contact/i);
    for (const section of structured.sections) {
      expect(section.html).not.toMatch(/<h1\b/i);
    }
  });
});
