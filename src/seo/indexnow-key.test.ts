import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateStaticSite } from "../../scripts/generate-static-site.mjs";
import {
  INDEXNOW_KEY,
  INDEXNOW_KEY_PATH,
  indexNowKeyBody,
  indexNowKeyFilename,
} from "../../scripts/i18n/indexnow-key.mjs";
import worker, { httpsRedirectIfNeeded } from "../../workers/11tik-edge.js";

const PRODUCTION_URL = `https://www.11tik.com${INDEXNOW_KEY_PATH}`;

describe("IndexNow root verification key", () => {
  it("exports the exact key and root path", () => {
    expect(INDEXNOW_KEY).toBe("r1nu3dmfdwyzm6u39zktu5gtww7zvv1z");
    expect(INDEXNOW_KEY_PATH).toBe("/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt");
    expect(indexNowKeyFilename()).toBe("r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt");
    expect(indexNowKeyBody()).toBe(INDEXNOW_KEY);
    expect(indexNowKeyBody()).not.toMatch(/<|>|\{|\}/);
    expect(indexNowKeyBody().includes("\n")).toBe(false);
  });

  it("writes the exact key-only body into staged Static Assets", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-indexnow-"));
    try {
      generateStaticSite(dir);
      const file = join(dir, indexNowKeyFilename());
      const body = readFileSync(file, "utf8");
      expect(body).toBe(INDEXNOW_KEY);
      expect(body).toBe("r1nu3dmfdwyzm6u39zktu5gtww7zvv1z");
      expect(body.length).toBe(INDEXNOW_KEY.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("301s http IndexNow URL to https", () => {
    const redirect = httpsRedirectIfNeeded(
      new Request(`http://www.11tik.com${INDEXNOW_KEY_PATH}`),
    );
    expect(redirect).not.toBeNull();
    expect(redirect!.status).toBe(301);
    expect(redirect!.headers.get("Location")).toBe(PRODUCTION_URL);
  });

  it("serves the key via Worker ASSETS passthrough at the exact production path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-indexnow-assets-"));
    let assetBody = "";
    try {
      generateStaticSite(dir);
      assetBody = readFileSync(join(dir, indexNowKeyFilename()), "utf8");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const seen: string[] = [];
    const env = {
      ASSETS: {
        async fetch(request: Request) {
          const path = new URL(request.url).pathname;
          seen.push(path);
          expect(path).toBe(INDEXNOW_KEY_PATH);
          return new Response(assetBody, {
            status: 200,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        },
      },
    };

    const res = await worker.fetch(new Request(PRODUCTION_URL), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual([INDEXNOW_KEY_PATH]);
    expect(res.headers.get("content-type") || "").toMatch(/^text\/plain/i);
    const text = await res.text();
    expect(text).toBe(INDEXNOW_KEY);
    expect(text).toBe("r1nu3dmfdwyzm6u39zktu5gtww7zvv1z");
    expect(text).not.toContain("<");
    expect(text).not.toContain("{");
  });
});
