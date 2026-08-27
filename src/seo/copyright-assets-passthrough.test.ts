import { describe, expect, it } from "vitest";
import worker from "../../workers/11tik-edge.js";

describe("Worker ASSETS passthrough (copyright SPA)", () => {
  it("serves clean /copyright via ASSETS", async () => {
    const seen: string[] = [];
    const env = {
      ASSETS: {
        fetch(req: Request) {
          const url = new URL(req.url);
          seen.push(url.pathname + url.search);
          return new Response("<!doctype html><title>spa</title>", { status: 200 });
        },
      },
    };
    const a = await worker.fetch(new Request("https://www.11tik.com/copyright"), env);
    expect(a.status).toBe(200);
    expect(seen).toEqual(["/copyright"]);
  });

  it("301-canonicalizes /copyright?m=1 (and any query) away from Blogger", async () => {
    const env = {
      ASSETS: {
        fetch() {
          throw new Error("ASSETS must not run before copyright query canonicalize");
        },
      },
    };
    for (const q of ["?m=1", "?m=0", "?foo=1", "?bulk=1"]) {
      const res = await worker.fetch(new Request(`https://www.11tik.com/copyright${q}`), env);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe("https://www.11tik.com/copyright");
    }
  });

  it("does not strip homepage SPA queries (?bulk=1 / ?posts=1 / ?k=)", async () => {
    const seen: string[] = [];
    const env = {
      ASSETS: {
        fetch(req: Request) {
          seen.push(new URL(req.url).pathname + new URL(req.url).search);
          return new Response("ok", { status: 200 });
        },
      },
    };
    for (const q of ["?bulk=1", "?posts=1", "?k=youtube-thumbnail-download"]) {
      const res = await worker.fetch(new Request(`https://www.11tik.com/${q}`), env);
      expect(res.status).toBe(200);
    }
    expect(seen).toEqual([
      "/?bulk=1",
      "/?posts=1",
      "/?k=youtube-thumbnail-download",
    ]);
  });
});
