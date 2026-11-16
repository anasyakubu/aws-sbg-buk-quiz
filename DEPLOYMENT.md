# Deploy SBG BUK Quiz with working live hosting and PWA

This repo contains **two separate projects**. The browser must connect to the
*same always-on backend* for both API endpoints and Socket.IO. Merely deploying
`server/` to Vercel as Express gives REST endpoints without the listener in
`server/src/index.ts`. With the current in-memory state, running several backend
instances also splits games across instances.

## 1. Database

Create a MongoDB Atlas database or run a MongoDB server. Create a database user
and set your backend's `MONGODB_URI`. Allow network access from your API host;
for a dynamic outbound IP you may need an appropriately secured allowlist and
must use a strong password. Do not commit database credentials to Git.

## 2. Backend — Render (recommended for this code)

Push this updated project to your Git repository. In Render:

- Create a **Blueprint** from the repository root using `render.yaml`, or
  create a Web Service with **Root Directory** `server`, Runtime `Node`,
  Build Command `npm ci && npm run build`, Start Command `npm start`, and
  Health Check Path `/api/health`.
- Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (a long random string),
  `CLIENT_URL=https://YOUR-FRONTEND.vercel.app`, and
  `SERVER_URL=https://YOUR-RENDER-SERVICE.onrender.com`.
- Add optional `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`,
  and/or `ANTHROPIC_API_KEY` only for the features you use.
- Keep the backend **one instance** and use an always-on plan for live events.
  Free services that sleep are not reliable for live quiz sessions.

When deployed, opening
`https://YOUR-RENDER-SERVICE.onrender.com/api/health` should return a JSON
object including `"ok": true` and **`"realtime": true`**. If realtime is
false, you are hitting the Express REST app without the Socket.IO server.

### Alternative backend hosts

Railway, Fly.io, AWS EC2, or another persistent Node host can use the same
`server/` build and start commands. On EC2, use a process manager such as PM2
(see `ecosystem.config.js`) and put TLS behind a trusted reverse proxy.
On platforms that inject `PORT`, the server uses it automatically.

## 3. Frontend — Vercel

Create a separate Vercel project with **Root Directory** `client`. Vercel reads
`client/vercel.json` and builds the frontend with `npm run build`.

Set the frontend environment variable:

```dotenv
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

Use the origin only (no `/api`, no `/socket.io`, no trailing slash). Then
**Redeploy**. Vite embeds environment variables during build, so updating them
without rebuilding does not change existing JS files. The old backend URL
`https://aws-sbg-buk-quiz-api.vercel.app` must no longer be used as the realtime
Socket.IO endpoint.

Update `CLIENT_URL` on Render to your actual Vercel frontend HTTPS origin;
keep `SERVER_URL` pointing to the persistent backend HTTPS origin. CORS applies
to both API calls and Socket.IO handshakes.

For Google Sign-In, register this callback URL with Google Cloud:
`https://YOUR-RENDER-SERVICE.onrender.com/api/auth/google/callback`.

## 4. Check the connection

From the `client/` directory, install dependencies and run:

```bash
npm ci
npm run check:realtime -- https://YOUR-RENDER-SERVICE.onrender.com
```

The script checks `/api/health`, connects a WebSocket, and confirms the Socket.IO
live-game event handler responds. If it fails, verify the backend logs, the
frontend `VITE_API_URL`, CORS `CLIENT_URL`, and any host firewall/proxy rules.

Then sign in, create a quiz, click **Host live**, join from a second phone using
the game PIN, start the quiz, answer, and refresh one device to confirm recovery.

## 5. Install the PWA

Deploy over HTTPS, open the **frontend URL**, and use **Install quiz app** on
the landing page. On Chrome/Edge/Android a browser install prompt can appear;
on iPhone/iPad use Safari's Share menu → **Add to Home Screen**. Your browser
controls install eligibility. The web app supplies a manifest, service worker,
192px/512px icons, Apple touch icon and responsive layouts.

The PWA can cache the app shell for repeat visits. It cannot host or submit
live answers while offline; these still need a live server connection.

## Known architecture limits

- Active games are **not persisted**. A backend restart/deploy ends active
  sessions; saved quiz content and finished results remain in MongoDB.
- Run **one backend instance**. Horizontal scaling requires shared game-state
  storage/coordination **in addition to** a Socket.IO cross-instance adapter.
- Browser install prompts are controlled by the browser; not every device
  offers an automatic prompt.
- Production deployment requires your own MongoDB URL, JWT secret, and domain
  configuration. The ZIP does not contain those secrets.
