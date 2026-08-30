import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import worker, {
  handlePrimaryPPathRequest,
  localizedHtmlTrailingSlashCanonicalRedirect,
  utilityTrailingSlashCanonicalRedirect,
} from "../../workers/11tik-edge.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst } from "./test-helpers/run-worker-first.ts";
import {
  matchesPhase7bRunWorkerFirst,
  PHASE7B_LOCALE_RWF_NEGATIVES,
  PHASE7B_RUN_WORKER_FIRST,
} from "./test-helpers/cloudflare-run-worker-first.ts";

const SITE = "https://www.11tik.com";
const FR = "https://fr.11tik.com";
const AR = "https://ar.11tik.com";

function assetsEnv(onFetch: (pathname: string) => Response | Promise<Response>) {
  const seen: string[] = [];
  return {
    seen,
    env: {
      ASSETS: {
        fetch(req: Request) {
          seen.push(new URL(req.url).pathname);
          return onFetch(new URL(req.url).pathname);
        },
      },
    },
  };
}

describe("Phase 5.3B — localizedHtmlTrailingSlashCanonicalRedirect", () => {
  it("A. FR utility slash → 301 target", () => {
    const url = new URL(`${FR}/l/fr/p/about.html/`);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(url, "fr.11tik.com")).toBe(
      `${FR}/l/fr/p/about.html`,
    );
  });

  it("B. AR utility slash → 301 target", () => {
    const url = new URL(`${AR}/l/ar/p/about.html/`);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(url, "ar.11tik.com")).toBe(
      `${AR}/l/ar/p/about.html`,
    );
  });

  it("C. FR article slash → 301 target", () => {
    const url = new URL(`${FR}/l/fr/2026/08/how-to-download-youtube-thumbnail.html/`);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(url, "fr.11tik.com")).toBe(
      `${FR}/l/fr/2026/08/how-to-download-youtube-thumbnail.html`,
    );
  });

  it("E. AR article slash → 301 target", () => {
    const url = new URL(`${AR}/l/ar/2026/08/how-to-download-youtube-thumbnail.html/`);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(url, "ar.11tik.com")).toBe(
      `${AR}/l/ar/2026/08/how-to-download-youtube-thumbnail.html`,
    );
  });

  it("D. query on slashed path → redirect target has no query", () => {
    const util = new URL(`${FR}/l/fr/p/about.html/?m=1`);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(util, "fr.11tik.com")).toBe(
      `${FR}/l/fr/p/about.html`,
    );
    const article = new URL(
      `${FR}/l/fr/2026/08/how-to-download-youtube-thumbnail.html/?foo=1`,
    );
    expect(localizedHtmlTrailingSlashCanonicalRedirect(article, "fr.11tik.com")).toBe(
      `${FR}/l/fr/2026/08/how-to-download-youtube-thumbnail.html`,
    );
  });

  it("H. unknown localized random.html/ → no redirect", () => {
    const url = new URL(`${FR}/l/fr/random.html/`);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(url, "fr.11tik.com")).toBe("");
  });

  it("K. host preservation — rejects locale host / path mismatch", () => {
    const url = new URL(`${FR}/l/ar/p/about.html/`);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(url, "fr.11tik.com")).toBe("");
  });

  it("www host allows /l/fr/ paths when path locale is valid", () => {
    const url = new URL(`${SITE}/l/fr/p/about.html/`);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(url, "www.11tik.com")).toBe(
      `${SITE}/l/fr/p/about.html`,
    );
  });

  it("does not match clean paths, locale home, or non-html trailing slash", () => {
    expect(
      localizedHtmlTrailingSlashCanonicalRedirect(new URL(`${FR}/l/fr/p/about.html`), "fr.11tik.com"),
    ).toBe("");
    expect(localizedHtmlTrailingSlashCanonicalRedirect(new URL(`${FR}/l/fr/`), "fr.11tik.com")).toBe(
      "",
    );
    expect(
      localizedHtmlTrailingSlashCanonicalRedirect(new URL(`${FR}/l/fr/random`), "fr.11tik.com"),
    ).toBe("");
    expect(
      localizedHtmlTrailingSlashCanonicalRedirect(new URL(`${SITE}/p/about.html/`), "www.11tik.com"),
    ).toBe("");
    expect(
      localizedHtmlTrailingSlashCanonicalRedirect(
        new URL(`${SITE}/2026/08/how-to-download-youtube-thumbnail.html/`),
        "www.11tik.com",
      ),
    ).toBe("");
  });
});

