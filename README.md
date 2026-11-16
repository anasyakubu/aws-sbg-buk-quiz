# AWS Student Builder Group BUK — Quiz App (Vercel + PWA)

Full-stack TypeScript/React quiz app with authentication, quiz management,
AI-assisted question generation, game history, leaderboards, and installable PWA.

## Fixed Vercel live-game hosting

Your old browser console showed repeated `404 /socket.io/?EIO=4...` requests.
The old Vercel API deployed Express without the Socket.IO HTTP server; even
adding a socket endpoint would not share the old in-memory room map across
Vercel Function instances.

This version **does not make Socket.IO requests from the browser**. A new
`/api/live` API stores game rooms, participants, deadlines, scores, and answer
history in the already configured MongoDB database. Host and player interfaces
refresh state about every **1.4 seconds**; hosting works across ordinary
Vercel Functions, refreshes, and scaling without sticky sessions. The legacy
Socket.IO game engine is still included for reference/local use but is not the
transport used by the deployed frontend.

The PWA remains installable with a manifest, service worker, icons, install UI,
mobile sizing, dark theme, and safe-area support. The deprecated Apple-only
mobile capability meta now has the standard companion meta tag.

## Run locally

Create `server/.env` from `server/.env.example`. Run MongoDB locally or set a
MongoDB Atlas URI, then:

```bash
cd server
npm ci
npm run dev
```

In a second terminal:

```bash
cd client
npm ci
npm run dev
```

Open `http://localhost:5173` — Vite forwards `/api` to `localhost:5000`.
The local server also exposes a legacy socket path, but the new frontend
uses only the database-backed `/api/live` HTTP endpoints.

## Deploy frontend **and** API to Vercel

**Read [DEPLOYMENT.md](DEPLOYMENT.md)** for exact steps. Make TWO Vercel
projects with Root Directory `server` and `client` respectively. Both projects
must use the correct environment variables and be redeployed after changes.

API (`server` project):

- `MONGODB_URI` — Atlas connection string, same one used for accounts/quizzes.
- `JWT_SECRET` — a private long random secret.
- `CLIENT_URL` — frontend HTTPS URL for CORS.
- `SERVER_URL` — API HTTPS URL for Google OAuth.
- `NODE_ENV=production`.

Frontend (`client` project):

- `VITE_API_URL=https://aws-sbg-buk-quiz-api.vercel.app` (your actual API origin).

Check the API:

```bash
cd client
npm run check:realtime -- https://aws-sbg-buk-quiz-api.vercel.app
```

`/api/health` should report `"transport":"http-polling"` and
`"websocketRequired":false`. The old `/socket.io/` endpoint is intentionally
not used by the new browser app.

## API

All API routes are prefixed with `/api`.

| Path | Description |
|---|---|
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Accounts / JWT |
| `GET/POST /quizzes`, `GET/PUT/DELETE /quizzes/:id` | Quizzes |
| `POST /ai/generate` | Generate quiz draft via configured AI provider |
| `GET /results/hosted`, `/results/history`, `/results/:id` | Reports |
| `POST /live/create` | Authenticated host creates room `{quizId}` |
| `POST /live/:pin/join` | Anonymous or signed-in player joins `{playerId,name}` |
| `GET /live/:pin/state` | Host (JWT) state snapshot |
| `GET /live/:pin/state?playerId=<UUID>` | Player-safe snapshot, never reveals correct answers early |
| `POST /live/:pin/answer` | `{playerId,questionIndex,answer:number[]}` |
| `POST /live/:pin/host/:command` | Host JWT; `start`, `next`, `skip`, `pause`, `resume`, `end`, `kick` |
| `GET /health` | API/database status and live transport type |

## Testing and limitations

Check the included `TEST_REPORT.md`. Full production tests require a MongoDB
instance and dependencies installed from npm. Do not assume a Vercel deployment
is verified until the API health endpoint and a multi-device session pass.

Question deadlines and answers are enforced by the API; the last participant's
answer can trigger early reveal. Normal updates arrive in roughly 1–2 seconds.
Large-scale events can require database capacity planning or a push-based
WebSocket/Redis architecture. App installation and static precaching do **not**
permit submitting answers while offline.
