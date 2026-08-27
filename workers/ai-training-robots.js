/**
 * AI crawler policy for robots.txt.
 *
 * - Block ALL known AI *training* bots consistently (Ahrefs "Inconsistent AI training bots").
 * - Keep AI *search* bots allowed on indexable pages (Ahrefs "Indexable page blocked from …").
 * - Content-Signal: search=yes, ai-train=no (same intent as Cloudflare Managed, without Amazonbot Disallow).
 *
 * Cloudflare Managed robots.txt also Disallows Amazonbot. That must be turned off
 * (dashboard or scripts/cf-managed-robots.mjs) or Ahrefs will keep flagging Amazonbot
 * as a blocked AI search bot on indexable pages.
 */
export const AI_TRAINING_USER_AGENTS = Object.freeze([
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ClaudeBot",
  "DeepseekBot",
  "GPTBot",
  "Google-Extended",
  "Meta-ExternalAgent",
  "anthropic-ai",
  "cohere-ai",
  "meta-externalagent",
  "xAI-Bot",
]);

/** Ahrefs-flagged training bots that were still Allowed under Cloudflare Managed-only rules. */
export const AHREFS_PREVIOUSLY_ALLOWED_TRAINING_BOTS = Object.freeze([
  "DeepseekBot",
  "anthropic-ai",
  "xAI-Bot",
]);

/** Ahrefs "Blocked AI search bots" on indexable pages in the 27-aug-2026 export. */
export const AHREFS_BLOCKED_AI_SEARCH_BOTS = Object.freeze(["Amazonbot"]);

export const CONTENT_SIGNAL = "search=yes,ai-train=no,use=reference";

export function aiTrainingRobotsBlock() {
  const lines = [
    "# AI training crawlers — block all consistently (ai-train=no).",
    "# AI search/retrieval bots remain allowed (see Amazonbot Allow + User-agent: *).",
  ];
  for (const ua of AI_TRAINING_USER_AGENTS) {
    lines.push(`User-agent: ${ua}`, "Disallow: /", "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

/** Explicit Allow so Amazonbot is not treated as blocked when CF Managed is off. */
export function aiSearchAllowRobotsBlock() {
  const lines = [
    "# AI search crawlers — allow on indexable pages (citations / AI answers).",
    "# Do not Disallow Amazonbot (Cloudflare Managed used to; that caused Ahrefs File 9).",
  ];
  for (const ua of AHREFS_BLOCKED_AI_SEARCH_BOTS) {
    lines.push(`User-agent: ${ua}`, "Allow: /", "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function contentSignalDirective() {
  return `Content-Signal: ${CONTENT_SIGNAL}`;
}
