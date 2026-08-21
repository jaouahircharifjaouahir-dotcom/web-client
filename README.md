# web-client

Private static frontend for www.11tik.com.

Do not publish product details, issue trackers, or source maps in public pages.

## Blogger Studio (local operator)

This repo is a Vite + React client. Blogger publishing is a **separate local tool**: a small Node server talks to the official [Blogger API v3](https://developers.google.com/blogger/docs/3.0/using). The public site build does not include this UI.

Google never asks for a password inside this app. You sign in on Google’s OAuth screen. The Client Secret, access token, and refresh token stay on the Node server (`secrets/blogger-studio-sessions.json`, gitignored).

### 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or select one).
3. APIs & Services → **Enable APIs** → enable **Blogger API**.

### 2. OAuth credentials

1. APIs & Services → **OAuth consent screen**. External is fine for a personal blog. Add your Google account as a test user.
2. Scopes: `https://www.googleapis.com/auth/blogger` (read/write the blog).
3. APIs & Services → **Credentials** → Create credentials → **OAuth client ID** → Application type **Web application**.
4. Authorized redirect URI (must match `.env` exactly):

```text
http://localhost:5173/blogger-api/oauth/callback
```

5. Copy the Client ID and Client Secret into `.env` (see `.env.example`). Do not commit `.env`.

### 3. Environment variables

```bash
cp .env.example .env
```

Fill:

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth Web client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret (server only) |
| `GOOGLE_OAUTH_REDIRECT_URI` | Must equal the Cloud Console redirect URI |
| `GOOGLE_OAUTH_STATE_SECRET` | Random string used to sign the OAuth `state` |
| `BLOGGER_STUDIO_PORT` | API port (default `8788`) |

### 4. Run

```bash
npm install
npm run blogger:studio
```

This starts the API on `127.0.0.1:8788` and Vite, then opens `/blogger-studio.html`.

API only:

```bash
npm run blogger:studio:api
```

### 5. Blog ID

Blogger → **Settings** → scroll to **Other** / **Blog ID** (long number). It is not the custom domain.

### 6. Publish a test post

1. Paste the Blog ID.
2. **Connect Google Account** and approve Blogger access with the Google account that **owns** the blog.
3. Enter a title, HTML content, optional labels.
4. **Save as Draft** first, confirm the post in Blogger, then try **Publish Post**.
5. The page shows the Blogger post ID and URL.

Same flow for **Publish Page** (static page).

### Errors

| Message | Typical cause |
|---|---|
| Invalid Blog ID | Not a numeric ID |
| User not authorized | Connect again; refresh token missing |
| Insufficient permissions | Wrong Google account for that blog |
| Blogger API error | Google rejected the insert |
| Network error | API not running or no internet |
| OAuth credentials missing | Empty `.env` |

Do not point this studio at production GitHub Pages. It is localhost-only.
