import { describe, expect, it } from "vitest";
import { SITE } from "./site";

describe("preferred public URL", () => {
  it("uses HTTPS www with a trailing slash", () => {
    expect(SITE.canonicalHome).toBe("https://www.11tik.com/");
    expect(SITE.origin).toBe("https://www.11tik.com");
  });

  it("points Open Graph at a 1200x630 share image", () => {
    expect(SITE.ogImage).toContain("og-image-1200x630.png");
    expect(SITE.ogImage).toContain("www.11tik.com");
    expect(SITE.ogImageAlt).toContain("11tik");
    expect(SITE.ogWidth).toBe(1200);
    expect(SITE.ogHeight).toBe(630);
  });

  it("keeps self-hosted favicon identity", () => {
    expect(SITE.icons.png32).toContain("/web-client/icons/favicon-32.png");
    expect(SITE.icons.png16).toContain("/web-client/icons/favicon-16.png");
    expect(SITE.icons.apple180).toContain("/web-client/icons/apple-touch-icon-180.png");
    expect(SITE.icons.png32).not.toContain("blogger.googleusercontent.com");
  });
});
