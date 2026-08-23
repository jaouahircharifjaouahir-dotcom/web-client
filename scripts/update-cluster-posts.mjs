/**
 * Updates the three canonical cluster posts in place (same Blogger URLs).
 * Does NOT create new posts.
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

const POSTS = [
  {
    title: "How to Get a YouTube Thumbnail URL Directly From a Video",
    file: "docs/blogger-pages/blog/youtube-thumbnail-url.html",
    urlEndsWith: "/2026/08/youtube-thumbnail-url.html",
    labels: ["guide", "youtube", "thumbnail-url"],
  },
  {
    title: "YouTube Thumbnail Size & Resolution: Complete Guide",
    file: "docs/blogger-pages/blog/youtube-thumbnail-size-resolution.html",
    urlEndsWith: "/2026/08/youtube-thumbnail-size-resolution.html",
    labels: ["guide", "youtube", "thumbnail-size"],
  },
  {
    title: "How to Download a YouTube Thumbnail in HD",
    file: "docs/blogger-pages/blog/how-to-download-youtube-thumbnail.html",
    urlEndsWith: "/2026/08/how-to-download-youtube-thumbnail.html",
    labels: ["guide", "youtube", "download"],
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

  for (const spec of POSTS) {
    const found = catalog.find((item) => String(item.url || "").endsWith(spec.urlEndsWith));
    if (!found?.id) {
      console.error("MISSING (refusing to create)", spec.urlEndsWith);
      continue;
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
      console.error("FAIL", spec.title, response.status, data.error?.message || "update failed");
      continue;
    }
    if (String(data.url || "") !== `https://www.11tik.com${spec.urlEndsWith}` && !String(data.url || "").endsWith(spec.urlEndsWith)) {
      console.error("URL CHANGED unexpectedly", found.url, "->", data.url);
      continue;
    }
    console.log("OK", data.status || "LIVE", data.url);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Update failed.");
  process.exit(1);
});
