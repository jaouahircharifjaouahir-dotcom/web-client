import { describe, expect, it } from "vitest";
import { buildShareUrls } from "./social";

describe("buildShareUrls", () => {
  it("encodes title and url", () => {
    const urls = buildShareUrls("https://www.11tik.com/?v=abc", "Hello there");
    expect(urls.facebook).toContain("u=https%3A%2F%2Fwww.11tik.com");
    expect(urls.whatsapp).toContain("Hello%20there");
    expect(urls.email.startsWith("mailto:")).toBe(true);
  });
});
