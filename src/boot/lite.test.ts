import { describe, expect, it } from "vitest";

function withoutMobileParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("m");
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

describe("Blogger mobile param", () => {
  it("strips m=1 and keeps other query values", () => {
    expect(withoutMobileParam("https://www.11tik.com/?m=1")).toBe("/");
    expect(withoutMobileParam("https://www.11tik.com/p/about.html?m=1")).toBe("/p/about.html");
    expect(withoutMobileParam("https://www.11tik.com/?m=1&utm=1")).toBe("/?utm=1");
  });
});
