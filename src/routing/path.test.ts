import { describe, expect, it } from "vitest";
import { parseAppRoute } from "./path";

describe("parseAppRoute", () => {
  it("reads tag slugs", () => {
    expect(parseAppRoute("/tag/shorts")).toEqual({ name: "tag", slug: "shorts" });
  });

  it("reads trust pages", () => {
    expect(parseAppRoute("/about")).toEqual({ name: "about" });
    expect(parseAppRoute("/copyright")).toEqual({ name: "copyright" });
  });
});
