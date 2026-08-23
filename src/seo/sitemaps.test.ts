import { describe, expect, it } from "vitest";
import {
  allPublicSitemapUrls,
  chunkEntries,
  parseSitemapPath,
  rewriteLoc,
  robotsTxt,
  SITEMAP_PAGE_SIZE,
  sitemapIndexXml,
} from "../../workers/sitemaps.js";

describe("extract loc migration", () => {
  it("rewrites query share URLs to /thumb pages on each host", () => {
    expect(rewriteLoc("https://www.11tik.com/?v=dQw4w9WgXcQ")).toBe("https://www.11tik.com/thumb/dQw4w9WgXcQ");
    expect(rewriteLoc("https://www.11tik.com/?vimeo=1191500052", "https://fr.11tik.com")).toBe(
      "https://www.11tik.com/?vimeo=1191500052",
    );
  });
});

describe("sitemap sharding", () => {
  it("opens a new file when the current one is full", () => {
    const entries = Array.from({ length: SITEMAP_PAGE_SIZE + 3 }, (_, i) => ({ loc: `https://www.11tik.com/?v=${i}` }));
    const pages = chunkEntries(entries);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(SITEMAP_PAGE_SIZE);
    expect(pages[1]).toHaveLength(3);
  });

  it("builds an index that lists every child sitemap", () => {
    const xml = sitemapIndexXml(["https://www.11tik.com/sitemap-1.xml", "https://www.11tik.com/sitemap-2.xml"], "2026-08-22T00:00:00.000Z");
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("sitemap-1.xml");
    expect(xml).toContain("sitemap-2.xml");
  });
});

describe("robots.txt", () => {
  it("keeps a single sitemap.xml when the file is not full", () => {
    const body = robotsTxt({ urlShards: 1, imageShards: 1 });
    expect(body).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
    expect(body).not.toContain("sitemap-1.xml");
  });

  it("lists the index and every current child sitemap", () => {
    const body = robotsTxt({ urlShards: 2, imageShards: 1, host: "www.11tik.com" });
    expect(body).toContain("User-agent: Googlebot");
    expect(body).toContain("Allow: /");
    expect(body).not.toMatch(/^Disallow: \/$/m);
    expect(body).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
    expect(body).toContain("Sitemap: https://www.11tik.com/sitemap-2.xml");
    expect(allPublicSitemapUrls(2, 1).every((loc) => body.includes(`Sitemap: ${loc}`) || body.includes(loc))).toBe(true);
  });

  it("always advertises www sitemaps", () => {
    const body = robotsTxt({ urlShards: 1, imageShards: 1, host: "fr.11tik.com", origin: "https://fr.11tik.com" });
    expect(body).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
    expect(body).toContain("Sitemap: https://www.11tik.com/image-sitemap.xml");
    expect(body).toContain("Host: www.11tik.com");
    expect(body).not.toContain("Sitemap: https://fr.11tik.com/sitemap.xml");
  });

  it("parses sitemap paths used by the worker", () => {
    expect(parseSitemapPath("/sitemap.xml")).toEqual({ kind: "pages", role: "index" });
    expect(parseSitemapPath("/sitemap-3.xml")).toEqual({ kind: "pages", role: "page", page: 3 });
    expect(parseSitemapPath("/robots.txt")).toBeNull();
  });
});
