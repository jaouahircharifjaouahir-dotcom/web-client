import { shareUrlFor } from "../share/url";
import { tagsForResult } from "../tags/fromExtract";
import type { ThumbnailExtractionResult } from "../types";

export function bulkResultsCsv(results: ThumbnailExtractionResult[]): string {
  const header = ["videoId", "platform", "title", "tags", "watchUrl", "shareUrl", "bestQuality", "bestWidth", "bestHeight", "bestImageUrl"];
  const rows = results.map((item) => {
    const cells = [
      item.videoId,
      item.meta?.platform ?? "youtube",
      item.meta?.title ?? "",
      tagsForResult(item).join(" "),
      item.normalizedUrl,
      shareUrlFor(item),
      item.bestThumbnail?.quality ?? "",
      String(item.bestThumbnail?.width ?? ""),
      String(item.bestThumbnail?.height ?? ""),
      item.bestThumbnail?.url ?? "",
    ];
    return cells.map(csvCell).join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
