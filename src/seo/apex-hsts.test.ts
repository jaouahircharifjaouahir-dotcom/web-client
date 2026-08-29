import { describe, expect, it } from "vitest";
import worker, {
  apexToWwwRedirectIfNeeded,
  httpsRedirectIfNeeded,
  withSecurityHeaders,
} from "../../workers/11tik-edge.js";

const HSTS = "max-age=31536000; includeSubDomains; preload";

const env = {
  ASSETS: {
    fetch(request: Request) {
      const url = new URL(request.url);
      if (url.pathname === "/robots.txt") {
        return new Response("user-agent: *\n", { status: 200, headers: { "content-type": "text/plain" } });
      }
      return new Response(
        '<!doctype html><html><head><title>Home</title></head><body><div id="yte-root"><h1>YouTube Thumbnail Extractor</h1><p>Intro.</p></div></body></html>',
        { status: 200, headers: { "content-type": "text/html" } },
      );
    },
  },
};

describe("apex HSTS redirect", () => {
  it("apexToWwwRedirectIfNeeded preserves path and query on www", () => {
    const res = apexToWwwRedirectIfNeeded(new Request("https://11tik.com/p/about.html?q=1"));
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe("https://www.11tik.com/p/about.html?q=1");
    expect(res?.headers.get("strict-transport-security")).toBe(HSTS);
  });

  it("does not redirect www or locale hosts", () => {
    expect(apexToWwwRedirectIfNeeded(new Request("https://www.11tik.com/"))).toBeNull();
    expect(apexToWwwRedirectIfNeeded(new Request("https://ar.11tik.com/l/ar/"))).toBeNull();
  });

  it("https apex homepage → 301 www with HSTS", async () => {
    const res = await worker.fetch(new Request("https://11tik.com/"), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://www.11tik.com/");
    expect(res.headers.get("strict-transport-security")).toBe(HSTS);
  });

  it("http apex → https apex (no loop) then worker would 301 www on follow", () => {
    const httpStep = httpsRedirectIfNeeded(new Request("http://11tik.com/"));
    expect(httpStep?.status).toBe(301);
    expect(httpStep?.headers.get("location")).toBe("https://11tik.com/");

    const httpsStep = apexToWwwRedirectIfNeeded(new Request("https://11tik.com/"));
    expect(httpsStep?.headers.get("location")).toBe("https://www.11tik.com/");
    expect(httpsStep?.headers.get("strict-transport-security")).toBe(HSTS);
  });

  it("www homepage remains 200 with HSTS", async () => {
    const res = await worker.fetch(new Request("https://www.11tik.com/"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("strict-transport-security")).toBe(HSTS);
  });

  it("locale hosts remain 200 with HSTS", async () => {
    for (const host of ["ar.11tik.com", "fr.11tik.com", "de.11tik.com"]) {
      const res = await worker.fetch(new Request(`https://${host}/l/${host.split(".")[0]}/`), env);
      expect(res.status, host).toBe(200);
      expect(res.headers.get("strict-transport-security"), host).toBe(HSTS);
    }
  });

  it("withSecurityHeaders is idempotent", () => {
    const once = withSecurityHeaders(new Response("ok", { status: 200 }));
    const twice = withSecurityHeaders(once);
    expect(once.headers.get("strict-transport-security")).toBe(HSTS);
    expect(twice.headers.get("strict-transport-security")).toBe(HSTS);
  });
});
