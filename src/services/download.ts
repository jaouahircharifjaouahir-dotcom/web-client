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

function jpegWithComment(bytes: Uint8Array, comment: string): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const text = new TextEncoder().encode(comment.slice(0, 180));
  const com = new Uint8Array(4 + text.length);
  com[0] = 0xff;
  com[1] = 0xfe;
  const len = text.length + 2;
  com[2] = (len >> 8) & 0xff;
  com[3] = len & 0xff;
  com.set(text, 4);
  const out = new Uint8Array(2 + com.length + (bytes.length - 2));
  out.set(bytes.subarray(0, 2), 0);
  out.set(com, 2);
  out.set(bytes.subarray(2), 2 + com.length);
  return out;
}

async function seoBlob(blob: Blob, videoId: string, quality: string): Promise<Blob> {
  if (!blob.type.includes("jpeg") && !blob.type.includes("jpg")) return blob;
  const stamped = jpegWithComment(new Uint8Array(await blob.arrayBuffer()), `11tik ${videoId} ${quality} youtube thumbnail`);
  return new Blob([stamped as BlobPart], { type: blob.type || "image/jpeg" });
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
      const blob = await seoBlob(await blobFromUrl(candidate.url, signal), videoId, candidate.quality);
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
        const blob = await seoBlob(await blobFromUrl(candidate.url, signal), videoId, candidate.quality);
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
          const blob = await seoBlob(await blobFromUrl(candidate.url, signal), group.videoId, candidate.quality);
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
