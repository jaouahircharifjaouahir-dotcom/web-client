import { describe, expect, it } from "vitest";
import worker, { httpsRedirectIfNeeded } from "../../workers/11tik-edge.js";

describe("HTTPS redirect (Ahrefs File 17)", () => {
  it("301s http sitemap to the https twin", async () => {
    const redirect = httpsRedirectIfNeeded(
      new Request("http://www.11tik.com/sitemap.xml"),
    );
    expect(redirect).not.toBeNull();
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("Location")).toBe("https://www.11tik.com/sitemap.xml");
  });

  it("leaves https requests alone", () => {
    expect(
      httpsRedirectIfNeeded(new Request("https://www.11tik.com/sitemap.xml")),
    ).toBeNull();
  });

  it("Worker serves Assets sitemap on https and redirects http", async () => {
    const assetsBody = '<?xml version="1.0"?><urlset></urlset>';
    const env = {
      ASSETS: {
        fetch: async () =>
          new Response(assetsBody, {
            status: 200,
            headers: { "content-type": "application/xml" },
          }),
      },
    };

    const http = await worker.fetch(new Request("http://www.11tik.com/sitemap.xml"), env);
    expect(http.status).toBe(301);
    expect(http.headers.get("Location")).toBe("https://www.11tik.com/sitemap.xml");

    const https = await worker.fetch(new Request("https://www.11tik.com/sitemap.xml"), env);
    expect(https.status).toBe(200);
    expect(await https.text()).toBe(assetsBody);
  });
});
