/**
 * Local publisher: uses gitignored studio session. Prints titles/URLs only.
 */
import { readFileSync, existsSync } from "node:fs";
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
    title: "How to save a YouTube thumbnail on iPhone and Android (2026)",
    file: "docs/blogger-pages/blog/save-youtube-thumbnail-iphone-android.html",
    labels: ["guide", "youtube", "mobile"],
  },
  {
    title: "How to use a YouTube thumbnail as a blog featured image or Open Graph preview",
    file: "docs/blogger-pages/blog/youtube-thumbnail-blog-open-graph.html",
    labels: ["guide", "youtube", "seo"],
  },
  {
    title: "How to extract thumbnails from a YouTube channel URL",
    file: "docs/blogger-pages/blog/extract-thumbnails-youtube-channel.html",
    labels: ["guide", "youtube", "channel"],
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
  session.expiry = Date.now() + Number(data.expires_in || 3600) * 1000 - 30_000;
}

async function main() {
  if (!isValidBlogId(BLOG_ID)) throw new Error("BLOGGER_BLOG_ID missing.");
  if (!existsSync(SESSION_FILE)) throw new Error("No studio session. Connect Google Account first.");
  const sessions = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  const session = Object.values(sessions)[0];
  if (!session?.refresh_token && !session?.access_token) throw new Error("Empty session.");
  if (!session.expiry || Date.now() >= session.expiry) await refresh(session);

  for (const post of POSTS) {
    const content = readFileSync(join(root, post.file), "utf8");
    const response = await fetch(`${BLOGGER_API}/blogs/${BLOG_ID}/posts`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        kind: "blogger#post",
        title: post.title,
        content,
        labels: post.labels,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("FAIL", post.title, response.status, data.error?.message || data);
      continue;
    }
    console.log("OK", data.status, data.url);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Publish failed.");
  process.exit(1);
});
