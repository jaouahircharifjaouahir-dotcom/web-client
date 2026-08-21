/**
 * Create wildcard DNS and a www origin bypass so locale hosts work
 * without sending the English Blogger homepage through the Worker.
 */
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "f9da186fc6cbf157fd99d88fe700d0c4";

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
    const msg = data.errors?.map((item) => item.message).join("; ") || JSON.stringify(data).slice(0, 400);
    throw new Error(`${method} ${path} → ${msg}`);
  }
  return data;
}

const zones = await cf("/zones?name=11tik.com");
const zoneId = zones.result?.[0]?.id;
if (!zoneId) throw new Error("Zone 11tik.com not found");
console.log("zone", zoneId);

const records = await cf(`/zones/${zoneId}/dns_records?type=CNAME&per_page=100`);
const star = (records.result || []).find((row) => row.name === "*.11tik.com" || row.name === "*");
if (!star) {
  await cf(`/zones/${zoneId}/dns_records`, "POST", {
    type: "CNAME",
    name: "*",
    content: "11tik.com",
    proxied: true,
    ttl: 1,
    comment: "Locale hosts for 11tik extractor",
  });
  console.log("created wildcard CNAME *");
} else {
  console.log("wildcard DNS exists", star.content, "proxied", star.proxied);
  if (!star.proxied) {
    await cf(`/zones/${zoneId}/dns_records/${star.id}`, "PATCH", { proxied: true });
    console.log("set wildcard proxied true");
  }
}

const routes = await cf(`/zones/${zoneId}/workers/routes`);
const list = routes.result || [];
const hasWildcard = list.some((row) => row.pattern === "*.11tik.com/*");
console.log("routes", list.map((row) => `${row.pattern} -> ${row.script || "(origin)"}`).join(" | "));

const wwwCatch = list.find((row) => row.pattern === "www.11tik.com/*");
if (!wwwCatch) {
  try {
    await cf(`/zones/${zoneId}/workers/routes`, "POST", {
      pattern: "www.11tik.com/*",
    });
    console.log("added www.11tik.com/* origin bypass");
  } catch (error) {
    console.warn("www bypass skipped:", error instanceof Error ? error.message : error);
  }
} else {
  console.log("www catch-all exists", wwwCatch.script || "(origin)");
}

if (!hasWildcard) {
  try {
    await cf(`/zones/${zoneId}/workers/routes`, "POST", {
      pattern: "*.11tik.com/*",
      script: "11tik-edge",
    });
    console.log("added *.11tik.com/* -> 11tik-edge");
  } catch (error) {
    console.warn("wildcard route skipped:", error instanceof Error ? error.message : error);
  }
}

console.log("account", ACCOUNT);
console.log("locale DNS ready");
