import { useEffect, useState } from "react";
import { isValidBlogId } from "./validate";

type Status = {
  connected: boolean;
  blogId: string;
  oauthConfigured: boolean;
};

type Result = { kind: string; id?: string; url?: string; status?: string; title?: string; error?: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, {
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  } catch (error) {
    if (error instanceof TypeError) throw new Error("Network error. Is the studio API running?");
    throw error;
  }
}

export function StudioApp() {
  const params = new URLSearchParams(location.search);
  const [blogId, setBlogId] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [banner, setBanner] = useState(params.get("error") || "");
  const [postTitle, setPostTitle] = useState("");
  const [postHtml, setPostHtml] = useState("");
  const [labels, setLabels] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageHtml, setPageHtml] = useState("");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function refreshStatus() {
    const next = await api<Status>("/blogger-api/status");
    setStatus(next);
    if (next.blogId) setBlogId(next.blogId);
  }

  useEffect(() => {
    refreshStatus().catch((error: Error) => setBanner(error.message));
    if (params.get("connected") === "1") setBanner("Google account connected.");
  }, []);

  function connect() {
    setBanner("");
    if (!isValidBlogId(blogId)) {
      setBanner("Invalid Blog ID. Use the numeric ID from Blogger settings.");
      return;
    }
    location.href = `/blogger-api/auth/start?blogId=${encodeURIComponent(blogId.trim())}`;
  }

  async function publish(kind: "posts" | "pages", draft: boolean) {
    setBanner("");
    setResult(null);
    setBusy(draft ? "Saving draft…" : "Publishing…");
    try {
      const payload =
        kind === "posts"
          ? { blogId: blogId.trim(), title: postTitle, content: postHtml, labels, draft }
          : { blogId: blogId.trim(), title: pageTitle, content: pageHtml };
      const created = await api<Result>(`/blogger-api/${kind}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(created);
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy("");
    }
  }

  const connected = Boolean(status?.connected);

  return (
    <main className="studio">
      <h1>Blogger Studio</h1>
      <p className="studio-lead">Local operator tool. Uses Google OAuth and Blogger API v3. Credentials stay in gitignored .env. Not part of the public 11tik site.</p>

      {banner ? <p className="studio-banner">{banner}</p> : null}

      <section>
        <h2>Connection</h2>
        <label>
          Blog ID
          <input value={blogId} onChange={(event) => setBlogId(event.target.value)} placeholder="0000000000000000000" inputMode="numeric" />
        </label>
        <p className="studio-status">
          Status: {status == null ? "Checking…" : connected ? "Connected" : "Not connected"}
          {status && !status.oauthConfigured ? " — OAuth credentials missing in .env" : ""}
        </p>
        <button type="button" onClick={connect}>
          Connect Google Account
        </button>
      </section>

      <section>
        <h2>Post</h2>
        <label>
          Title
          <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} />
        </label>
        <label>
          HTML content
          <textarea rows={10} value={postHtml} onChange={(event) => setPostHtml(event.target.value)} />
        </label>
        <label>
          Labels (comma-separated)
          <input value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="guide, youtube" />
        </label>
        <div className="studio-row">
          <button type="button" disabled={!connected || Boolean(busy)} onClick={() => void publish("posts", false)}>
            Publish Post
          </button>
          <button type="button" className="studio-secondary" disabled={!connected || Boolean(busy)} onClick={() => void publish("posts", true)}>
            Save as Draft
          </button>
        </div>
      </section>

      <section>
        <h2>Page</h2>
        <label>
          Title
          <input value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} />
        </label>
        <label>
          HTML content
          <textarea rows={10} value={pageHtml} onChange={(event) => setPageHtml(event.target.value)} />
        </label>
        <button type="button" disabled={!connected || Boolean(busy)} onClick={() => void publish("pages", false)}>
          Publish Page
        </button>
      </section>

      {busy ? <p>{busy}</p> : null}
      {result && !result.error ? (
        <section>
          <h2>Created {result.kind}</h2>
          <p>ID: {result.id || "—"}</p>
          <p>Status: {result.status || "—"}</p>
          {result.url ? (
            <p>
              URL: <a href={result.url}>{result.url}</a>
            </p>
          ) : (
            <p>URL: — (drafts may not have a public URL yet)</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
