import type { ThumbnailExtractionResult } from "../types";

export function bulkResultsJson(results: ThumbnailExtractionResult[]): string {
  return JSON.stringify(
    results.map((item) => ({
      videoId: item.videoId,
      platform: item.meta?.platform ?? "youtube",
      title: item.meta?.title ?? "",
      watchUrl: item.normalizedUrl,
      best: item.bestThumbnail,
      thumbs: item.thumbnails.map((thumb) => ({ quality: thumb.quality, url: thumb.url, width: thumb.width, height: thumb.height })),
    })),
    null,
    2,
  );
}

export function downloadText(filename: string, body: string, type: string): void {
  const blob = new Blob([body], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
