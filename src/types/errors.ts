import type { AppError, AppErrorCode } from "../types";

const USER_MESSAGES: Record<AppErrorCode, string> = {
  INVALID_URL: "Paste a public YouTube or Vimeo URL (TikTok/Instagram thumbnails are not supported yet).",
  UNSUPPORTED_HOST: "Only YouTube and Vimeo public URLs are supported right now.",
  INVALID_VIDEO_ID: "Could not find a valid video ID in that link.",
  THUMBNAIL_NOT_FOUND: "No public thumbnail was found for this video.",
  NETWORK_ERROR: "A network error stopped thumbnail discovery. Try again.",
  TIMEOUT: "Thumbnail discovery timed out. Try again.",
  IMAGE_VALIDATION_FAILED: "The thumbnail could not be verified as a valid image.",
  DOWNLOAD_FAILED: "The file could not be downloaded. Try opening the image instead.",
};

export function createAppError(code: AppErrorCode): AppError {
  return { code, message: USER_MESSAGES[code] };
}

export function userMessage(code: AppErrorCode): string {
  return USER_MESSAGES[code];
}
