import type { ThumbnailCandidate, ThumbnailTier } from "../types";

export interface QualityPreset {
  quality: string;
  expectedWidth: number;
  expectedHeight: number;
  tier: ThumbnailTier;
  filename: string;
}

export const QUALITY_PRESETS: QualityPreset[] = [
  { quality: "maxres-webp", expectedWidth: 1280, expectedHeight: 720, tier: "best", filename: "maxresdefault.webp" },
  { quality: "maxres", expectedWidth: 1280, expectedHeight: 720, tier: "best", filename: "maxresdefault.jpg" },
  { quality: "hq720", expectedWidth: 1280, expectedHeight: 720, tier: "best", filename: "hq720.jpg" },
  { quality: "sd", expectedWidth: 640, expectedHeight: 480, tier: "high", filename: "sddefault.jpg" },
  { quality: "hq", expectedWidth: 480, expectedHeight: 360, tier: "standard", filename: "hqdefault.jpg" },
  { quality: "mq", expectedWidth: 320, expectedHeight: 180, tier: "preview", filename: "mqdefault.jpg" },
  { quality: "default", expectedWidth: 120, expectedHeight: 90, tier: "preview", filename: "default.jpg" },
];

export function candidateUrl(videoId: string, filename: string): string {
  if (filename.endsWith(".webp")) {
    return `https://i.ytimg.com/vi_webp/${encodeURIComponent(videoId)}/${filename}`;
  }
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${filename}`;
}

export function presetCandidate(videoId: string, preset: QualityPreset, strategy: string): ThumbnailCandidate {
  return {
    url: candidateUrl(videoId, preset.filename),
    quality: preset.quality,
    expectedWidth: preset.expectedWidth,
    expectedHeight: preset.expectedHeight,
    width: null,
    height: null,
    mimeType: preset.filename.endsWith(".webp") ? "image/webp" : "image/jpeg",
    valid: false,
    placeholder: false,
    score: 0,
    tier: preset.tier,
    strategy,
    failureReason: null,
  };
}
