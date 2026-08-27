import { describe, expect, it } from "vitest";
import {
  decodeCfEmail,
  protectEmailsInHtml,
  rewriteEmailProtectionLinks,
  wrapMailtoWithEmailOff,
} from "../../workers/email-obfuscation.js";
import { wrapMailtoWithEmailOff as edgeWrap } from "../../workers/11tik-edge.js";
import { renderEnglishStaticHtml } from "../../scripts/i18n/render-english-static.mjs";

describe("mailto email obfuscation guard", () => {
  it("wraps mailto anchors with Cloudflare email_off markers and keeps mailto href", () => {
    const input =
      'Email <a href="mailto:jaouahircharifjaouahir@gmail.com">jaouahircharifjaouahir@gmail.com</a> or use the <a href="https://www.11tik.com/p/contact.html">contact form</a>.';
    const out = wrapMailtoWithEmailOff(input);
    expect(out).toContain('href="mailto:jaouahircharifjaouahir@gmail.com"');
    expect(out).toContain("<!--email_off-->");
    expect(out).toContain("<!--/email_off-->");
    expect(out).not.toContain("/cdn-cgi/l/email-protection");
    expect(out).toContain('href="https://www.11tik.com/p/contact.html"');
    expect(edgeWrap(input)).toContain("<!--email_off-->");
  });

  it("is idempotent when email_off already present", () => {
    const once = wrapMailtoWithEmailOff(
      '<a href="mailto:user@example.com">user@example.com</a>',
    );
    expect(wrapMailtoWithEmailOff(once)).toBe(once);
  });

  it("does not rewrite non-mailto links", () => {
    const input = '<a href="https://www.11tik.com/p/contact.html">Contact</a>';
    expect(wrapMailtoWithEmailOff(input)).toBe(input);
  });

  it("does not turn mailto into contact.html (preserves click-to-mail UX)", () => {
    const input = '<a href="mailto:user@example.com">user@example.com</a>';
    const out = wrapMailtoWithEmailOff(input);
    expect(out).toContain('href="mailto:user@example.com"');
    expect(out).not.toContain("/p/contact.html");
  });

  it("decodes CF email-protection hashes back to mailto", () => {
    const email = "jaouahircharifjaouahir@gmail.com";
    // Build a CF-style XOR hex payload (key 0x32 matches live sample prefix).
    const key = 0x32;
    let hex = key.toString(16).padStart(2, "0");
    for (const ch of email) {
      hex += (ch.charCodeAt(0) ^ key).toString(16).padStart(2, "0");
    }
    expect(decodeCfEmail(hex)).toBe(email);
    const html = `<a href="/cdn-cgi/l/email-protection#${hex}">${email}</a>`;
    const out = rewriteEmailProtectionLinks(html);
    expect(out).toContain(`href="mailto:${email}"`);
    expect(out).toContain("<!--email_off-->");
    expect(out).not.toContain("/cdn-cgi/l/email-protection");
  });

  it("English legal static pages have no crawlable email-protection links", () => {
    const pages = [
      { contentId: "about", sourceRel: "docs/blogger-pages/about.html", path: "/p/about.html" },
      { contentId: "contact", sourceRel: "docs/blogger-pages/contact.html", path: "/p/contact.html" },
      { contentId: "privacy", sourceRel: "docs/blogger-pages/privacy.html", path: "/p/privacy.html" },
      {
        contentId: "terms",
        sourceRel: "docs/blogger-pages/terms.html",
        path: "/p/terms-of-use.html",
      },
    ];
    for (const page of pages) {
      const item = {
        contentId: page.contentId,
        type: "utility",
        canonicalPath: page.path,
        canonicalUrl: `https://www.11tik.com${page.path}`,
        sourceRel: page.sourceRel,
      };
      const html = renderEnglishStaticHtml(item);
      expect(html, page.contentId).not.toContain("/cdn-cgi/l/email-protection");
      expect(html, page.contentId).toContain("<!--email_off-->");
      expect(html, page.contentId).toMatch(/href="mailto:[^"]+"/);
    }
  });

  it("protectEmailsInHtml combines wrap + rewrite", () => {
    const out = protectEmailsInHtml(
      '<a href="/cdn-cgi/l/email-protection#3211">x</a> <a href="mailto:a@b.c">a@b.c</a>',
    );
    expect(out).toContain("<!--email_off-->");
    expect(out).toContain('href="mailto:a@b.c"');
  });
});
