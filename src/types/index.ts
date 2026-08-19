export type YouTubeUrlType = "watch" | "shorts" | "embed" | "live" | "short-url" | "unknown";

export type ThumbnailTier = "best" | "high" | "standard" | "preview";

export type AppErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_HOST"
  | "INVALID_VIDEO_ID"
  | "THUMBNAIL_NOT_FOUND"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "IMAGE_VALIDATION_FAILED"
  | "DOWNLOAD_FAILED";

export interface ParsedYouTubeUrl {
  valid: boolean;
  videoId: string | null;
  type: YouTubeUrlType;
  host: string | null;
  normalizedUrl: string | null;
  originalInput: string;
  errorCode: AppErrorCode | null;
}

export interface ThumbnailCandidate {
  url: string;
  quality: string;
  expectedWidth: number | null;
  expectedHeight: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  valid: boolean;
  placeholder: boolean;
  score: number;
  tier: ThumbnailTier;
  strategy: string;
  failureReason: string | null;
}

export interface StrategyResult {
  videoId: string;
  candidates: ThumbnailCandidate[];
  strategy: string;
  confidence: number;
  errors: string[];
}

export interface ExtractionTimings {
  parseMs: number;
  discoveryMs: number;
  validationMs: number;
  totalMs: number;
}

export interface ExtractionMeta {
  platform: "youtube" | "vimeo";
  title: string | null;
  authorName: string | null;
}

export interface ThumbnailExtractionResult {
  videoId: string;
  normalizedUrl: string;
  type: YouTubeUrlType;
  thumbnails: ThumbnailCandidate[];
  bestThumbnail: ThumbnailCandidate | null;
  extractionMethod: string;
  extractionTimeMs: number;
  timings: ExtractionTimings;
  cached: boolean;
  failedCandidates: ThumbnailCandidate[];
  candidateUrls: string[];
  meta?: ExtractionMeta;
}

export interface HistoryEntry {
  videoId: string;
  normalizedUrl: string;
  timestamp: number;
  bestThumbnailUrl: string | null;
  bestWidth: number | null;
  bestHeight: number | null;
}

export interface AppError {
  code: AppErrorCode;
  message: string;
}
