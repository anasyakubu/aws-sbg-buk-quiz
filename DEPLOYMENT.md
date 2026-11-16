# Deploy both the frontend and API to Vercel

This version uses **MongoDB-backed live games** with HTTP updates every ~1.4 seconds.
It does **not** require an inbound WebSocket, a running Socket.IO server, sticky sessions,
Redis, or Render. API instances can be created and removed by Vercel without losing
an active game; shared room data and server-side scoring live in MongoDB Atlas.

> Source version only: the ZIP does not deploy itself. Redeploy **both** Vercel projects
> after updating the files and environment variables.

## 1. MongoDB Atlas

Create a MongoDB Atlas cluster and database user, if you have not already. Add
an Atlas connection string to the **API project** as `MONGODB_URI`. Because Vercel
has dynamically allocated outbound IPs unless you purchase static egress, Atlas
network access must permit the Vercel connections you intend. If allowing
`0.0.0.0/0`, protect the database with a strong unique password and least-privileged
user; prefer static egress/private networking where available.

This is the same database used for quizzes/accounts/results. New `LiveGame` and
`LivePlayer` collections are created on demand. No manual migration is required.

## 2. Vercel API project (separate Vercel project)

- Repository: the full project.
- **Root Directory:** `server` (do not select the repository root or `client`).
- **Framework Preset:** Express.
- **Install Command:** `npm ci` (or the preset's default).
- **Production Build:** leave the Express preset's defaults unless your deployment requires `npm run build`.
- **Fluid Compute:** supported, but no WebSocket configuration needed.

Set these environment variables under Settings → Environment Variables:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER/sbg-buk-quiz
JWT_SECRET=YOUR_32_PLUS_CHARACTER_RANDOM_SECRET
CLIENT_URL=https://aws-sbg-buk-quiz.vercel.app
SERVER_URL=https://aws-sbg-buk-quiz-api.vercel.app
```

Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`. Use the API's production URL for the Google OAuth callback:
`https://aws-sbg-buk-quiz-api.vercel.app/api/auth/google/callback`.

**Redeploy the API.** Open:

`https://aws-sbg-buk-quiz-api.vercel.app/api/health`

It must answer with JSON like:

```json
{"ok":true,"realtime":true,"transport":"http-polling","websocketRequired":false,"ts":1770000000000}
```

The `ts` number changes and is illustrative. If the endpoint gives 404/500, check
that the Root Directory is `server`, the deployment is up to date, and MongoDB
connection settings are valid.

`/socket.io/?EIO=4` is **not used by this build**. Its former 404 is not relevant
once the new frontend bundle is deployed and no longer requests it.

## 3. Vercel frontend project

- Repository: the same full project.
- **Root Directory:** `client`.
- **Framework Preset:** Vite.
- **Build Command:** `npm run build`.
- **Output Directory:** `dist`.

Set under Settings → Environment Variables:

```env
VITE_API_URL=https://aws-sbg-buk-quiz-api.vercel.app
```

The variable is the API origin **without** `/api`, `/socket.io`, or a trailing slash.
**Redeploy the frontend** — Vite embeds `VITE_API_URL` at build time.

API `CLIENT_URL` must match the frontend's real HTTPS origin, with no trailing slash.
Use comma-separated origins for additional domains. If you deploy a custom domain,
update both sides and redeploy.

## 4. Verification

Run from `client/` after installing dependencies:

```bash
npm ci
npm run check:realtime -- https://aws-sbg-buk-quiz-api.vercel.app
```

This verifies that `/api/health` reports the HTTP live transport and that the
`/api/live/:pin/state` route is active.

Then sign in, create a quiz containing supported question types, choose **Host
live**, and join with a second phone or browser profile. Verify:

1. Players appear in the host lobby.
2. Start/reveal/next/pause/resume/end update both devices within about 1–2 seconds.
3. Answers are scored once, even on reconnect or retry.
4. Reload the host/player screens; the PIN and score are restored.
5. After ending, check the history and leaderboard.

## 5. PWA / mobile

The Vite build generates `manifest.webmanifest` and `sw.js`; the app includes
192px/512px icons, Apple touch icon, install UI, and responsive layouts.
Chrome and Edge show an install prompt when the browser deems the site eligible.
On iOS Safari, use Share → Add to Home Screen. HTTPS is required in production.
The PWA can cache static app resources, **not** submit quiz answers offline.

## 6. Capacity and limitations

- Live updates are **near real time** (poll approximately every 1.4 seconds),
  not sub-100ms WebSocket pushes. This avoids the Vercel Socket.IO 404 and
  cross-instance state problem without requiring additional providers.
- MongoDB Atlas and Vercel read/write quotas apply. For very large events,
  increase polling intervals or upgrade to Vercel WebSockets + Redis fan-out.
- Old rooms created by the previous in-memory Socket.IO backend cannot be
  recovered by this new version; host a fresh session after deploying.
- Ongoing games expire after 24 hours, and TTL cleanup is eventually consistent.
- Deployment, credentials, database network access, and actual mobile installation
  must be verified on your own Vercel/Atlas accounts. No keys are bundled.
