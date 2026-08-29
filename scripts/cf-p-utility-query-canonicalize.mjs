/**
 * Phase 2: strip query strings from indexable EN /p/*.html utility URLs.
 *
 * /p/about.html?m=1 → 301 https://www.11tik.com/p/about.html (no query preserved)
 *
 * Usage:
 *   node scripts/cf-p-utility-query-canonicalize.mjs plan [--dry-run]
 *   node scripts/cf-p-utility-query-canonicalize.mjs status
 *   node scripts/cf-p-utility-query-canonicalize.mjs apply --confirm
 *
 * Requires CLOUDFLARE_API_TOKEN with Dynamic URL Redirects Write for 11tik.com.
 * NEVER run apply without --confirm.
 *
 * Rollback: node scripts/cf-p-utility-query-canonicalize.mjs apply --confirm --remove
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
  QUERY_PHASE,
  RULE_PREFIX_QUERY,
  buildQueryCanonicalizeRules,
} from "./cf-p-edge-rules.mjs";

const PHASE = QUERY_PHASE;
const RULE_PREFIX = RULE_PREFIX_QUERY;

async function readExistingRules(token) {
  if (!token) return { zoneId: "", rules: [], entry: null };
  const zoneId = await getZoneId(token);
  const entry = await getPhaseEntrypoint(token, zoneId, PHASE);
  return { zoneId, rules: entry?.rules ?? [], entry };
}

async function main() {
  const { action, confirm } = parseCliFlags(process.argv);
  const remove = process.argv.includes("--remove");
  const managed = remove ? [] : buildQueryCanonicalizeRules();

  console.log("phase", PHASE);
  console.log("zone", ZONE_NAME);
  console.log("rule_prefix", RULE_PREFIX);
  console.log("intended_rules", managed.length);

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
  printPlanSummary("query-canonicalize", plan);

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
    process.exit(0);
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
    defaultName: "Redirect rules ruleset",
  });
  assertValidPhaseEntrypointPutBody(body);

  await cfFetch(token, `/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`, "PUT", body);
  console.log("applied — verify /p/about.html?m=1 → 301 clean URL");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
