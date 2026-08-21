import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const BLOGGER_SCOPE = "https://www.googleapis.com/auth/blogger";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const BLOGGER_API = "https://www.googleapis.com/blogger/v3";

export function isValidBlogId(value) {
  return typeof value === "string" && /^\d{5,24}$/.test(value.trim());
}

export function parseLabels(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function signState(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readState(token, secret) {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) throw new Error("Invalid OAuth state.");
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid OAuth state.");
  const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!data || typeof data !== "object") throw new Error("Invalid OAuth state.");
  return data;
}

export function newSessionId() {
  return randomBytes(32).toString("hex");
}

export function mapBloggerError(status, body) {
  const text = typeof body === "string" ? body : JSON.stringify(body || {});
  const lower = text.toLowerCase();
  if (status === 401 || lower.includes("invalid credentials") || lower.includes("unauthenticated")) {
    return { status: 401, error: "User not authorized. Connect Google Account again." };
  }
  if (status === 403 || lower.includes("insufficient") || lower.includes("forbidden")) {
    return { status: 403, error: "Insufficient permissions for this blog." };
  }
  if (status === 404 || lower.includes("not found")) {
    return { status: 400, error: "Invalid Blog ID, or this account cannot access that blog." };
  }
  return { status: status >= 400 ? status : 502, error: `Blogger API error (${status}).` };
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}
