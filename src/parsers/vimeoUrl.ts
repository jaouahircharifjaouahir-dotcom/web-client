import { createAppError } from "../types/errors";
import type { ParsedYouTubeUrl } from "../types";

const VIMEO_ID_RE = /^\d{6,12}$/;
const VIMEO_IN_TEXT_RE = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:channels\/[^/\s]+\/|groups\/[^/\s]+\/videos\/|video\/)?(\d{6,12})/i;

const HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

function withProtocol(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function isLikelyVimeoUrl(raw: string): boolean {
  const text = raw.trim();
  if (VIMEO_ID_RE.test(text)) return true;
  return /vimeo\.com/i.test(text);
}

export function extractVimeoIds(raw: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const match of raw.matchAll(new RegExp(VIMEO_IN_TEXT_RE.source, "gi"))) {
    const id = match[1] ?? "";
    if (!VIMEO_ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  for (const line of raw.split(/[\n,;]+/)) {
    const trimmed = line.trim();
    if (!VIMEO_ID_RE.test(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ids.push(trimmed);
  }
  return ids;
}

export function normalizeVimeoUrl(raw: string): ParsedYouTubeUrl {
  const originalInput = raw.trim();
  if (!originalInput) {
    return {
      valid: false,
      videoId: null,
      type: "unknown",
      host: null,
      normalizedUrl: null,
      originalInput,
      errorCode: "INVALID_URL",
    };
  }

  if (VIMEO_ID_RE.test(originalInput)) {
    return {
      valid: true,
      videoId: originalInput,
      type: "watch",
      host: "vimeo.com",
      normalizedUrl: `https://vimeo.com/${originalInput}`,
      originalInput,
      errorCode: null,
    };
  }

  try {
    const url = new URL(withProtocol(originalInput));
    const host = url.hostname.toLowerCase();
    if (!HOSTS.has(host)) {
      return {
        valid: false,
        videoId: null,
        type: "unknown",
        host,
        normalizedUrl: null,
        originalInput,
        errorCode: "UNSUPPORTED_HOST",
      };
    }

    let id = "";
    if (host === "player.vimeo.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      id = parts[0] === "video" ? (parts[1] ?? "") : (parts[0] ?? "");
    } else {
      const match = url.href.match(VIMEO_IN_TEXT_RE);
      id = match?.[1] ?? "";
    }

    if (!VIMEO_ID_RE.test(id)) {
      return {
        valid: false,
        videoId: null,
        type: "unknown",
        host,
        normalizedUrl: null,
        originalInput,
        errorCode: "INVALID_VIDEO_ID",
      };
    }

    return {
      valid: true,
      videoId: id,
      type: "watch",
      host,
      normalizedUrl: `https://vimeo.com/${id}`,
      originalInput,
      errorCode: null,
    };
  } catch {
    return {
      valid: false,
      videoId: null,
      type: "unknown",
      host: null,
      normalizedUrl: null,
      originalInput,
      errorCode: "INVALID_URL",
    };
  }
}

export function parseVimeoMany(raw: string): ParsedYouTubeUrl[] {
  return extractVimeoIds(raw).map((videoId) => ({
    valid: true,
    videoId,
    type: "watch" as const,
    host: "vimeo.com",
    normalizedUrl: `https://vimeo.com/${videoId}`,
    originalInput: videoId,
    errorCode: null,
  }));
}

export function assertVimeo(parsed: ParsedYouTubeUrl): void {
  if (!parsed.valid) throw createAppError(parsed.errorCode ?? "INVALID_URL");
}