describe("Phase 5.3B — Worker fetch integration", () => {
  it("A–D. slashed localized URLs 301 before Assets (L. no fetch, M. no SPA body)", async () => {
    const cases = [
      [`${FR}/l/fr/p/about.html/`, `${FR}/l/fr/p/about.html`],
      [`${AR}/l/ar/p/about.html/`, `${AR}/l/ar/p/about.html`],
      [
        `${FR}/l/fr/2026/08/how-to-download-youtube-thumbnail.html/`,
        `${FR}/l/fr/2026/08/how-to-download-youtube-thumbnail.html`,
      ],
      [`${FR}/l/fr/p/about.html/?m=1`, `${FR}/l/fr/p/about.html`],
    ] as const;

    for (const [reqUrl, location] of cases) {
      const { env, seen } = assetsEnv(() => new Response("spa", { status: 200 }));
      const res = await worker.fetch(new Request(reqUrl), env);
      expect(res.status, reqUrl).toBe(301);
      expect(res.headers.get("location"), reqUrl).toBe(location);
      expect(seen, reqUrl).toEqual([]);
      const body = await res.text();
      expect(body, reqUrl).not.toContain("data-yte-locale");
    }
  });

  it("G. locale home remains Worker (not slash-redirected)", async () => {
    const frHome = readFileSync(join(getStagedStaticSite(), "l/fr/index.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/l/fr/index.html"
        ? new Response(frHome, { status: 200 })
        : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request(`${FR}/l/fr/`), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/fr/index.html"]);
    expect(await res.text()).toContain('data-yte-locale="fr"');
  });

  it("G2. locale query shells remain unchanged (not slash-redirected)", async () => {
    const frHome = readFileSync(join(getStagedStaticSite(), "l/fr/index.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/l/fr/index.html"
        ? new Response(frHome, { status: 200 })
        : new Response("x", { status: 404 }),
    );
    for (const q of ["?posts=1", "?bulk=1", "?m=1"]) {
      seen.length = 0;
      const res = await worker.fetch(new Request(`${FR}/l/fr/${q}`), env);
      if (q === "?m=1") {
        expect(res.status, q).toBe(301);
        expect(res.headers.get("location"), q).toBe(`${FR}/l/fr/`);
      } else {
        expect(res.status, q).toBe(200);
        expect(seen, q).toEqual(["/l/fr/index.html"]);
      }
    }
  });

  it("F. clean localized utility and article → no redirect, passthrough", async () => {
    const utilBody = readFileSync(join(getStagedStaticSite(), "l/fr/p/about.html"), "utf8");
    const articleBody = readFileSync(
      join(getStagedStaticSite(), "l/fr/2026/08/how-to-download-youtube-thumbnail.html"),
      "utf8",
    );
    const cases = [
      [`${FR}/l/fr/p/about.html`, "/l/fr/p/about.html", utilBody],
      [`${FR}/l/fr/p/keyword-tools.html`, "/l/fr/p/keyword-tools.html", utilBody],
      [
        `${FR}/l/fr/2026/08/how-to-download-youtube-thumbnail.html`,
        "/l/fr/2026/08/how-to-download-youtube-thumbnail.html",
        articleBody,
      ],
    ] as const;

    for (const [reqUrl, assetPath, body] of cases) {
      expect(localizedHtmlTrailingSlashCanonicalRedirect(new URL(reqUrl), "fr.11tik.com")).toBe("");
      const { env, seen } = assetsEnv((pathname) =>
        pathname === assetPath ? new Response(body, { status: 200 }) : new Response("x", { status: 404 }),
      );
      const res = await worker.fetch(new Request(reqUrl), env);
      expect(res.status, reqUrl).toBe(200);
      expect(seen, reqUrl).toEqual([assetPath]);
    }
  });

  it("H. unknown /l/fr/random.html/ unchanged (soft-404 passthrough, not slash helper)", async () => {
    const enSpa = readFileSync(join(getStagedStaticSite(), "index.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/l/fr/random.html/"
        ? new Response(enSpa, { status: 200 })
        : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request(`${FR}/l/fr/random.html/`), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/fr/random.html/"]);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(new URL(`${FR}/l/fr/random.html/`), "fr.11tik.com")).toBe(
      "",
    );
  });

  it("H2. unknown localized path without .html/ → unchanged passthrough", async () => {
    const enSpa = readFileSync(join(getStagedStaticSite(), "index.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/l/fr/random" ? new Response(enSpa, { status: 200 }) : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request(`${FR}/l/fr/random`), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/fr/random"]);
    expect(localizedHtmlTrailingSlashCanonicalRedirect(new URL(`${FR}/l/fr/random`), "fr.11tik.com")).toBe(
      "",
    );
  });

  it("I. /thumb/* unchanged", async () => {
    const thumb = "<html><body>thumb</body></html>";
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/thumb/dQw4w9WgXcQ" ? new Response(thumb, { status: 200 }) : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request(`${SITE}/thumb/dQw4w9WgXcQ`), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/thumb/dQw4w9WgXcQ"]);
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(false);
  });

  it("J. English /p/about.html/ still uses www utility handler", async () => {
    expect(utilityTrailingSlashCanonicalRedirect(new URL(`${SITE}/p/about.html/`))).toBe(
      `${SITE}/p/about.html`,
    );
    const res = await handlePrimaryPPathRequest(new URL(`${SITE}/p/about.html/`), {});
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe(`${SITE}/p/about.html`);
  });
});

describe("Phase 7B — Phase 7B narrow locale RWF interaction", () => {
  it("E. clean localized utility → Asset-first under Phase 7B RWF", () => {
    expect(matchesPhase7bRunWorkerFirst("/l/fr/p/about.html")).toBe(false);
  });

  it("F. clean localized article → Asset-first under Phase 7B RWF", () => {
    expect(matchesPhase7bRunWorkerFirst("/l/fr/2026/08/how-to-download-youtube-thumbnail.html")).toBe(
      false,
    );
  });

  it("trailing-slash localized paths stay Worker-first (negative excludes clean paths only)", () => {
    expect(matchesPhase7bRunWorkerFirst("/l/fr/p/about.html/")).toBe(true);
    expect(matchesPhase7bRunWorkerFirst("/l/fr/2026/08/how-to-download-youtube-thumbnail.html/")).toBe(
      true,
    );
  });

  it("locale home and unknown paths stay Worker-first", () => {
    expect(matchesPhase7bRunWorkerFirst("/l/fr/")).toBe(true);
    expect(matchesPhase7bRunWorkerFirst("/l/fr/random.html")).toBe(true);
    expect(matchesPhase7bRunWorkerFirst("/l/fr/random.html/")).toBe(true);
  });

  it("Phase 7B canary fixture includes narrow locale negative RWF entries", () => {
    expect(PHASE7B_RUN_WORKER_FIRST).toContain("/l/*");
    expect(PHASE7B_RUN_WORKER_FIRST).toContain(PHASE7B_LOCALE_RWF_NEGATIVES[0]);
    expect(PHASE7B_RUN_WORKER_FIRST).toContain(PHASE7B_LOCALE_RWF_NEGATIVES[1]);
    expect(PHASE7B_RUN_WORKER_FIRST).not.toContain("!/l/*/2026/*");
    expect(PHASE7B_RUN_WORKER_FIRST).not.toContain("!/l/*/p/*");
  });
});
