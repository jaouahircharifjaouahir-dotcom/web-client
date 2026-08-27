import { describe, expect, it } from "vitest";
import {
  toHttpsUrl,
  upgradeHttpCanonicals,
} from "../../workers/html-meta.js";
import { httpsRedirectIfNeeded } from "../../workers/11tik-edge.js";

describe("HTTPS canonicals (Ahrefs File 21)", () => {
  it("upgrades http:// 11tik URLs to https://", () => {
    expect(toHttpsUrl("http://www.11tik.com/")).toBe("https://www.11tik.com/");
    expect(toHttpsUrl("http://www.11tik.com/p/about.html")).toBe(
      "https://www.11tik.com/p/about.html",
    );
    expect(toHttpsUrl("https://www.11tik.com/")).toBe("https://www.11tik.com/");
  });

  it("rewrites http canonical and og:url in HTML", () => {
    const html = `<link href='http://www.11tik.com/' rel='canonical'/>
<meta content='http://www.11tik.com/' property='og:url'/>`;
    const out = upgradeHttpCanonicals(html);
    expect(out).toContain("https://www.11tik.com/");
    expect(out).not.toMatch(/href='http:\/\/www\.11tik\.com\//);
    expect(out).not.toMatch(/content='http:\/\/www\.11tik\.com\//);
  });

  it("http homepage is a redirect, not a 200 document with a canonical", () => {
    const redirect = httpsRedirectIfNeeded(new Request("http://www.11tik.com/"));
    expect(redirect).not.toBeNull();
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("Location")).toBe("https://www.11tik.com/");
  });
});
