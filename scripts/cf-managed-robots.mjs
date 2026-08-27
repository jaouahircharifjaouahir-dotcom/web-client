/**
 * Status / disable Cloudflare "managed robots.txt" (AI training prepend).
 * That prepend Disallows Amazonbot, which Ahrefs flags as
 * "Indexable page blocked from AI search bots" on otherwise indexable pages.
 *
 * Usage:
 *   node scripts/cf-managed-robots.mjs status
 *   node scripts/cf-managed-robots.mjs disable
 *
 * Requires CLOUDFLARE_API_TOKEN with Zone Bot Management Edit for 11tik.com.
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

const current = await cf(`/zones/${zoneId}/bot_management`);
const managed = current.result?.is_robots_txt_managed;
console.log("zone", zoneId);
console.log("is_robots_txt_managed", managed);

if (action === "status") {
  process.exit(0);
}

if (action !== "disable") {
  console.error("Usage: node scripts/cf-managed-robots.mjs status|disable");
  process.exit(1);
}

if (managed === false) {
  console.log("already disabled");
  process.exit(0);
}

const updated = await cf(`/zones/${zoneId}/bot_management`, "PUT", {
  ...current.result,
  is_robots_txt_managed: false,
});
console.log("is_robots_txt_managed", updated.result?.is_robots_txt_managed);
console.log("done — re-fetch https://www.11tik.com/robots.txt (expect no Cloudflare Managed block)");
