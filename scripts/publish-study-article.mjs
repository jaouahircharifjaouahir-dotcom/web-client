/**
 * One-shot publisher for the 300-video study article (Phase 18D).
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

const POST = {
  title: "YouTube Thumbnail Sizes & Resolutions: 300-Video Study",
  slugTitle: "youtube thumbnail sizes resolutions 300 video study",
  expectedSlug: "youtube-thumbnail-sizes-resolutions-study",
  file: "docs/blogger-pages/blog/youtube-thumbnail-sizes-resolutions-study.html",
  labels: ["guide", "youtube", "research"],
};

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
  if (!response.ok || !data.access_token) {
    throw new Error("Token refresh failed. Connect Google Account again.");
  }
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
  if (!existsSync(SESSION_FILE)) throw new Error("No studio session.");
  const sessions = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  const session = Object.values(sessions)[0];
  if (!session?.refresh_token && !session?.access_token) throw new Error("Empty session.");
  await refresh(session);

  const catalog = await listAllPosts(session.access_token);
  const existing = catalog.find(
    (item) =>
      String(item.url || "").includes(POST.expectedSlug) ||
      String(item.title || "") === POST.title,
  );
  if (existing?.url) {
    console.log("EXISTS", existing.url);
    return;
  }

  const content = readFileSync(join(root, POST.file), "utf8");
  const createdRes = await fetch(`${BLOGGER_API}/blogs/${BLOG_ID}/posts`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      kind: "blogger#post",
      title: POST.slugTitle,
      content,
      labels: POST.labels,
    }),
  });
  const created = await createdRes.json();
  if (!createdRes.ok) {
    throw new Error(created.error?.message || `Create failed ${createdRes.status}`);
  }

  const updatedRes = await fetch(`${BLOGGER_API}/blogs/${BLOG_ID}/posts/${created.id}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      kind: "blogger#post",
      id: created.id,
      title: POST.title,
      content,
      labels: POST.labels,
    }),
  });
  const updated = await updatedRes.json();
  if (!updatedRes.ok) {
    throw new Error(updated.error?.message || `Title update failed ${updatedRes.status}`);
  }

  console.log("CREATED", updated.url || created.url);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Publish failed.");
  process.exit(1);
});
