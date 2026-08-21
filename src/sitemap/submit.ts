import { shareUrlForIds } from "../share/url";
import type { ThumbnailExtractionResult } from "../types";

const ENDPOINT = "https://www.11tik.com/web-client/sitemap-add";
const sent = new Set<string>();

export function submitVideoToSitemap(platform: string, videoId: string): void {
  const p = platform === "vimeo" ? "vimeo" : "youtube";
  const id = String(videoId || "").trim();
  if (!id) return;
  const key = `${p}:${id}`;
  if (sent.has(key)) return;
  sent.add(key);
  const loc = shareUrlForIds(p, id);
  const qs = `${ENDPOINT}?platform=${encodeURIComponent(p)}&videoId=${encodeURIComponent(id)}`;
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ platform: p, videoId: id, loc }),
    keepalive: true,
    mode: "cors",
    cache: "no-store",
  }).catch(() => undefined);
  void fetch(qs, { method: "GET", keepalive: true, mode: "cors", cache: "no-store" }).catch(() => undefined);
}

export function submitShareToSitemap(result: ThumbnailExtractionResult): void {
  if (!result.videoId) return;
  const platform = result.meta?.platform === "vimeo" ? "vimeo" : "youtube";
  submitVideoToSitemap(platform, result.videoId);
}
