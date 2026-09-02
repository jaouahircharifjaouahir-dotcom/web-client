import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAtomicRedirectsDocument } from "../../scripts/i18n/build-atomic-redirects.mjs";
import { buildRouteManifest } from "../../scripts/i18n/build-route-manifest.mjs";
import { legacyPRedirectUrl } from "../../workers/11tik-edge.js";
import {
  buildAtomicRedirectMap,
  buildLegacyPRedirectsClean,
  createLegacyCleanRedirectResolver,
  LEGAL_SHORTCUT_TO_CLEAN,
  resolveLegacyCleanRedirect,
  validateAtomicRedirectMap,
} from "../../workers/clean-url-legacy-redirects.js";
import { LEGACY_P_REDIRECTS, SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";
import { resolveCleanUrl, ROUTE_LOOKUP_STATUS } from "../../workers/clean-url-resolver.js";

const manifest = buildRouteManifest();
const rules = buildAtomicRedirectMap(manifest);
const resolver = createLegacyCleanRedirectResolver(rules);

const KNOWN_ARTICLE = "how-to-download-youtube-thumbnail";
const KNOWN_PAGE = "about";
const STUDY = "youtube-thumbnail-sizes-resolutions-study";

function hop(pathname: string) {
  return resolver.resolve(pathname);
}

describe("atomic legacy redirect map", () => {
  it("validates with no chains, loops, or legacy targets", () => {
    const validation = validateAtomicRedirectMap(rules);
    expect(validation.ok, validation.errors.join("; ")).toBe(true);
    expect(validation.count).toBeGreaterThan(1500);
  });

  it("documents migration artifact counts", () => {
    const doc = buildAtomicRedirectsDocument(manifest);
    expect(doc.migrationReady).toBe(true);
    expect(doc.activeInProduction).toBe(true);
    expect(doc.counts.total).toBe(doc.rules.length);
    expect(doc.counts.localized).toBe(888 * 2);
    expect(doc.counts.en).toBe(doc.counts.total - doc.counts.localized);
  });

  it("EN /2026/MM/article.html → one hop → /article", () => {
    const rule = hop("/2026/08/how-to-download-youtube-thumbnail.html");
    expect(rule?.to).toBe("/how-to-download-youtube-thumbnail");
    expect(rule?.status).toBe(301);
    expect(hop("/how-to-download-youtube-thumbnail")).toBeNull();
  });

  it("EN /p/page.html → one hop → /page", () => {
    const rule = hop("/p/about.html");
    expect(rule?.to).toBe("/about");
    expect(hop("/about")).toBeNull();
  });

  it("localized /l/fr/2026/MM/article.html → one hop → /l/fr/article", () => {
    const rule = hop("/l/fr/2026/08/how-to-download-youtube-thumbnail.html");
    expect(rule?.to).toBe("/l/fr/how-to-download-youtube-thumbnail");
    expect(hop("/l/fr/how-to-download-youtube-thumbnail")).toBeNull();
  });

  it("localized /l/ar/p/page.html → one hop → /l/ar/page", () => {
    const rule = hop("/l/ar/p/about.html");
    expect(rule?.to).toBe("/l/ar/about");
  });

  it("study EN legacy → clean study slug", () => {
    const rule = hop("/2026/08/youtube-thumbnail-sizes-resolutions-study.html");
    expect(rule?.to).toBe("/youtube-thumbnail-sizes-resolutions-study");
  });

  it("localized study legacy has NO redirect (404 at migration)", () => {
    expect(hop("/l/fr/2026/08/youtube-thumbnail-sizes-resolutions-study.html")).toBeNull();
    expect(hop("/l/ar/2026/08/youtube-thumbnail-sizes-resolutions-study.html")).toBeNull();
  });

  it("missing legacy paths are absent from map", () => {
    expect(hop("/p/not-a-real-page.html")).toBeNull();
    expect(hop("/2026/08/not-a-real-article.html")).toBeNull();
    expect(hop("/l/fr/2026/08/not-a-real-article.html")).toBeNull();
  });
});

describe("LEGACY_P_REDIRECTS retarget (migration)", () => {
  const cleanRules = buildLegacyPRedirectsClean(manifest);

  it("retargets every LEGACY_P_REDIRECTS entry to a clean path", () => {
    expect(cleanRules.length).toBe(LEGACY_P_REDIRECTS.length);
    for (const rule of cleanRules) {
      expect(rule.to.startsWith("/2026/")).toBe(false);
      expect(rule.to.startsWith("/p/")).toBe(false);
      if (rule.to !== "/") expect(rule.to).toMatch(/^\/[a-z0-9-]+$/);
    }
  });

  it("eliminates two-hop /p/ → /2026/ → clean chains", () => {
    for (const legacy of LEGACY_P_REDIRECTS) {
      if (legacy.to === "/") continue;
      const migration = cleanRules.find((r) => r.from === legacy.from);
      expect(migration, legacy.from).toBeTruthy();
      expect(migration!.to).toBe(legacy.to);
      expect(migration!.to.startsWith("/2026/")).toBe(false);
    }
  });

  it("legacyPRedirectUrl targets final clean paths after migration", () => {
    const live = legacyPRedirectUrl("/p/how-to-download-youtube-thumbnail");
    expect(live).toBe(`${SITE_ORIGIN}/how-to-download-youtube-thumbnail`);
    const migration = cleanRules.find((r) => r.from === "/p/how-to-download-youtube-thumbnail");
    expect(migration?.to).toBe("/how-to-download-youtube-thumbnail");
  });
});

describe("redirect chain and loop safety", () => {
  it("has no rule whose target is also a redirect source", () => {
    const sources = new Set(rules.map((r) => r.from));
    for (const rule of rules) {
      expect(sources.has(rule.to), `chain: ${rule.from} → ${rule.to}`).toBe(false);
    }
  });

  it("legal shortcuts map directly to clean utility slugs", () => {
    expect(hop("/terms")?.to).toBe(LEGAL_SHORTCUT_TO_CLEAN["/terms"]);
    expect(hop("/about")).toBeNull();
    expect(hop("/embed")).toBeNull();
  });

  it("clean URL resolver does not redirect to legacy", () => {
    const result = resolveCleanUrl(`/${KNOWN_ARTICLE}`);
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.EXISTS);
    expect(hop(`/${KNOWN_ARTICLE}`)).toBeNull();
  });

  it("special routes are not in migration redirect map as sources from clean paths", () => {
    expect(hop("/")).toBeNull();
    expect(hop("/thumb/dQw4w9WgXcQ")).toBeNull();
    expect(hop("/web-client/blogger-app.js")).toBeNull();
  });
});

describe("trailing slash and extension behavior (migration design)", () => {
  it("extensionless legacy article maps to same clean slug as .html", () => {
    const html = hop("/2026/08/youtube-thumbnail-url.html");
    const bare = hop("/2026/08/youtube-thumbnail-url");
    expect(html?.to).toBe("/youtube-thumbnail-url");
    expect(bare?.to).toBe(html?.to);
  });

  it("does not emit trailing-slash or .html clean targets (except /)", () => {
    for (const rule of rules) {
      if (rule.to === "/") continue;
      expect(rule.to.endsWith("/"), rule.to).toBe(false);
      expect(rule.to.includes(".html"), rule.to).toBe(false);
    }
  });
});

describe("generated artifact", () => {
  it("worker atomic-legacy-redirects.json exists after manifest build", () => {
    const path = join(process.cwd(), "workers", "atomic-legacy-redirects.json");
    const doc = JSON.parse(readFileSync(path, "utf8"));
    expect(doc.v).toBe(1);
    expect(doc.rules.length).toBeGreaterThan(0);
    expect(doc.activeInProduction).toBe(true);
  });
});
