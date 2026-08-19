import { describe, expect, it } from "vitest";
import { SITE } from "./site";

describe("preferred public URL", () => {
  it("uses HTTPS www with a trailing slash", () => {
    expect(SITE.canonicalHome).toBe("https://www.11tik.com/");
    expect(SITE.origin).toBe("https://www.11tik.com");
  });

  it("points Open Graph at a 1200x630 share image", () => {
    expect(SITE.ogImage).toContain("og-image-1200x630.png");
    expect(SITE.ogWidth).toBe(1200);
    expect(SITE.ogHeight).toBe(630);
  });

  it("keeps the hosted favicon identity", () => {
    expect(SITE.icons.png32).toContain("/s32/favicon-2.png");
    expect(SITE.icons.png16).toContain("/s16/favicon-1.png");
    expect(SITE.icons.apple180).toContain("/s180/apple-touch-icon.png");
  });
});
