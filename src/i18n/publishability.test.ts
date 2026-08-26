import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  findPublishabilityEntry,
  loadPublishability,
  normalizeContentPath,
  PUBLISHABILITY_PATH,
  PUBLISHABILITY_URL,
  resolveLocaleDestination,
  resolveLocalizedHref,
  setPublishabilityCache,
  subscribePublishability,
  type PublishabilityDoc,
} from "./publishability";
import { legalHrefs } from "./pages";
import { guidePosts } from "./ui";

const DOC: PublishabilityDoc = {
  v: 1,
  contents: {
    "youtube-thumbnail-url": {
      path: "/2026/08/youtube-thumbnail-url.html",
      en: "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
      locales: {
        ar: "https://ar.11tik.com/l/ar/2026/08/youtube-thumbnail-url.html",
        fr: "https://fr.11tik.com/l/fr/2026/08/youtube-thumbnail-url.html",
        es: "https://es.11tik.com/l/es/2026/08/youtube-thumbnail-url.html",
      },
    },
    about: {
      path: "/p/about.html",
      en: "https://www.11tik.com/p/about.html",
      locales: {
        ar: "https://ar.11tik.com/l/ar/p/about.html",
        fr: "https://fr.11tik.com/l/fr/p/about.html",
        es: "https://es.11tik.com/l/es/p/about.html",
      },
    },
    "english-only-guide": {
      path: "/2026/08/english-only-guide.html",
      en: "https://www.11tik.com/2026/08/english-only-guide.html",
      locales: {},
    },
  },
};

function home(code: string) {
  return code === "en" ? "https://www.11tik.com/" : `https://${code}.11tik.com/l/${code}/`;
}

describe("publishability same-origin manifest URL", () => {
  beforeEach(() => {
    setPublishabilityCache(null);
  });

  it("uses a same-origin relative path (not hardcoded www)", () => {
    expect(PUBLISHABILITY_PATH).toBe("/web-client/i18n/publishability.json");
    expect(PUBLISHABILITY_URL).toBe(PUBLISHABILITY_PATH);
    expect(PUBLISHABILITY_PATH.startsWith("/")).toBe(true);
    expect(PUBLISHABILITY_PATH).not.toMatch(/^https?:\/\//);
    expect(PUBLISHABILITY_PATH).not.toContain("www.11tik.com");
  });

  it("loadPublishability fetches the same-origin path (EN + locale hosts)", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe(PUBLISHABILITY_PATH);
      return {
        ok: true,
        json: async () => DOC,
      } as Response;
    });
    const doc = await loadPublishability(fetchImpl as unknown as typeof fetch);
    expect(doc?.contents["youtube-thumbnail-url"]?.locales.ar).toBe(
      "https://ar.11tik.com/l/ar/2026/08/youtube-thumbnail-url.html",
    );
    expect(fetchImpl).toHaveBeenCalledWith(PUBLISHABILITY_PATH, {
      credentials: "omit",
      cache: "no-cache",
    });
  });

  it("loadPublishability returns null on fetch failure (missing translation fallback path)", async () => {
    setPublishabilityCache(null);
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(loadPublishability(fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });
});

describe("publishability path normalization", () => {
  it("normalizes locale-prefixed and extensionless paths", () => {
    expect(normalizeContentPath("/l/ar/2026/08/youtube-thumbnail-url.html")).toBe(
      "/2026/08/youtube-thumbnail-url.html",
    );
    expect(normalizeContentPath("/l/ar/2026/08/youtube-thumbnail-url")).toBe(
      "/2026/08/youtube-thumbnail-url.html",
    );
    expect(normalizeContentPath("/l/fr/p/about")).toBe("/p/about.html");
    expect(normalizeContentPath("/2026/08/youtube-thumbnail-url.html")).toBe(
      "/2026/08/youtube-thumbnail-url.html",
    );
  });
});

