import { describe, expect, it } from "vitest";
import worker from "../../workers/11tik-edge.js";

describe("Worker ASSETS passthrough (copyright SPA)", () => {
  it("serves /copyright and /copyright?m=1 via ASSETS without redirect", async () => {
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
    const b = await worker.fetch(new Request("https://www.11tik.com/copyright?m=1"), env);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(seen).toEqual(["/copyright", "/copyright?m=1"]);
  });
});
