/**
 * Create the two approved collision-cleared posts.
 * Slug hack: insert with slug-shaped title, then PUT real title + HTML.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
    title: "Why a YouTube Thumbnail Won’t Appear: Private, Age-Restricted, or Processing Videos",
    slugTitle: "youtube thumbnail not appearing private age restricted processing",
    expectedSlug: "youtube-thumbnail-not-appearing-private-age-restricted-processing",
    file: "docs/blogger-pages/blog/youtube-thumbnail-not-appearing.html",
    labels: ["guide", "youtube", "troubleshooting"],
  },
  {
    title: "How 11tik Share Links Work: /thumb/{VIDEO_ID} vs YouTube Watch URLs",
    slugTitle: "11tik share links thumb vs youtube watch url",
    expectedSlug: "11tik-share-links-thumb-vs-youtube-watch-url",
    file: "docs/blogger-pages/blog/11tik-share-links-thumb-vs-watch.html",
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

function pathOf(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "";
  }
}

async function main() {
  if (!isValidBlogId(BLOG_ID)) throw new Error("BLOGGER_BLOG_ID missing.");
  if (!existsSync(SESSION_FILE)) throw new Error("No studio session.");
  const sessions = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  const session = Object.values(sessions)[0];
  if (!session?.refresh_token && !session?.access_token) throw new Error("Empty session.");
  await refresh(session);

  const catalog = await listAllPosts(session.access_token);
  const results = [];

  for (const spec of POSTS) {
    const content = readFileSync(join(root, spec.file), "utf8");
    const existing = catalog.find(
      (item) =>
        String(item.url || "").includes(spec.expectedSlug) ||
        String(item.title || "") === spec.title ||
        String(item.title || "").toLowerCase() === spec.slugTitle,
    );
    if (existing?.id) {
      console.error("REFUSING create — already exists:", existing.url);
      results.push({ ...spec, url: existing.url, skipped: true });
      continue;
    }

    const createdRes = await fetch(`${BLOGGER_API}/blogs/${BLOG_ID}/posts`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        kind: "blogger#post",
        title: spec.slugTitle,
        content,
        labels: spec.labels,
      }),
    });
    const created = await createdRes.json();
    if (!createdRes.ok) {
      console.error("CREATE FAIL", spec.expectedSlug, createdRes.status, created.error?.message || created);
      process.exit(1);
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
        title: spec.title,
        content,
        labels: spec.labels,
      }),
    });
    const updated = await updatedRes.json();
    if (!updatedRes.ok) {
      console.error("TITLE UPDATE FAIL", created.url, updated.error?.message || updated);
      process.exit(1);
    }

    const finalUrl = updated.url || created.url;
    const pathname = pathOf(finalUrl);
    if (!pathname.includes(spec.expectedSlug)) {
      console.warn("WARNING: live slug differs from expected", spec.expectedSlug, "→", pathname);
    }
    console.log("CREATED", finalUrl);
    results.push({ ...spec, url: finalUrl, pathname, skipped: false });
  }

  writeFileSync(join(root, "scripts", "_last-publish-two.json"), JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Publish failed.");
  process.exit(1);
});
