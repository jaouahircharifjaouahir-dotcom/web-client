import { describe, expect, it } from "vitest";
import { hreflangLinks, ISO6391, localeSitemapLocs } from "../../workers/iso6391.js";

describe("locale SEO discovery", () => {
  it("does not advertise language subdomains in the sitemap helper", () => {
    expect(localeSitemapLocs()).toEqual(["https://www.11tik.com/"]);
  });

  it("emits static hreflang for every real locale host", () => {
    const html = hreflangLinks("/");
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain("https://www.11tik.com/");
    expect(html).toContain("https://ar.11tik.com/l/ar/");
    expect(html).toContain("https://fr.11tik.com/l/fr/");
    expect(html).not.toContain('href="https://ar.11tik.com/"');
    expect(html.match(/hreflang=/g)?.length).toBe(ISO6391.length + 1);
  });
});
