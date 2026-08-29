/**
 * Shared Cloudflare API helpers for zone ruleset scripts.
 *
 * Environment:
 *   CLOUDFLARE_API_TOKEN — required for status/apply (Zone WAF + Dynamic Redirects perms)
 *   CLOUDFLARE_ZONE_NAME — optional, default 11tik.com
 */

export const ZONE_NAME = process.env.CLOUDFLARE_ZONE_NAME || "11tik.com";

export async function cfFetch(token, path, method = "GET", body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!data.success) {
    const msg =
      data.errors?.map((item) => item.message).join("; ") || JSON.stringify(data).slice(0, 400);
    throw new Error(`${method} ${path} → ${msg}`);
  }
  return data;
}

export async function getZoneId(token, zoneName = ZONE_NAME) {
  const zones = await cfFetch(token, `/zones?name=${encodeURIComponent(zoneName)}`);
  const zoneId = zones.result?.[0]?.id;
  if (!zoneId) throw new Error(`Zone ${zoneName} not found`);
  return zoneId;
}

export async function getPhaseEntrypoint(token, zoneId, phase) {
  try {
    const data = await cfFetch(token, `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`);
    return data.result ?? null;
  } catch (err) {
    if (String(err.message).includes("404")) return null;
    throw err;
  }
}

/**
 * Merge managed rules into an existing entrypoint ruleset by description prefix.
 * Preserves unrelated rules; replaces rules whose description starts with prefix.
 */
export function ownedRules(existingRules, prefix) {
  return (existingRules ?? []).filter((rule) => String(rule.description || "").startsWith(prefix));
}

export function mergeRulesByDescription(existingRules, managedRules, prefix) {
  const kept = (existingRules ?? []).filter((rule) => !String(rule.description || "").startsWith(prefix));
  return [...kept, ...managedRules];
}

/**
 * Diff owned rules for plan/status output (no remote mutation).
 * @returns {{ kept: object[], merged: object[], toCreate: object[], toUpdate: object[], toRemove: object[], existingOwned: object[] }}
 */
export function planRulesetMerge(existingRules, managedRules, prefix) {
  const existingOwned = ownedRules(existingRules, prefix);
  const kept = (existingRules ?? []).filter((rule) => !String(rule.description || "").startsWith(prefix));
  const merged = mergeRulesByDescription(existingRules, managedRules, prefix);

  const managedByDescription = new Map(managedRules.map((rule) => [rule.description, rule]));
  const existingByDescription = new Map(existingOwned.map((rule) => [rule.description, rule]));

  const toCreate = managedRules.filter((rule) => !existingByDescription.has(rule.description));
  const toUpdate = managedRules.filter((rule) => existingByDescription.has(rule.description));
  const toRemove = existingOwned.filter((rule) => !managedByDescription.has(rule.description));

  return { kept, merged, toCreate, toUpdate, toRemove, existingOwned };
}

export function printPlanSummary(label, plan) {
  console.log(`\n${label} plan`);
  console.log("current_owned", plan.existingOwned.map((r) => r.description));
  console.log("to_create", plan.toCreate.map((r) => r.description));
  console.log("to_update", plan.toUpdate.map((r) => r.description));
  console.log("to_remove", plan.toRemove.map((r) => r.description));
  console.log("unrelated_preserved", plan.kept.length);
  console.log("merged_total", plan.merged.length);
}

export function parseCliFlags(argv) {
  const args = argv.slice(2);
  const action = (args.find((a) => !a.startsWith("-")) || "plan").toLowerCase();
  const dryRun = args.includes("--dry-run") || action === "plan" || action === "dry-run";
  const confirm = args.includes("--confirm");
  return { action, dryRun, confirm };
}

/** Top-level fields rejected by PUT .../rulesets/phases/{phase}/entrypoint. */
export const INVALID_PHASE_ENTRYPOINT_PUT_FIELDS = Object.freeze(["kind", "phase"]);

/**
 * Build a valid PUT body for a zone phase entrypoint ruleset.
 * Schema (Cloudflare API): optional name, optional description, optional rules.
 * Phase is implied by the URL; kind/phase must not be sent on entrypoint PUT.
 * @see https://developers.cloudflare.com/api/resources/rulesets/subresources/phases/methods/update/
 */
export function buildPhaseEntrypointPutBody({ rules, entry, defaultName }) {
  if (!Array.isArray(rules)) throw new Error("rules array required for entrypoint PUT");
  const body = { rules };
  const name = entry?.name ?? defaultName;
  if (name) body.name = name;
  if (entry?.description) body.description = entry.description;
  return body;
}

export function assertValidPhaseEntrypointPutBody(body) {
  for (const key of INVALID_PHASE_ENTRYPOINT_PUT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      throw new Error(`invalid entrypoint PUT field: ${key}`);
    }
  }
  if (!Object.prototype.hasOwnProperty.call(body, "rules") || !Array.isArray(body.rules)) {
    throw new Error("entrypoint PUT requires rules array");
  }
}
