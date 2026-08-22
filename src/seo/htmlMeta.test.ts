import { describe, expect, it } from "vitest";
import { resolvePageDescription, upsertHeadDescription } from "../../workers/html-meta.js";
import { descriptionForPath } from "../../workers/post-descriptions.js";

describe("article head descriptions", () => {
  it("injects a unique description after the title", () => {
    const html = "<html><head><title>Demo | 11tik</title></head><body></body></html>";
    const next = upsertHeadDescription(html, "Save a public YouTube thumbnail on iPhone without an app.");
    expect(next).toContain("<meta content='Save a public YouTube thumbnail on iPhone without an app.' name='description'/>");
    expect(next).not.toContain("Download YouTube thumbnails instantly");
  });

  it("maps the iPhone article path", () => {
    const desc = descriptionForPath("/2026/08/how-to-save-youtube-thumbnail-on-iphone.html");
    expect(desc.toLowerCase()).toContain("iphone");
  });

  it("reads itemprop when the path is unknown", () => {
    const html = `<p itemprop="description">Channel extract is for recent public uploads only, not private videos.</p>`;
    const desc = resolvePageDescription("/2026/08/unknown-post.html", html, "");
    expect(desc).toContain("Channel extract");
  });
});
