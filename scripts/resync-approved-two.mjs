/**
 * Re-sync the two newly published posts after live slug correction.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BLOGGER_API, TOKEN_URL, isValidBlogId } from "./blogger-studio-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(join(root, ".env"));

const SESSION_FILE = join(root, "secrets", "blogger-studio-sessions.json");
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const BLOG_ID = String(process.env.BLOGGER_BLOG_ID || "").trim();

const UPDATES = [
  {
    title: "Why a YouTube Thumbnail Won’t Appear: Private, Age-Restricted, or Processing Videos",
    file: "docs/blogger-pages/blog/youtube-thumbnail-not-appearing.html",
    urlEndsWith: "/2026/08/youtube-thumbnail-not-appearing-private.html",
    labels: ["guide", "youtube", "troubleshooting"],
  },
  {
    title: "How 11tik Share Links Work: /thumb/{VIDEO_ID} vs YouTube Watch URLs",
    file: "docs/blogger-pages/blog/11tik-share-links-thumb-vs-watch.html",
    urlEndsWith: "/2026/08/11tik-share-links-thumb-vs-youtube.html",
    labels: ["guide", "youtube", "11tik"],
  },
];

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function refresh(session) {
  const body = new URLSearchParams({
    refresh_token: session.refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Token refresh failed.");
  session.access_token = data.access_token;
}

async function listAllPosts(token) {
  const items = [];
  let pageToken = "";
  do {
    const url = new URL(`${BLOGGER_API}/blogs/${BLOG_ID}/posts`);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("status", "live");
    url.searchParams.set("fetchBodies", "false");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Could not list posts.");
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return items;
}

async function main() {
  if (!isValidBlogId(BLOG_ID)) throw new Error("BLOGGER_BLOG_ID missing.");
  const sessions = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  const session = Object.values(sessions)[0];
  await refresh(session);
  const catalog = await listAllPosts(session.access_token);

  for (const spec of UPDATES) {
    const found = catalog.find((item) => String(item.url || "").endsWith(spec.urlEndsWith));
    if (!found?.id) {
      console.error("MISSING", spec.urlEndsWith);
      process.exit(1);
    }
    const content = readFileSync(join(root, spec.file), "utf8");
    const response = await fetch(`${BLOGGER_API}/blogs/${BLOG_ID}/posts/${found.id}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        kind: "blogger#post",
        id: found.id,
        title: spec.title,
        content,
        labels: spec.labels,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("UPDATE FAIL", spec.urlEndsWith, data.error?.message || data);
      process.exit(1);
    }
    console.log("UPDATED", data.url);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Update failed.");
  process.exit(1);
});
