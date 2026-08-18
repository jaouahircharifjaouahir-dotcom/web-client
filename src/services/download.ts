import { config } from "../config";
import { createAppError } from "../types/errors";
import type { ThumbnailCandidate } from "../types";
import { zipSync } from "fflate";

function sanitizeId(videoId: string): string {
  return videoId.replace(/[^A-Za-z0-9_-]/g, "");
}

function extensionFor(mime: string | null, url: string): string {
  if (mime?.includes("webp") || url.endsWith(".webp")) return "webp";
  if (mime?.includes("png")) return "png";
  return "jpg";
}

export function thumbnailFilename(videoId: string, quality: string, mime: string | null, url: string): string {
  const safeQuality = quality.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "best";
  return `youtube-thumbnail-${sanitizeId(videoId)}-${safeQuality}.${extensionFor(mime, url)}`;
}

function allowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (config.allowedImageHosts as readonly string[]).includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function blobFromUrl(url: string, signal?: AbortSignal): Promise<Blob> {
  if (!allowedUrl(url)) throw createAppError("DOWNLOAD_FAILED");
  const response = await fetch(url, { signal, mode: "cors", credentials: "omit" });
  if (!response.ok) throw createAppError("DOWNLOAD_FAILED");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") && blob.size < 32) throw createAppError("DOWNLOAD_FAILED");
  return blob;
}

function triggerDownload(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1500);
}

export const downloadManager = {
  async download(videoId: string, candidate: ThumbnailCandidate, signal?: AbortSignal): Promise<void> {
    try {
      const blob = await blobFromUrl(candidate.url, signal);
      triggerDownload(blob, thumbnailFilename(videoId, candidate.quality, blob.type, candidate.url));
    } catch {
      throw createAppError("DOWNLOAD_FAILED");
    }
  },

  async downloadAll(videoId: string, candidates: ThumbnailCandidate[], signal?: AbortSignal): Promise<void> {
    const files: Record<string, Uint8Array> = {};
    for (const candidate of candidates) {
      if (signal?.aborted) break;
      try {
        const blob = await blobFromUrl(candidate.url, signal);
        files[`${sanitizeId(videoId)}/${thumbnailFilename(videoId, candidate.quality, blob.type, candidate.url)}`] =
          new Uint8Array(await blob.arrayBuffer());
      } catch {
        continue;
      }
    }
    if (!Object.keys(files).length) throw createAppError("DOWNLOAD_FAILED");
    const zipped = zipSync(files);
    triggerDownload(new Blob([zipped as BlobPart], { type: "application/zip" }), `youtube-thumbnails-${sanitizeId(videoId)}.zip`);
  },

  async downloadBulkZip(
    groups: Array<{ videoId: string; candidates: ThumbnailCandidate[] }>,
    signal?: AbortSignal,
  ): Promise<void> {
    const files: Record<string, Uint8Array> = {};
    for (const group of groups) {
      for (const candidate of group.candidates) {
        if (signal?.aborted) return;
        try {
          const blob = await blobFromUrl(candidate.url, signal);
          files[thumbnailFilename(group.videoId, candidate.quality, blob.type, candidate.url)] = new Uint8Array(
            await blob.arrayBuffer(),
          );
        } catch {
          continue;
        }
      }
    }
    if (!Object.keys(files).length) throw createAppError("DOWNLOAD_FAILED");
    const zipped = zipSync(files);
    triggerDownload(new Blob([zipped as BlobPart], { type: "application/zip" }), "youtube-thumbnails.zip");
  },
};

export function openFullImage(url: string): void {
  if (!allowedUrl(url)) return;
  window.open(url, "_blank", "noopener,noreferrer");
}