describe("path-aware locale switching", () => {
  it("maps English article → Arabic localized URL", () => {
    const dest = resolveLocaleDestination(
      "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
      "ar",
      DOC,
      home,
    );
    expect(dest).toBe("https://ar.11tik.com/l/ar/2026/08/youtube-thumbnail-url.html");
  });

  it("maps English article → French localized URL", () => {
    const dest = resolveLocaleDestination(
      "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
      "fr",
      DOC,
      home,
    );
    expect(dest).toBe("https://fr.11tik.com/l/fr/2026/08/youtube-thumbnail-url.html");
  });

  it("maps English utility → Arabic utility URL", () => {
    const dest = resolveLocaleDestination("https://www.11tik.com/p/about.html", "ar", DOC, home);
    expect(dest).toBe("https://ar.11tik.com/l/ar/p/about.html");
  });

  it("maps Arabic utility → French utility URL", () => {
    const dest = resolveLocaleDestination("https://ar.11tik.com/l/ar/p/about.html", "fr", DOC, home);
    expect(dest).toBe("https://fr.11tik.com/l/fr/p/about.html");
  });

  it("maps Arabic article → English canonical on explicit English selection", () => {
    const dest = resolveLocaleDestination(
      "https://ar.11tik.com/l/ar/2026/08/youtube-thumbnail-url.html",
      "en",
      DOC,
      home,
    );
    expect(dest).toBe("https://www.11tik.com/2026/08/youtube-thumbnail-url.html");
  });

  it("falls back to English when target locale is not ready", () => {
    const dest = resolveLocaleDestination(
      "https://www.11tik.com/2026/08/english-only-guide.html",
      "ar",
      DOC,
      home,
    );
    expect(dest).toBe("https://www.11tik.com/2026/08/english-only-guide.html");
  });

  it("falls back to locale homepage for unknown/non-localizable pages", () => {
    const dest = resolveLocaleDestination("https://www.11tik.com/thumb/yt/abc123", "ar", DOC, home);
    expect(dest).toBe("https://ar.11tik.com/l/ar/");
  });

  it("preserves query and hash and does not loop on /l/ pages", () => {
    const dest = resolveLocaleDestination(
      "https://www.11tik.com/2026/08/youtube-thumbnail-url.html?ref=nav#faq",
      "es",
      DOC,
      home,
    );
    expect(dest).toBe("https://es.11tik.com/l/es/2026/08/youtube-thumbnail-url.html?ref=nav#faq");

    const back = resolveLocaleDestination(
      "https://es.11tik.com/l/es/2026/08/youtube-thumbnail-url?ref=nav#faq",
      "es",
      DOC,
      home,
    );
    expect(back).toBe("https://es.11tik.com/l/es/2026/08/youtube-thumbnail-url.html?ref=nav#faq");
  });

  it("drops lang query param on product hosts", () => {
    const dest = resolveLocaleDestination(
      "https://www.11tik.com/2026/08/youtube-thumbnail-url.html?lang=fr&x=1",
      "ar",
      DOC,
      home,
    );
    expect(dest).toBe("https://ar.11tik.com/l/ar/2026/08/youtube-thumbnail-url.html?x=1");
  });
});

describe("localized guide links", () => {
  beforeEach(() => setPublishabilityCache(null));

  it("uses ready Arabic article URL for locale homepage guides", () => {
    const href = resolveLocalizedHref(
      "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
      "ar",
      DOC,
    );
    expect(href).toBe("https://ar.11tik.com/l/ar/2026/08/youtube-thumbnail-url.html");
  });

  it("uses English fallback when locale is not ready", () => {
    const href = resolveLocalizedHref(
      "https://www.11tik.com/2026/08/english-only-guide.html",
      "ar",
      DOC,
    );
    expect(href).toBe("https://www.11tik.com/2026/08/english-only-guide.html");
  });

  it("never invents a broken localized URL without a manifest entry", () => {
    const href = resolveLocalizedHref("https://www.11tik.com/2026/08/missing-post.html", "ar", DOC);
    expect(href).toBe("https://www.11tik.com/2026/08/missing-post.html");
    expect(href).not.toContain("/l/ar/");
  });

  it("guidePosts rewrites hrefs once publishability doc is supplied", () => {
    setPublishabilityCache(null);
    const before = guidePosts({ locale: "ar", doc: null });
    expect(before.find((p) => p.href.includes("youtube-thumbnail-url"))?.href).toBe(
      "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
    );

    const after = guidePosts({ locale: "ar", doc: DOC });
    expect(after.find((p) => p.href.includes("youtube-thumbnail-url"))?.href).toBe(
      "https://ar.11tik.com/l/ar/2026/08/youtube-thumbnail-url.html",
    );

    const englishHome = guidePosts({ locale: "en", doc: DOC });
    expect(englishHome.find((p) => p.href.includes("youtube-thumbnail-url"))?.href).toBe(
      "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
    );
  });

  it("notifies subscribers when publishability cache is set", () => {
    let seen: PublishabilityDoc | null | undefined;
    const unsub = subscribePublishability((doc) => {
      seen = doc;
    });
    setPublishabilityCache(DOC);
    expect(seen).toBe(DOC);
    unsub();
  });
});

describe("publishability lookup", () => {
  it("finds entries by English or locale path", () => {
    expect(findPublishabilityEntry(DOC, "/2026/08/youtube-thumbnail-url.html")?.path).toBe(
      "/2026/08/youtube-thumbnail-url.html",
    );
    expect(findPublishabilityEntry(DOC, "/l/ar/p/about.html")?.path).toBe("/p/about.html");
  });
});

describe("legalHrefs localized utilities", () => {
  it("keeps English absolute utility URLs", () => {
    expect(legalHrefs("en").about).toBe("https://www.11tik.com/p/about.html");
    expect(legalHrefs("en").terms).toBe("https://www.11tik.com/p/terms-of-use.html");
  });

  it("uses /l/{lang}/p/… for Arabic, French, Spanish", () => {
    expect(legalHrefs("ar").about).toBe("https://ar.11tik.com/l/ar/p/about.html");
    expect(legalHrefs("fr").about).toBe("https://fr.11tik.com/l/fr/p/about.html");
    expect(legalHrefs("es").contact).toBe("https://es.11tik.com/l/es/p/contact.html");
    expect(legalHrefs("fr").privacy).toBe("https://fr.11tik.com/l/fr/p/privacy.html");
    expect(legalHrefs("ar").embed).toBe("https://ar.11tik.com/l/ar/p/embed.html");
    expect(legalHrefs("ar").keywords).toBe("https://ar.11tik.com/l/ar/p/keyword-tools.html");
  });
});
