import { describe, expect, it } from "vitest";
import { viewMeta } from "../../workers/page-meta.js";

describe("viewMeta", () => {
  it("keeps the home description only on /", () => {
    const home = viewMeta("Extractor", "Home description for the tool.", "/");
    expect(home.description).toBe("Home description for the tool.");
  });

  it("uses a unique about description", () => {
    const about = viewMeta("Extractor", "Home description for the tool.", "/p/about.html");
    expect(about.description).not.toBe("Home description for the tool.");
    expect(about.description.toLowerCase()).toContain("11tik");
  });

  it("describes tag pages from the slug", () => {
    const tag = viewMeta("Extractor", "Home description for the tool.", "/tag/shorts");
    expect(tag.description).toContain("shorts");
    expect(tag.description).not.toBe("Home description for the tool.");
  });
});
