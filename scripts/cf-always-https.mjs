/**
 * Status / enable Cloudflare "Always Use HTTPS".
 * Without it, http://www.11tik.com/sitemap.xml and https://www.11tik.com/sitemap.xml
 * both return 200 with the same locs — Ahrefs "Page in multiple sitemaps".
 *
 * Usage:
 *   node scripts/cf-always-https.mjs status
 *   node scripts/cf-always-https.mjs enable
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

const current = await cf(`/zones/${zoneId}/settings/always_use_https`);
const value = current.result?.value;
console.log("zone", zoneId);
console.log("always_use_https", value);

if (action === "status") {
  process.exit(0);
}

if (action !== "enable") {
  console.error("Usage: node scripts/cf-always-https.mjs status|enable");
  process.exit(1);
}

if (value === "on") {
  console.log("already enabled");
  process.exit(0);
}

const updated = await cf(`/zones/${zoneId}/settings/always_use_https`, "PATCH", {
  value: "on",
});
console.log("always_use_https", updated.result?.value);
console.log("done — http://www.11tik.com/sitemap.xml should 301 → https://…");
