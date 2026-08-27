import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { INDEXNOW_KEY } from "../../scripts/i18n/indexnow-key.mjs";
import {
  stagedHtmlRelToPublicUrl,
  buildIndexNowSnapshot,
  collectAllowedPublicUrls,
  diffIndexNowSnapshots,
  dedupeUrls,
  groupUrlsByHost,
  INDEXNOW_SNAPSHOT_REL,
} from "../../scripts/i18n/indexnow-snapshot.mjs";
import { collectLocaleHomeSitemapLocs } from "../../workers/sitemap-canonicals.js";
import { getTargetLocales } from "../../scripts/i18n/target-languages.mjs";
import {
  assertKeyNotInClientBundle,
  buildIndexNowPayload,
  classifyIndexNowStatus,
  runIndexNowAfterStaticGeneration,
  shouldSubmitIndexNow,
  submitIndexNowBatches,
  writeCheckpoint,
} from "../../scripts/i18n/indexnow-submit.mjs";

function writeHtml(root: string, rel: string, body: string) {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, body);
}

describe("IndexNow URL mapping + diff", () => {
  it("maps staged HTML paths to final HTTPS public URLs", () => {
    expect(stagedHtmlRelToPublicUrl("index.html")).toBe("https://www.11tik.com/");
    expect(stagedHtmlRelToPublicUrl("2026/08/youtube-thumbnail-url.html")).toBe(
      "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
    );
    expect(stagedHtmlRelToPublicUrl("p/about.html")).toBe("https://www.11tik.com/p/about.html");
    expect(stagedHtmlRelToPublicUrl("l/ar/index.html")).toBe("https://ar.11tik.com/l/ar/");
    expect(stagedHtmlRelToPublicUrl("l/fr/2026/08/youtube-thumbnail-url.html")).toBe(
      "https://fr.11tik.com/l/fr/2026/08/youtube-thumbnail-url.html",
    );
    expect(stagedHtmlRelToPublicUrl("l/de/p/about.html")).toBe("https://de.11tik.com/l/de/p/about.html");
    expect(stagedHtmlRelToPublicUrl("web-client/index.html")).toBeNull();
  });

  it("deduplicates and groups by host", () => {
    const urls = [
      "https://www.11tik.com/a",
      "https://www.11tik.com/a",
      "http://www.11tik.com/b",
      "https://ar.11tik.com/l/ar/a",
    ];
    expect(dedupeUrls(urls)).toEqual(["https://www.11tik.com/a", "https://ar.11tik.com/l/ar/a"]);
    const grouped = groupUrlsByHost([
      "https://www.11tik.com/a",
      "https://ar.11tik.com/l/ar/a",
      "https://www.11tik.com/b",
    ]);
    expect([...grouped.keys()].sort()).toEqual(["ar.11tik.com", "www.11tik.com"]);
    expect(grouped.get("www.11tik.com")).toHaveLength(2);
  });

  it("new page → notify; updated → only changed; unchanged → empty; deleted → notify", () => {
    const prev = {
      urls: {
        "https://www.11tik.com/a": "hash-a",
        "https://www.11tik.com/old": "hash-old",
        "https://ar.11tik.com/l/ar/a": "hash-ar",
      },
    };
    const next = {
      urls: {
        "https://www.11tik.com/a": "hash-a",
        "https://www.11tik.com/b": "hash-b",
        "https://ar.11tik.com/l/ar/a": "hash-ar-2",
      },
    };
    const d = diffIndexNowSnapshots(prev, next);
    expect(d.added).toEqual(["https://www.11tik.com/b"]);
    expect(d.updated).toEqual(["https://ar.11tik.com/l/ar/a"]);
    expect(d.deleted).toEqual(["https://www.11tik.com/old"]);
    expect(d.unchanged).toEqual(["https://www.11tik.com/a"]);
    expect(d.notify.sort()).toEqual(
      [
        "https://www.11tik.com/b",
        "https://ar.11tik.com/l/ar/a",
        "https://www.11tik.com/old",
      ].sort(),
    );

    const same = diffIndexNowSnapshots(next, next);
    expect(same.notify).toEqual([]);
  });

  it("never treats stale locale as publishable in allowed snapshot mapping", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-in-stale-"));
    try {
      writeHtml(dir, "index.html", "<html>home</html>");
      writeHtml(dir, "l/ar/2026/08/ghost.html", "<html>stale should be excluded via allowlist</html>");
      const snap = buildIndexNowSnapshot(dir, {
        allowedUrls: new Set(["https://www.11tik.com/"]),
      });
      expect(Object.keys(snap.urls)).toEqual(["https://www.11tik.com/"]);
      expect(snap.urls["https://ar.11tik.com/l/ar/2026/08/ghost.html"]).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("excludes non-canonical en locale home even when l/en/index.html exists on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-in-en-"));
    try {
      writeHtml(dir, "index.html", "<html>www-home</html>");
      writeHtml(dir, "l/en/index.html", "<html>non-canonical en shell</html>");
      writeHtml(dir, "l/ar/index.html", "<html>ar home</html>");
      writeHtml(dir, "l/zz/index.html", "<html>unsupported shell</html>");

      const allowed = collectAllowedPublicUrls(dir);
      expect(allowed.has("https://www.11tik.com/")).toBe(true);
      expect(allowed.has("https://en.11tik.com/l/en/")).toBe(false);
      expect(allowed.has("https://ar.11tik.com/l/ar/")).toBe(true);
      expect(allowed.has("https://zz.11tik.com/l/zz/")).toBe(false);

      const snap = buildIndexNowSnapshot(dir, { allowedUrls: allowed });
      expect(snap.urls["https://en.11tik.com/l/en/"]).toBeUndefined();
      expect(snap.urls["https://www.11tik.com/"]).toBeDefined();
      expect(snap.urls["https://ar.11tik.com/l/ar/"]).toBeDefined();
      expect(snap.urls["https://zz.11tik.com/l/zz/"]).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("includes every target-locale home from inventory; disk alone is not enough", () => {
    const targets = getTargetLocales();
    expect(targets).toHaveLength(37);
    expect(targets).not.toContain("en");

    const allowed = collectAllowedPublicUrls("/nonexistent-staged-root");
    for (const code of targets) {
      expect(allowed.has(`https://${code}.11tik.com/l/${code}/`)).toBe(true);
    }
    // Sitemap ISO homes (≠ en) remain in allowlist — intentional public inventory alignment.
    for (const loc of collectLocaleHomeSitemapLocs()) {
      expect(allowed.has(loc)).toBe(true);
      expect(loc).not.toContain("en.11tik.com");
    }
  });
});

describe("IndexNow submit mechanics", () => {
  it("builds host-scoped payloads with keyLocation and exact key", () => {
    const payload = buildIndexNowPayload("www.11tik.com", [
      "https://www.11tik.com/a",
      "https://www.11tik.com/a",
    ]);
    expect(payload.host).toBe("www.11tik.com");
    expect(payload.key).toBe(INDEXNOW_KEY);
    expect(payload.keyLocation).toBe(`https://www.11tik.com/${INDEXNOW_KEY}.txt`);
    expect(payload.urlList).toEqual(["https://www.11tik.com/a"]);
  });

  it("classifies response codes", () => {
    expect(classifyIndexNowStatus(200)).toBe("success");
    expect(classifyIndexNowStatus(202)).toBe("success");
    expect(classifyIndexNowStatus(429)).toBe("retryable");
    expect(classifyIndexNowStatus(503)).toBe("retryable");
    expect(classifyIndexNowStatus(400)).toBe("fatal");
    expect(classifyIndexNowStatus(403)).toBe("fatal");
    expect(classifyIndexNowStatus(422)).toBe("fatal");
  });

  it("retries retryable failures with exponential backoff then succeeds", async () => {
    const delays: number[] = [];
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls < 3) return new Response("slow", { status: 429 });
      return new Response("ok", { status: 200 });
    });
    const out = await submitIndexNowBatches(["https://www.11tik.com/a"], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxRetries: 4,
      baseDelayMs: 10,
      sleepFn: async (ms: number) => {
        delays.push(ms);
      },
    });
    expect(out.submittedCount).toBe(1);
    expect(out.pending).toEqual([]);
    expect(calls).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it("does not retry fatal 422 and keeps pending for resume", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad host", { status: 422 }));
    const out = await submitIndexNowBatches(["https://www.11tik.com/a"], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxRetries: 3,
      sleepFn: async () => {},
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(out.submittedCount).toBe(0);
    expect(out.pending).toHaveLength(1);
    expect(out.pending[0].status).toBe(422);
  });

  it("shouldSubmitIndexNow is off for local builds unless explicitly enabled", () => {
    expect(shouldSubmitIndexNow({} as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldSubmitIndexNow({ INDEXNOW_SUBMIT: "0", WORKERS_CI: "1" } as NodeJS.ProcessEnv)).toBe(
      false,
    );
    expect(shouldSubmitIndexNow({ INDEXNOW_SUBMIT: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(shouldSubmitIndexNow({ WORKERS_CI: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(shouldSubmitIndexNow({ CF_PAGES: "1" } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("IndexNow after static generation", () => {
  it("unchanged build → zero submissions; writes snapshot asset", async () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-in-run-"));
    const checkpointPath = join(dir, "checkpoint.json");
    try {
      writeHtml(dir, "index.html", "<html>home-v1</html>");
      writeHtml(dir, "p/about.html", "<html>about-v1</html>");
      const allowed = new Set(["https://www.11tik.com/", "https://www.11tik.com/p/about.html"]);

      // Seed checkpoint as baseline matching current content
      const first = buildIndexNowSnapshot(dir, { allowedUrls: allowed });
      writeCheckpoint({ snapshot: first, pending: [] }, checkpointPath);

      const posts: Array<{ urlList: string[] }> = [];
      const submitFetch = vi.fn(async (_url: string, init?: RequestInit) => {
        posts.push(JSON.parse(String(init?.body || "{}")));
        return new Response("ok", { status: 200 });
      });

      const result = await runIndexNowAfterStaticGeneration(dir, {
        submit: true,
        allowedUrls: allowed,
        checkpointPath,
        fetchImpl: submitFetch as unknown as typeof fetch,
        liveSnapshotUrl: "https://example.invalid/missing.json",
        env: { INDEXNOW_SUBMIT: "1" },
        sleepFn: async () => {},
      });

      expect(result.notify).toEqual([]);
      expect(result.submitResult?.submittedCount).toBe(0);
      expect(submitFetch).not.toHaveBeenCalled();
      const snapFile = join(dir, INDEXNOW_SNAPSHOT_REL);
      expect(readFileSync(snapFile, "utf8")).toContain('"urlCount"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("new + updated page → submits only those URLs; localized ready URL included", async () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-in-delta-"));
    const checkpointPath = join(dir, "checkpoint.json");
    try {
      writeHtml(dir, "index.html", "<html>home</html>");
      writeHtml(dir, "2026/08/a.html", "<html>en-a-v1</html>");
      writeHtml(dir, "l/ar/2026/08/a.html", "<html>ar-a-v1</html>");
      const allowed = new Set([
        "https://www.11tik.com/",
        "https://www.11tik.com/2026/08/a.html",
        "https://ar.11tik.com/l/ar/2026/08/a.html",
      ]);
      const baseline = buildIndexNowSnapshot(dir, { allowedUrls: allowed });
      writeCheckpoint({ snapshot: baseline, pending: [] }, checkpointPath);

      writeHtml(dir, "2026/08/a.html", "<html>en-a-v2</html>");
      writeHtml(dir, "2026/08/b.html", "<html>en-b-new</html>");
      writeHtml(dir, "l/ar/2026/08/a.html", "<html>ar-a-v1</html>");
      allowed.add("https://www.11tik.com/2026/08/b.html");

      const bodies: Array<{ host: string; urlList: string[] }> = [];
      const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body || "{}")));
        return new Response("ok", { status: 202 });
      });

      const result = await runIndexNowAfterStaticGeneration(dir, {
        submit: true,
        allowedUrls: allowed,
        checkpointPath,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        env: { INDEXNOW_SUBMIT: "1" },
        sleepFn: async () => {},
      });

      expect(result.notify.sort()).toEqual(
        ["https://www.11tik.com/2026/08/a.html", "https://www.11tik.com/2026/08/b.html"].sort(),
      );
      expect(result.notify).not.toContain("https://ar.11tik.com/l/ar/2026/08/a.html");
      expect(bodies.length).toBeGreaterThanOrEqual(1);
      const allSubmitted = bodies.flatMap((b) => b.urlList);
      expect(allSubmitted.sort()).toEqual(result.notify.sort());
      expect(bodies.every((b) => b.host === "www.11tik.com")).toBe(true);
      expect(JSON.stringify(bodies)).toContain(INDEXNOW_KEY);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("empty baseline does not mass-submit unless INDEXNOW_SUBMIT_BASELINE=1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-in-base-"));
    const checkpointPath = join(dir, "checkpoint.json");
    try {
      writeHtml(dir, "index.html", "<html>home</html>");
      const fetchImpl = vi.fn(async () => new Response("missing", { status: 404 }));
      const result = await runIndexNowAfterStaticGeneration(dir, {
        submit: true,
        allowedUrls: new Set(["https://www.11tik.com/"]),
        checkpointPath,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        env: { INDEXNOW_SUBMIT: "1" },
      });
      expect(result.baselineSkipped).toBe(true);
      expect(result.notify).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("restart resumes pending failed batches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-in-resume-"));
    const checkpointPath = join(dir, "checkpoint.json");
    try {
      writeHtml(dir, "index.html", "<html>home</html>");
      writeHtml(dir, "p/about.html", "<html>about</html>");
      const allowed = new Set(["https://www.11tik.com/", "https://www.11tik.com/p/about.html"]);
      const snap = buildIndexNowSnapshot(dir, { allowedUrls: allowed });
      writeCheckpoint(
        {
          snapshot: { ...snap, urls: { "https://www.11tik.com/": snap.urls["https://www.11tik.com/"] } },
          pending: [
            {
              host: "www.11tik.com",
              urls: ["https://www.11tik.com/p/about.html"],
              status: 503,
            },
          ],
        },
        checkpointPath,
      );

      const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
      const result = await runIndexNowAfterStaticGeneration(dir, {
        submit: true,
        allowedUrls: allowed,
        checkpointPath,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        env: { INDEXNOW_SUBMIT: "1" },
        sleepFn: async () => {},
      });
      expect(result.notify).toContain("https://www.11tik.com/p/about.html");
      expect(fetchImpl).toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not leak IndexNow key into HTML snapshot pages", () => {
    assertKeyNotInClientBundle("<html><body>ok</body></html>");
    expect(() => assertKeyNotInClientBundle(`const k="${INDEXNOW_KEY}"`)).toThrow(/leaked/);
    // Filename reference alone is OK (verification path).
    assertKeyNotInClientBundle(`href="/${INDEXNOW_KEY}.txt"`);
  });
});
