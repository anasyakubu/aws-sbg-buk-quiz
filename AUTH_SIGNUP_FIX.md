# Fixing email registration and Google signup on Vercel

This ZIP contains **both** the frontend (`client/`) and the API (`server/`).
Updating the code does not change your Vercel project automatically. Deploy the **API first**, then the frontend.

## 1. Deploy the API project

Vercel project: `aws-sbg-buk-quiz-api` (or your own API project).

| Setting | Value |
| --- | --- |
| Root Directory | `server` |
| Framework Preset | Express |
| Install | `npm ci` (default) |
| Build/output overrides | Leave empty / framework defaults |

Set under **Settings → Environment Variables** for Production:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=<long-unique-random-secret-32-plus-characters>
CLIENT_URL=https://aws-sbg-buk-quiz.vercel.app
SERVER_URL=https://aws-sbg-buk-quiz-api.vercel.app
GOOGLE_CLIENT_ID=<Google Cloud Web application OAuth Client ID>
GOOGLE_CLIENT_SECRET=<matching Google OAuth Client Secret>
```

**Do not put** `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, or `MONGODB_URI` in the frontend's environment variables.
Use *your actual* frontend and API URLs if they differ from those examples. Avoid trailing `/`.
Do not put `/api` in `SERVER_URL`.

MongoDB Atlas: database user must have read/write permission, MongoDB URI password must be URL encoded where needed, and Network Access must allow Vercel's outgoing connections.
Ensure the account has permission to create indexes (MongoDB may build a unique index on `googleId`).

Redeploy the API **after saving the variables**. Check:

- `https://aws-sbg-buk-quiz-api.vercel.app/api/health` → `apiVersion: "vercel-auth-v2"`
- `https://aws-sbg-buk-quiz-api.vercel.app/api/auth/providers` → `authVersion: "auth-v2"` and `google: true`

If either gives 404 or the wrong version, the new API source is **not** deployed at that URL.
If providers shows `google: false`, at least one Google credential or `SERVER_URL` is missing in the running API environment.

## 2. Configure Google Cloud Console

Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and create an **OAuth 2.0 Client ID**, type **Web application** (not Android or iOS).

**Authorized JavaScript origins:**

```text
https://aws-sbg-buk-quiz.vercel.app
```

**Authorized redirect URIs (exact match):**

```text
https://aws-sbg-buk-quiz-api.vercel.app/api/auth/google/callback
```

Google requires an exact URI match, including hostname, HTTPS and path. This is an **API** callback, not the frontend `/oauth/callback` route.
Complete the OAuth consent/brand screen configuration (app name, support email, required fields).
If the app is in **Testing** mode, add the Gmail accounts that will test it as Google OAuth test users (or publish when appropriate and compliant).

Google OAuth state uses a short-lived first-party cookie on the API domain; allow cookies and complete the sign-in flow in the same browser.
After consent, the server redirects to the frontend, which reads the token from a URL **fragment**, removes that fragment immediately, and loads the profile.

## 3. Deploy the frontend project

Vercel project: `aws-sbg-buk-quiz` (or your frontend project).

| Setting | Value |
| --- | --- |
| Root Directory | `client` |
| Framework Preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

Production environment variable:

```env
VITE_API_URL=https://aws-sbg-buk-quiz-api.vercel.app
```

This is **only the origin**: no `/api`, no `/auth`, no trailing `/`.
Redeploy after saving the variable. If the browser still shows old code, force-refresh once or remove the old installed PWA and reinstall it.

## 4. Verify both sign-up methods

1. Open `/register` in a private browser window, enter a new email with a strong password, and submit. Expected: you land on `/dashboard`.
2. Sign out and sign in with that email/password.
3. Click **Continue with Google**. The button should be enabled; authorize in Google; expected: the account is created or securely linked using Google's verified email and you land on `/dashboard`.
4. Test Google with a fresh email too. If credentials are missing, the button displays a configuration message instead of failing silently.
5. If an error remains, check **Vercel → API Project → Logs**, and the browser Network tab for `/api/auth/register`, `/api/auth/providers`, and `/api/auth/google/callback`.

**Limitations:** Google signup cannot be fully tested without your Google OAuth client ID/secret, consent configuration and real deployment. MongoDB registration needs a running, authorized database. These credentials are deliberately not included in the ZIP.
