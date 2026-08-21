import { shareUrlFor } from "../share/url";
import type { ThumbnailExtractionResult } from "../types";

const ENDPOINT = "https://www.11tik.com/web-client/sitemap-add";

export function submitShareToSitemap(result: ThumbnailExtractionResult): void {
  if (!result.videoId || !result.bestThumbnail) return;
  const platform = result.meta?.platform === "vimeo" ? "vimeo" : "youtube";
  const videoId = result.videoId;
  const qs = `${ENDPOINT}?platform=${encodeURIComponent(platform)}&videoId=${encodeURIComponent(videoId)}`;
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ platform, videoId, loc: shareUrlFor(result) }),
    keepalive: true,
  }).catch(() => undefined);
  void fetch(qs, { method: "GET", keepalive: true, cache: "no-store" }).catch(() => undefined);
  try {
    navigator.sendBeacon?.(qs);
  } catch {
    /* ignore */
  }
}
