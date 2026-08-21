import { describe, expect, it } from "vitest";
import { isValidBlogId, mapBloggerError, parseLabels, readState, signState } from "../../scripts/blogger-studio-lib.mjs";

describe("blogger-studio-lib", () => {
  it("parses labels", () => {
    expect(parseLabels("guide, youtube")).toEqual(["guide", "youtube"]);
  });

  it("maps unauthorized Blogger errors", () => {
    expect(mapBloggerError(401, { error: "invalid credentials" }).error).toMatch(/not authorized/i);
  });

  it("signs and reads OAuth state", () => {
    const token = signState({ blogId: "12345678901", t: 1 }, "secret");
    expect(readState(token, "secret").blogId).toBe("12345678901");
    expect(isValidBlogId("12345678901")).toBe(true);
  });
});
