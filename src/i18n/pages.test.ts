import { describe, expect, it } from "vitest";
import { pageString } from "./pages";

describe("page translations", () => {
  it("uses Arabic nav and legal copy on ar", () => {
    expect(pageString("ar", "trendingTags")).toBe("الوسوم الرائجة");
    expect(pageString("ar", "trustAbout")).toBe("من نحن");
    expect(pageString("ar", "legalTitle")).toBe("حقوق الاستخدام");
    expect(pageString("ar", "aboutBody")).toContain("11tik");
  });

  it("uses French titles on fr", () => {
    expect(pageString("fr", "guidePillar")).toContain("miniatures");
    expect(pageString("fr", "trustPrivacy")).toBe("Confidentialité");
  });

  it("falls back to catalog copy for locales without a full pack", () => {
    const body = pageString("sw", "aboutBody");
    expect(body.length).toBeGreaterThan(20);
  });
});
