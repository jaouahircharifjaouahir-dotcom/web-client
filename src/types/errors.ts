import type { AppError, AppErrorCode } from "../types";
import { t, type UiKey } from "../i18n/ui";

export function createAppError(code: AppErrorCode): AppError {
  return { code, message: userMessage(code) };
}

export function userMessage(code: AppErrorCode): string {
  return t(code as UiKey);
}
