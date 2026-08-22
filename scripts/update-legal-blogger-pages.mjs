/**
 * Updates existing Blogger Pages (about, privacy, contact, terms) from docs/blogger-pages.
 * Prints titles and URLs only.
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

const PAGES = [
  { title: "About 11tik", file: "docs/blogger-pages/about.html", slugs: ["about"] },
  { title: "Privacy Policy", file: "docs/blogger-pages/privacy.html", slugs: ["privacy"] },
  { title: "Contact", file: "docs/blogger-pages/contact.html", slugs: ["contact"] },
  { title: "Terms of use", file: "docs/blogger-pages/terms.html", slugs: ["terms-of-use", "terms"] },
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

function matchPage(item, spec) {
  const url = String(item.url || "").toLowerCase();
  const title = String(item.title || "").toLowerCase();
  return spec.slugs.some((slug) => url.includes(`/p/${slug}`) || title.includes(slug));
}

async function main() {
  if (!isValidBlogId(BLOG_ID)) throw new Error("BLOGGER_BLOG_ID missing.");
  if (!existsSync(SESSION_FILE)) throw new Error("No studio session.");
  const sessions = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  const session = Object.values(sessions)[0];
  if (!session?.refresh_token && !session?.access_token) throw new Error("Empty session.");
  await refresh(session);

  const listed = await fetch(`${BLOGGER_API}/blogs/${BLOG_ID}/pages?maxResults=50`, {
    headers: { authorization: `Bearer ${session.access_token}` },
  });
  const catalog = await listed.json();
  if (!listed.ok) throw new Error(catalog.error?.message || "Could not list pages.");
  const items = catalog.items || [];

  for (const spec of PAGES) {
    const found = items.find((item) => matchPage(item, spec));
    const content = readFileSync(join(root, spec.file), "utf8");
    if (!found?.id) {
      const created = await fetch(`${BLOGGER_API}/blogs/${BLOG_ID}/pages`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "blogger#page",
          title: spec.title,
          content,
        }),
      });
      const data = await created.json();
      if (!created.ok) {
        console.error("CREATE FAIL", spec.title, created.status, data.error?.message || "create failed");
        continue;
      }
      console.log("CREATED", spec.title, data.url);
      continue;
    }
    const response = await fetch(`${BLOGGER_API}/blogs/${BLOG_ID}/pages/${found.id}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        kind: "blogger#page",
        id: found.id,
        title: spec.title,
        content,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("FAIL", spec.title, response.status, data.error?.message || "update failed");
      continue;
    }
    console.log("OK", spec.title, data.url);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Update failed.");
  process.exit(1);
});
