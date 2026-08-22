import { describe, expect, it } from "vitest";
import { isAllowedHost } from "./hostGuard";

describe("isAllowedHost", () => {
  it("allows 11tik hosts and local dev", () => {
    expect(isAllowedHost("www.11tik.com")).toBe(true);
    expect(isAllowedHost("ar.11tik.com")).toBe(true);
    expect(isAllowedHost("fr.11tik.com")).toBe(true);
    expect(isAllowedHost("es.11tik.com")).toBe(true);
    expect(isAllowedHost("localhost")).toBe(true);
  });

  it("rejects GitHub Pages and foreign sites", () => {
    expect(isAllowedHost("jaouahircharifjaouahir-dotcom.github.io")).toBe(false);
    expect(isAllowedHost("example.com")).toBe(false);
  });
});
