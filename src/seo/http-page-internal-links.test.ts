import { describe, expect, it } from "vitest";
import worker, { httpsRedirectIfNeeded } from "../../workers/11tik-edge.js";

describe("HTTP page must not be 200 HTML (Ahrefs File 18)", () => {
  it("301s http homepage (and query variants) to https", () => {
    for (const path of ["/", "/?bulk=1", "/?posts=1"]) {
      const redirect = httpsRedirectIfNeeded(
        new Request(`http://www.11tik.com${path}`),
      );
      expect(redirect, path).not.toBeNull();
      expect(redirect.status).toBe(301);
      expect(redirect.headers.get("Location")).toBe(`https://www.11tik.com${path}`);
    }
  });

  it("Worker redirects http / before Assets HTML can be a crawlable HTTP page", async () => {
    const env = {
      ASSETS: {
        fetch: async () =>
          new Response("<html><a href='https://www.11tik.com/'>home</a></html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      },
    };

    const http = await worker.fetch(new Request("http://www.11tik.com/"), env);
    expect(http.status).toBe(301);
    expect(http.headers.get("Location")).toBe("https://www.11tik.com/");

    const https = await worker.fetch(new Request("https://www.11tik.com/"), env);
    expect(https.status).toBe(200);
    expect(await https.text()).toContain("https://www.11tik.com/");
  });
});
