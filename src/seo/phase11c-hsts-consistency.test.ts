import { describe, expect, it } from "vitest";
import worker, {
  apexToWwwRedirectIfNeeded,
  withSecurityHeaders,
} from "../../workers/11tik-edge.js";
import { HSTS_ZONE_BASELINE } from "../../scripts/security-headers.mjs";
import { validateSecurityHeaders } from "../../scripts/security-headers.mjs";

const env = {
  ASSETS: {
    fetch(request: Request) {
      const url = new URL(request.url);
      if (url.pathname === "/search") {
        return new Response("gone", { status: 410, headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (url.pathname === "/p/random.html") {
        return new Response("404", { status: 404 });
      }
      return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
    },
  },
};

describe("Phase 11C — Worker HSTS consistency", () => {
  it("withSecurityHeaders matches zone baseline without preload", () => {
    const res = withSecurityHeaders(new Response("ok", { status: 200 }));
    const sts = res.headers.get("strict-transport-security");
    expect(sts).toBe(HSTS_ZONE_BASELINE);
    expect(sts).not.toContain("preload");
  });

  it("withSecurityHeaders is idempotent and does not overwrite existing HSTS", () => {
    const preset = new Response("ok", {
      status: 200,
      headers: { "strict-transport-security": "max-age=60" },
    });
    const once = withSecurityHeaders(preset);
    expect(once.headers.get("strict-transport-security")).toBe("max-age=60");
    const twice = withSecurityHeaders(once);
    expect(twice.headers.get("strict-transport-security")).toBe("max-age=60");
  });

  it("apex redirect carries zone-aligned HSTS", () => {
    const res = apexToWwwRedirectIfNeeded(new Request("https://11tik.com/"));
    expect(res?.headers.get("strict-transport-security")).toBe(HSTS_ZONE_BASELINE);
  });

  it("Worker 410 retirement includes zone-aligned HSTS", async () => {
    const res = await worker.fetch(new Request("https://www.11tik.com/search"), env);
    expect(res.status).toBe(410);
    expect(res.headers.get("strict-transport-security")).toBe(HSTS_ZONE_BASELINE);
  });

  it("Worker 404 includes zone-aligned HSTS", async () => {
    const res = await worker.fetch(new Request("https://www.11tik.com/p/random.html"), env);
    expect(res.status).toBe(404);
    expect(res.headers.get("strict-transport-security")).toBe(HSTS_ZONE_BASELINE);
  });

  it("validateSecurityHeaders accepts zone HSTS on full header set", () => {
    const headers = {
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "content-security-policy-report-only": "default-src 'self'",
      "strict-transport-security": HSTS_ZONE_BASELINE,
    };
    expect(validateSecurityHeaders(headers)).toEqual([]);
  });
});
