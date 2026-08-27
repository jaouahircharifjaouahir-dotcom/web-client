import { describe, expect, it } from "vitest";
import {
  AHREFS_BLOCKED_AI_SEARCH_BOTS,
  AHREFS_PREVIOUSLY_ALLOWED_TRAINING_BOTS,
  AI_TRAINING_USER_AGENTS,
  CONTENT_SIGNAL,
  aiSearchAllowRobotsBlock,
  aiTrainingRobotsBlock,
  contentSignalDirective,
} from "../../workers/ai-training-robots.js";
import { robotsTxt as workerRobotsTxt } from "../../workers/sitemaps.js";

/** Training bots Ahrefs listed as Blocked under Cloudflare Managed robots. */
const AHREFS_ALREADY_BLOCKED_TRAINING = [
  "Applebot-Extended",
  "ClaudeBot",
  "GPTBot",
  "Google-Extended",
  "Meta-ExternalAgent",
] as const;

/** Must stay crawlable for AI answer engines / classic search. */
const AI_SEARCH_RETRIEVAL_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Applebot",
  "Googlebot",
  "Amazonbot",
] as const;

function isDisallowedForUa(robots: string, ua: string): boolean {
  const blocks = robots.split(/(?=User-agent:)/i);
  for (const block of blocks) {
    if (!new RegExp(`^User-agent:\\s*${ua}\\s*$`, "im").test(block)) continue;
    if (/^Disallow:\s*\/\s*$/m.test(block)) return true;
  }
  return false;
}

function isAllowedForUa(robots: string, ua: string): boolean {
  const blocks = robots.split(/(?=User-agent:)/i);
  for (const block of blocks) {
    if (!new RegExp(`^User-agent:\\s*${ua}\\s*$`, "im").test(block)) continue;
    if (/^Allow:\s*\/\s*$/m.test(block) && !/^Disallow:\s*\/\s*$/m.test(block)) return true;
  }
  return false;
}

describe("AI training robots consistency", () => {
  it("disallows every Ahrefs training bot (previous allows + previous blocks)", () => {
    const body = aiTrainingRobotsBlock();
    for (const ua of [...AHREFS_PREVIOUSLY_ALLOWED_TRAINING_BOTS, ...AHREFS_ALREADY_BLOCKED_TRAINING]) {
      expect(isDisallowedForUa(body, ua), ua).toBe(true);
    }
  });

  it("does not Disallow AI search/retrieval user-agents in the training block", () => {
    const body = aiTrainingRobotsBlock();
    for (const ua of AI_SEARCH_RETRIEVAL_BOTS) {
      expect(isDisallowedForUa(body, ua), ua).toBe(false);
      expect(body).not.toMatch(new RegExp(`^User-agent:\\s*${ua}\\s*$`, "m"));
    }
  });

  it("explicitly Allows Amazonbot (Ahrefs indexable page blocked from AI search)", () => {
    const allow = aiSearchAllowRobotsBlock();
    for (const ua of AHREFS_BLOCKED_AI_SEARCH_BOTS) {
      expect(isAllowedForUa(allow, ua), ua).toBe(true);
      expect(isDisallowedForUa(allow, ua), ua).toBe(false);
    }
  });

  it("embeds training Disallow, Amazonbot Allow, and Content-Signal in worker robots", () => {
    const worker = workerRobotsTxt({ urlShards: 1, imageShards: 1 });
    for (const ua of AI_TRAINING_USER_AGENTS) {
      expect(isDisallowedForUa(worker, ua), ua).toBe(true);
    }
    expect(isAllowedForUa(worker, "Amazonbot")).toBe(true);
    expect(isDisallowedForUa(worker, "Amazonbot")).toBe(false);
    expect(worker).toContain(contentSignalDirective());
    expect(worker).toContain(CONTENT_SIGNAL);
    expect(worker).toContain("User-agent: *");
    expect(worker).toContain("Allow: /");
  });
});
