import { config } from "../config";
import type { ThumbnailCandidate } from "../types";

function isPlaceholder(width: number, height: number, expectedWidth: number | null): boolean {
  if (width <= 0 || height <= 0) return true;
  if (expectedWidth && expectedWidth >= 480 && width <= 120 && height <= 90) return true;
  return false;
}

export async function validateThumbnail(
  candidate: ThumbnailCandidate,
  signal?: AbortSignal,
): Promise<ThumbnailCandidate> {
  if (signal?.aborted) {
    return { ...candidate, valid: false, failureReason: "TIMEOUT" };
  }

  return await new Promise((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = (next: ThumbnailCandidate) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(next);
    };

    const onAbort = () => {
      image.src = "";
      finish({ ...candidate, valid: false, failureReason: "TIMEOUT" });
    };

    const timer = window.setTimeout(() => {
      image.src = "";
      finish({ ...candidate, valid: false, failureReason: "TIMEOUT" });
    }, config.requestTimeoutMs);

    signal?.addEventListener("abort", onAbort, { once: true });

    image.decoding = "async";
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const placeholder = isPlaceholder(width, height, candidate.expectedWidth);
      finish({
        ...candidate,
        width,
        height,
        valid: !placeholder,
        placeholder,
        failureReason: placeholder ? "IMAGE_VALIDATION_FAILED" : null,
      });
    };
    image.onerror = () => {
      finish({ ...candidate, valid: false, failureReason: "NETWORK_ERROR" });
    };
    image.src = candidate.url;
  });
}

export function isVisuallyDuplicate(a: ThumbnailCandidate, b: ThumbnailCandidate): boolean {
  if (!a.valid || !b.valid) return false;
  if (a.url === b.url) return true;
  return a.width === b.width && a.height === b.height && a.quality.replace("-webp", "") === b.quality.replace("-webp", "");
}
