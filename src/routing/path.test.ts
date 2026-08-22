import { describe, expect, it } from "vitest";
import { parseAppRoute } from "./path";

describe("parseAppRoute", () => {
  it("reads tag slugs", () => {
    expect(parseAppRoute("/tag/shorts")).toEqual({ name: "tag", slug: "shorts" });
  });

  it("reads copyright and tags", () => {
    expect(parseAppRoute("/about")).toEqual({ name: "about" });
    expect(parseAppRoute("/p/about.html")).toEqual({ name: "about" });
    expect(parseAppRoute("/p/privacy.html")).toEqual({ name: "privacy" });
    expect(parseAppRoute("/p/terms-of-use.html")).toEqual({ name: "terms" });
    expect(parseAppRoute("/p/contact.html")).toEqual({ name: "contact" });
    expect(parseAppRoute("/p/embed.html")).toEqual({ name: "embed" });
    expect(parseAppRoute("/p/keyword-tools.html")).toEqual({ name: "keywords" });
    expect(parseAppRoute("/copyright")).toEqual({ name: "copyright" });
  });
});
