import { describe, expect, it } from "vitest";
import { hashSource, normalizeSource } from "../../scripts/i18n/translation-store.mjs";

describe("sourceHash normalization", () => {
  it("ignores Cloudflare email_off transport markers", () => {
    const semantic = `<p>Email <a href="mailto:a@b.com">a@b.com</a> or contact.</p>`;
    const withMarkers = `<p>Email <!--email_off--><a href="mailto:a@b.com">a@b.com</a><!--/email_off--> or contact.</p>`;
    expect(normalizeSource(withMarkers)).toBe(normalizeSource(semantic));
    expect(hashSource(withMarkers)).toBe(hashSource(semantic));
  });

  it("is idempotent for markers already absent", () => {
    const html = `<p><a href="mailto:a@b.com">a@b.com</a></p>\n`;
    expect(hashSource(html)).toBe(hashSource(html));
  });
});
