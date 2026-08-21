import { shareUrlFor } from "../share/url";
import type { ThumbnailExtractionResult } from "../types";

const ENDPOINT = "https://www.11tik.com/web-client/sitemap-add";

/** Records a successful extract so the public sitemap can list the share URL. */
export function submitShareToSitemap(result: ThumbnailExtractionResult): void {
  if (!result.videoId || !result.bestThumbnail) return;
  const platform = result.meta?.platform === "vimeo" ? "vimeo" : "youtube";
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ platform, videoId: result.videoId, loc: shareUrlFor(result) }),
    keepalive: true,
  }).catch(() => {
    /* sitemap write is best-effort */
  });
}
