/**
 * Reserved / special routes that must never be served as arbitrary clean content slugs.
 * Shared by clean-url-resolver (Phase 52.1) and future migration routing.
 */
import { ISO6391_CODES } from "./iso6391.js";

/** Canonical clean utility paths on www (/about, /privacy, /terms, /contact, /embed). */
export const LEGAL_SHORTCUT_PATHS = Object.freeze([
  "/about",
  "/privacy",
  "/contact",
  "/terms",
  "/embed",
]);

const LEGAL_SHORTCUT_SET = new Set(LEGAL_SHORTCUT_PATHS);

const SYSTEM_EXACT_PATHS = new Set([
  "/copyright",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt",
  "/search",
]);

const SYSTEM_PREFIXES = ["/web-client/", "/feeds/", "/hold-queue"];

export function normalizePathname(pathname) {
  const raw = String(pathname || "");
  if (raw.includes("..") || /%2e%2e/i.test(raw)) return null;
  let path = raw.replace(/\/+$/, "") || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

export function isThumbShareSpaPath(pathname) {
  const path = normalizePathname(pathname);
  if (!path) return false;
  return /^\/thumb\/[^/]+$/i.test(path);
}

export function isLocaleHomePath(pathname) {
  const path = normalizePathname(pathname);
  if (!path) return false;
  const match = /^\/l\/([a-z]{2})$/i.exec(path);
  if (!match) return false;
  return ISO6391_CODES.has(match[1].toLowerCase());
}

export function isLegacyContentPath(pathname) {
  const path = normalizePathname(pathname);
  if (!path) return false;
  return path.startsWith("/2026/") || path.startsWith("/p/");
}

export function isLegalShortcutPath(pathname) {
  const path = normalizePathname(pathname);
  if (!path) return false;
  return LEGAL_SHORTCUT_SET.has(path);
}

/**
 * True when the path is a known special/system route (not a candidate clean content slug).
 * Legal shortcuts return `legal-shortcut` — they overlap content slugs but keep current routing priority.
 */
export function classifyReservedRoute(pathname) {
  const path = normalizePathname(pathname);
  if (!path) return { reserved: true, kind: "invalid-path" };

  if (path === "/") return { reserved: true, kind: "homepage" };
  if (isLocaleHomePath(path)) return { reserved: true, kind: "locale-home" };
  if (isThumbShareSpaPath(path)) return { reserved: true, kind: "thumb" };
  if (isLegacyContentPath(path)) return { reserved: true, kind: "legacy-content" };
  if (isLegalShortcutPath(path)) return { reserved: true, kind: "legal-shortcut" };
  if (SYSTEM_EXACT_PATHS.has(path)) return { reserved: true, kind: "system" };
  if (SYSTEM_PREFIXES.some((prefix) => path.startsWith(prefix))) return { reserved: true, kind: "system" };
  if (path.startsWith("/l/") && /^\/l\/[a-z]{2}\/2026\//i.test(path)) {
    return { reserved: true, kind: "legacy-localized-content" };
  }
  if (path.startsWith("/l/") && /^\/l\/[a-z]{2}\/p\//i.test(path)) {
    return { reserved: true, kind: "legacy-localized-content" };
  }

  return { reserved: false, kind: null };
}
