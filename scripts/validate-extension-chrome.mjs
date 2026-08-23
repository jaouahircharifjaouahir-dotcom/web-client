/**
 * Load unpacked extension in Chrome, open YouTube, open popup page, assert DOM.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EXT = "C:\\Users\\ADMIN\\Desktop\\seo\\dist-extension\\chrome";
const PROFILE = mkdtempSync(join(tmpdir(), "11tik-ext-chrome-"));
const PORT = 9229;

function chromeArgs() {
  return [
    `--user-data-dir=${PROFILE}`,
    `--remote-debugging-port=${PORT}`,
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-background-networking",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  ];
}

async function cdp(method, params = {}, sessionId) {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === "page" && t.url.includes("youtube.com")) || list.find((t) => t.type === "page");
  if (!page) throw new Error("no page target");
  const wsUrl = page.webSocketDebuggerUrl;
  // Prefer HTTP-less: use /json/version + websocket via undici? Node 23 has no built-in WS.
  // Fall back to Runtime via chrome DevTools HTTP is limited. Use fetch to /json/new for extension page.
  return { page, list };
}

const child = spawn(CHROME, chromeArgs(), { detached: true, stdio: "ignore" });
child.unref();

let ready = false;
for (let i = 0; i < 40; i++) {
  try {
    const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    if (ver.webSocketDebuggerUrl) {
      ready = true;
      break;
    }
  } catch {
    /* wait */
  }
  await sleep(500);
}

if (!ready) {
  console.log(JSON.stringify({ error: "chrome_debug_port_not_ready", profile: PROFILE }));
  process.exit(1);
}

await sleep(4000);
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const pages = targets.filter((t) => t.type === "page");
const youtube = pages.find((t) => /youtube\.com\/watch/.test(t.url));
const extensions = targets.filter((t) => String(t.url || "").startsWith("chrome-extension://"));

// Discover extension id from Preferences or Preferences path
let extensionId = null;
try {
  const prefsPath = join(PROFILE, "Default", "Preferences");
  if (existsSync(prefsPath)) {
    const prefs = JSON.parse(readFileSync(prefsPath, "utf8"));
    const settings = prefs?.extensions?.settings || {};
    for (const [id, meta] of Object.entries(settings)) {
      if (meta?.path && String(meta.path).replace(/\\/g, "/").includes("dist-extension/chrome")) {
        extensionId = id;
        break;
      }
      if (meta?.manifest?.name?.includes("11tik")) {
        extensionId = id;
        break;
      }
    }
  }
} catch (err) {
  /* ignore */
}

// Also try Secure Preferences / Local Extension Settings dirs
if (!extensionId) {
  try {
    const localState = join(PROFILE, "Default", "Extensions");
    // Chrome with --load-extension often uses a generated id visible in chrome://extensions via CDP targets
  } catch {
    /* ignore */
  }
}

for (const t of targets) {
  const m = String(t.url || "").match(/^chrome-extension:\/\/([a-p]{32})\//);
  if (m) extensionId = m[1];
}

let popupResult = null;
if (extensionId) {
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(popupUrl)}`);
  await sleep(5000);
  const after = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const popup = after.find((t) => String(t.url || "").includes(`/popup.html`));
  popupResult = popup ? { url: popup.url, title: popup.title, id: popup.id } : null;
}

const report = {
  chromeStarted: true,
  profile: PROFILE,
  youtubeTab: youtube ? { url: youtube.url, title: youtube.title } : null,
  extensionId,
  extensionTargets: extensions.map((t) => ({ url: t.url, title: t.title, type: t.type })),
  popupResult,
  allTargetCount: targets.length,
};

writeFileSync(join(PROFILE, "chrome-ext-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

// Keep Chrome running for a moment so popup can finish, then kill
await sleep(2000);
try {
  process.kill(child.pid);
} catch {
  /* ignore */
}
