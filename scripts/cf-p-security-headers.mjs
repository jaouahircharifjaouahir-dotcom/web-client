/**
 * Phase 11A: Cloudflare Response Header Transform rules (global security headers).
 *
 * Usage:
 *   node scripts/cf-p-security-headers.mjs plan [--dry-run]
 *   node scripts/cf-p-security-headers.mjs status
 *   node scripts/cf-p-security-headers.mjs apply --confirm
 *
 * Requires CLOUDFLARE_API_TOKEN with Zone Transform Rules Edit for 11tik.com.
 * NEVER run apply without --confirm.
 *
 * Phase: http_response_headers_transform (does not consume Redirect Rule slots).
 * Rollback: node scripts/cf-p-security-headers.mjs apply --confirm --remove
 */
import {
  ZONE_NAME,
  cfFetch,
  getPhaseEntrypoint,
  getZoneId,
  mergeRulesByDescription,
  parseCliFlags,
  planRulesetMerge,
  printPlanSummary,
  buildPhaseEntrypointPutBody,
  assertValidPhaseEntrypointPutBody,
} from "./cf-api.mjs";
import {
  RULE_PREFIX_SECURITY,
  SECURITY_HEADERS_PHASE,
  buildSecurityHeaderRules,
} from "./security-headers.mjs";

const PHASE = SECURITY_HEADERS_PHASE;
const RULE_PREFIX = RULE_PREFIX_SECURITY;

async function readExistingRules(token) {
  if (!token) return { zoneId: "", rules: [], entry: null };
  const zoneId = await getZoneId(token);
  const entry = await getPhaseEntrypoint(token, zoneId, PHASE);
  return { zoneId, rules: entry?.rules ?? [], entry };
}

async function main() {
  const { action, confirm } = parseCliFlags(process.argv);
  const remove = process.argv.includes("--remove");
  const managed = remove ? [] : buildSecurityHeaderRules();

  console.log("phase", PHASE);
  console.log("zone", ZONE_NAME);
  console.log("rule_prefix", RULE_PREFIX);
  if (!remove) {
    console.log("rule_descriptions", managed.map((r) => r.description));
  }

  const token = process.env.CLOUDFLARE_API_TOKEN || "";
  let existing = [];
  let zoneId = "";
  let entry = null;

  if (token) {
    try {
      const read = await readExistingRules(token);
      zoneId = read.zoneId;
      existing = read.rules;
      entry = read.entry;
    } catch (err) {
      if (action === "plan" || action === "dry-run") {
        console.warn("could not read zone (plan continues with empty existing):", err.message || err);
      } else {
        throw err;
      }
    }
  }

  const plan = planRulesetMerge(existing, managed, RULE_PREFIX);
  printPlanSummary("security-headers", plan);

  if (action === "plan" || action === "dry-run") {
    if (!token) {
      console.log("\n(no CLOUDFLARE_API_TOKEN — plan assumes no owned rules on zone)");
    }
    console.log("\nplan only — no Cloudflare mutation");
    process.exit(0);
  }

  if (!token) {
    console.error("CLOUDFLARE_API_TOKEN missing (required for status/apply)");
    process.exit(1);
  }

  if (!zoneId) {
    const read = await readExistingRules(token);
    zoneId = read.zoneId;
    existing = read.rules;
    entry = read.entry;
  }

  const merged = mergeRulesByDescription(existing, managed, RULE_PREFIX);

  console.log("\nzone_id", zoneId);
  console.log("existing_rules", existing.length);

  if (action === "status") {
    const found = existing.filter((r) => String(r.description || "").startsWith(RULE_PREFIX));
    console.log("security_header_rules", found.length ? found.map((r) => r.description) : "missing");
    process.exit(found.length ? 0 : 1);
  }

  if (action !== "apply") {
    console.error("Usage: plan|status|apply --confirm [--remove]");
    process.exit(1);
  }

  if (!confirm) {
    console.error("Refusing apply without --confirm");
    process.exit(1);
  }

  const body = buildPhaseEntrypointPutBody({
    rules: merged,
    entry,
    defaultName: "Zone-level Response Headers Transform Ruleset",
  });
  assertValidPhaseEntrypointPutBody(body);

  await cfFetch(token, `/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`, "PUT", body);
  console.log("\napplied", remove ? "removed owned security header rules" : "security header rules");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
