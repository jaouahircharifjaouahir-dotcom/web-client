import { describe, expect, it } from "vitest";
import { isValidBlogId } from "./validate";

describe("isValidBlogId", () => {
  it("accepts numeric Blogger IDs", () => {
    expect(isValidBlogId("1234567890")).toBe(true);
  });

  it("rejects empty or non-numeric values", () => {
    expect(isValidBlogId("")).toBe(false);
    expect(isValidBlogId("abc")).toBe(false);
    expect(isValidBlogId("https://www.11tik.com")).toBe(false);
  });
});
