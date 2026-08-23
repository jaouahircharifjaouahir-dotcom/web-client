import { describe, expect, it } from "vitest";
import { hreflangLinks, localeSitemapLocs } from "../../workers/iso6391.js";

describe("locale SEO discovery", () => {
  it("does not advertise language subdomains in the sitemap", () => {
    expect(localeSitemapLocs()).toEqual(["https://www.11tik.com/"]);
  });

  it("only emits www hreflang", () => {
    const html = hreflangLinks("/");
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain("https://www.11tik.com/");
    expect(html).not.toContain("fr.11tik.com");
    expect(html).not.toContain("ar.11tik.com");
    expect(html.match(/hreflang=/g)?.length).toBe(2);
  });
});
