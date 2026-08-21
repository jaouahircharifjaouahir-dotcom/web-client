/**
 * Local operator server for Google Blogger API v3.
 * OAuth secrets and tokens stay on this process — never sent to the browser.
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  AUTH_URL,
  BLOGGER_API,
  BLOGGER_SCOPE,
  TOKEN_URL,
  isValidBlogId,
  mapBloggerError,
  newSessionId,
  parseCookies,
  parseLabels,
  readState,
  signState,
} from "./blogger-studio-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(join(root, ".env"));

const PORT = Number(process.env.BLOGGER_STUDIO_PORT || 8788);
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:5173/blogger-api/oauth/callback";
const STATE_SECRET = process.env.GOOGLE_OAUTH_STATE_SECRET || CLIENT_SECRET || "dev-only-change-me";
const SESSION_DIR = join(root, "secrets");
const SESSION_FILE = join(SESSION_DIR, "blogger-studio-sessions.json");
const COOKIE = "11tik_blogger_sid";

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

function readSessions() {
  if (!existsSync(SESSION_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeSessions(data) {
  mkdirSync(SESSION_DIR, { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
}

function json(res, status, payload, sid) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (sid) {
    headers["set-cookie"] = `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function sessionFrom(req) {
  const sid = parseCookies(req.headers.cookie)[COOKIE];
  if (!sid) return { sid: "", session: null };
  const sessions = readSessions();
  return { sid, session: sessions[sid] || null };
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token exchange failed.");
  }
  return data;
}

async function refreshAccess(session) {
  if (!session.refresh_token) throw new Error("User not authorized. Connect Google Account again.");
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
    throw new Error("User not authorized. Connect Google Account again.");
  }
  session.access_token = data.access_token;
  if (data.refresh_token) session.refresh_token = data.refresh_token;
  session.expiry = Date.now() + Number(data.expires_in || 3600) * 1000 - 30_000;
}

async function accessToken(sid, session) {
  if (!session?.access_token) throw Object.assign(new Error("User not authorized. Connect Google Account again."), { http: 401 });
  if (!session.expiry || Date.now() >= session.expiry) {
    await refreshAccess(session);
    const all = readSessions();
    all[sid] = session;
    writeSessions(all);
  }
  return session.access_token;
}

async function blogger(sid, session, method, path, payload) {
  const token = await accessToken(sid, session);
  const response = await fetch(`${BLOGGER_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const mapped = mapBloggerError(response.status, data.error || data);
    throw Object.assign(new Error(mapped.error), { http: mapped.status, details: data });
  }
  return data;
}

async function handle(req, res) {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/^\/blogger-api/, "") || "/";

  if (req.method === "GET" && path === "/health") {
    return json(res, 200, { ok: true, oauthConfigured: Boolean(CLIENT_ID && CLIENT_SECRET) });
  }

  if (req.method === "GET" && path === "/status") {
    const { session } = sessionFrom(req);
    return json(res, 200, {
      connected: Boolean(session?.access_token || session?.refresh_token),
      blogId: session?.blogId || "",
      oauthConfigured: Boolean(CLIENT_ID && CLIENT_SECRET),
    });
  }

  if (req.method === "GET" && path === "/auth/start") {
    const blogId = url.searchParams.get("blogId") || "";
    if (!isValidBlogId(blogId)) {
      return json(res, 400, { error: "Invalid Blog ID. Use the numeric ID from Blogger settings." });
    }
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return json(res, 500, { error: "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET." });
    }
    const state = signState({ blogId: blogId.trim(), n: newSessionId().slice(0, 16), t: Date.now() }, STATE_SECRET);
    const auth = new URL(AUTH_URL);
    auth.searchParams.set("client_id", CLIENT_ID);
    auth.searchParams.set("redirect_uri", REDIRECT_URI);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", BLOGGER_SCOPE);
    auth.searchParams.set("access_type", "offline");
    auth.searchParams.set("prompt", "consent");
    auth.searchParams.set("state", state);
    res.writeHead(302, { location: auth.toString() });
    return res.end();
  }

  if (req.method === "GET" && path === "/oauth/callback") {
    try {
      const state = readState(url.searchParams.get("state"), STATE_SECRET);
      if (Date.now() - Number(state.t || 0) > 15 * 60 * 1000) throw new Error("OAuth state expired.");
      if (!isValidBlogId(state.blogId)) throw new Error("Invalid Blog ID in OAuth state.");
      const code = url.searchParams.get("code");
      if (!code) throw new Error("Google did not return an authorization code.");
      const tokens = await exchangeCode(code);
      const sid = newSessionId();
      const all = readSessions();
      all[sid] = {
        blogId: state.blogId.trim(),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || "",
        expiry: Date.now() + Number(tokens.expires_in || 3600) * 1000 - 30_000,
      };
      writeSessions(all);
      res.writeHead(302, {
        location: "/blogger-studio.html?connected=1",
        "set-cookie": `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
      });
      return res.end();
    } catch (error) {
      const message = encodeURIComponent(error instanceof Error ? error.message : "OAuth failed.");
      res.writeHead(302, { location: `/blogger-studio.html?error=${message}` });
      return res.end();
    }
  }

  if (req.method === "POST" && (path === "/posts" || path === "/pages")) {
    try {
      const { sid, session } = sessionFrom(req);
      if (!session) return json(res, 401, { error: "User not authorized. Connect Google Account first." });
      const body = await readBody(req);
      const blogId = String(body.blogId || session.blogId || "").trim();
      if (!isValidBlogId(blogId)) return json(res, 400, { error: "Invalid Blog ID." });
      const title = String(body.title || "").trim();
      const content = String(body.content || "").trim();
      if (!title || !content) return json(res, 400, { error: "Title and HTML content are required." });
      session.blogId = blogId;
      const all = readSessions();
      all[sid] = session;
      writeSessions(all);

      if (path === "/posts") {
        const labels = parseLabels(body.labels);
        const isDraft = Boolean(body.draft);
        const created = await blogger(
          sid,
          session,
          "POST",
          `/blogs/${blogId}/posts${isDraft ? "?isDraft=true" : ""}`,
          { kind: "blogger#post", title, content, labels },
        );
        return json(res, 200, {
          kind: "post",
          id: created.id,
          url: created.url,
          status: created.status,
          title: created.title,
        });
      }

      const created = await blogger(sid, session, "POST", `/blogs/${blogId}/pages`, {
        kind: "blogger#page",
        title,
        content,
      });
      return json(res, 200, {
        kind: "page",
        id: created.id,
        url: created.url,
        status: created.status,
        title: created.title,
      });
    } catch (error) {
      const status = error?.http || (error instanceof TypeError ? 502 : 400);
      const message =
        error instanceof TypeError
          ? "Network error while calling Google."
          : error instanceof Error
            ? error.message
            : "Request failed.";
      return json(res, status >= 400 ? status : 500, { error: message });
    }
  }

  json(res, 404, { error: "Not found." });
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    json(res, 500, { error: error instanceof Error ? error.message : "Server error." });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Blogger studio API http://127.0.0.1:${PORT}`);
  if (process.argv.includes("--with-ui")) {
    const vite = spawn("npx", ["vite", "--open", "/blogger-studio.html"], {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    vite.on("exit", (code) => process.exit(code ?? 0));
  }
});
