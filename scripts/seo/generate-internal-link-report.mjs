#!/usr/bin/env node
/**
 * Phase 17.1 — emit deterministic internal-link report (read-only audit artifact).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildContentInventory } from "../i18n/content-inventory.mjs";
import { generateInternalLinkReport, validateAllLinkPlans } from "../i18n/contextual-internal-links.mjs";

const ROOT = process.cwd();
const outDir = join(ROOT, "reports");
mkdirSync(outDir, { recursive: true });

const inventory = buildContentInventory();
const report = generateInternalLinkReport(inventory);
const planErrors = validateAllLinkPlans();

const payload = {
  generatedAt: new Date().toISOString(),
  phase: "17.1",
  rowCount: report.length,
  planValidationErrors: planErrors,
  rows: report,
};

const outPath = join(outDir, "internal-link-map.json");
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${report.length} rows to ${outPath}`);
if (planErrors.length) {
  console.error("Plan validation errors:", planErrors);
  process.exit(1);
}
