/**
 * Phase 2: hard 404 for unknown www /p/* paths (prevents SPA soft-200).
 *
 * Usage:
 *   node scripts/cf-p-unknown-404.mjs plan [--dry-run]
 *   node scripts/cf-p-unknown-404.mjs status
 *   node scripts/cf-p-unknown-404.mjs apply --confirm
 *
 * Requires CLOUDFLARE_API_TOKEN with Zone WAF Write for 11tik.com.
 * NEVER run apply without --confirm.
 *
 * Rollback: node scripts/cf-p-unknown-404.mjs apply --confirm --remove
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
  RULE_PREFIX_404,
  UNKNOWN_404_PHASE,
  buildUnknown404Rule,
} from "./cf-p-edge-rules.mjs";

const PHASE = UNKNOWN_404_PHASE;
const RULE_PREFIX = RULE_PREFIX_404;

async function readExistingRules(token) {
  if (!token) return { zoneId: "", rules: [], entry: null };
  const zoneId = await getZoneId(token);
  const entry = await getPhaseEntrypoint(token, zoneId, PHASE);
  return { zoneId, rules: entry?.rules ?? [], entry };
}

async function main() {
  const { action, confirm } = parseCliFlags(process.argv);
  const remove = process.argv.includes("--remove");
  const managed = remove ? [] : [buildUnknown404Rule()];

  console.log("phase", PHASE);
  console.log("zone", ZONE_NAME);
  console.log("rule_prefix", RULE_PREFIX);
  if (!remove) {
    console.log("rule_description", managed[0].description);
    console.log("expression_preview", `${managed[0].expression.slice(0, 200)}…`);
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
  printPlanSummary("unknown-404", plan);

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
    const found = existing.find((r) => String(r.description || "").startsWith(RULE_PREFIX));
    console.log("unknown_404_rule", found ? "present" : "missing");
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
    defaultName: "Custom rules ruleset",
  });
  assertValidPhaseEntrypointPutBody(body);

  await cfFetch(token, `/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`, "PUT", body);
  console.log("applied — verify /p/random.html → 404 (not English SPA)");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
