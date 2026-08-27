/**
 * Status / disable Cloudflare Email Address Obfuscation (Scrape Shield).
 * Obfuscation rewrites mailto → /cdn-cgi/l/email-protection (often 404),
 * which Ahrefs flags as "page has links to broken pages".
 *
 * Usage:
 *   node scripts/cf-email-obfuscation.mjs status
 *   node scripts/cf-email-obfuscation.mjs disable
 *
 * Requires CLOUDFLARE_API_TOKEN with Zone Settings Edit for 11tik.com.
 */
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const ZONE_NAME = process.env.CLOUDFLARE_ZONE_NAME || "11tik.com";
const action = (process.argv[2] || "status").toLowerCase();

if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN missing");
  process.exit(1);
}

async function cf(path, method = "GET", body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
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

const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`);
const zoneId = zones.result?.[0]?.id;
if (!zoneId) throw new Error(`Zone ${ZONE_NAME} not found`);

const current = await cf(`/zones/${zoneId}/settings/email_obfuscation`);
const value = current.result?.value;
console.log("zone", zoneId);
console.log("email_obfuscation", value);

if (action === "status") {
  process.exit(0);
}

if (action !== "disable") {
  console.error("Usage: node scripts/cf-email-obfuscation.mjs status|disable");
  process.exit(1);
}

if (value === "off") {
  console.log("already disabled");
  process.exit(0);
}

const updated = await cf(`/zones/${zoneId}/settings/email_obfuscation`, "PATCH", {
  value: "off",
});
console.log("email_obfuscation", updated.result?.value);
console.log("done — re-fetch /p/about.html (expect mailto, no /cdn-cgi/l/email-protection)");
