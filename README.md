# AWS Student Builder Group BUK Quiz Platform

A live quiz platform for SBG BUK technical sessions, workshops, hackathons, and seminars. Hosts create quizzes manually or with AI (OpenAI / Anthropic Claude), run them live with a game PIN + QR code, and participants compete from their phones with speed-based scoring — built to survive unstable campus internet.

See `ARCHITECTURE.md` for system design, data model, and the phase roadmap.

## What works today (v1 core)

- Email + password auth (bcrypt, JWT) and **Google Sign-In**
- Profile editing, skill level, avatar, change password
- Quiz builder: multiple choice, true/false, multiple answers, code output; per-question timer, points, explanation, reordering
- **AI quiz generation** with provider choice (Anthropic Claude or OpenAI); every draft opens in the editor for review before publishing
- Live games: PIN, QR code, invite link, lobby, start/pause/resume/skip/reveal/end, remove players, live answer counts
- Speed scoring with streak bonuses, animated top-10 leaderboard, podium finale
- **Low-network resilience**: automatic reconnect with exponential backoff, answers saved to localStorage before sending and re-sent after reconnect, players are never dropped mid-game, connection status banner, compressed payloads, PWA with offline shell caching
- Game reports persisted (per-player scores/accuracy/response times + per-question stats) and score history for participants
- Dark/light mode, mobile-first responsive UI, keyboard/ARIA accessibility, skeleton loaders and empty states
- Docker Compose, NGINX, GitHub Actions CI, PM2 config

Coming in the next phases (schemas and hooks are already in place): admin panel, badges, PDF certificates, analytics dashboard UI, CSV/Excel/JSON import-export, question bank UI, scheduling, remaining question types, push notifications, Redis Socket.IO adapter + BullMQ jobs, automated tests.

## Requirements

- Node.js 20+
- MongoDB 6/7 (local, Docker, or MongoDB Atlas)
- Optional: Redis 7 (only needed for multi-instance scaling), OpenAI and/or Anthropic API keys, Google OAuth credentials

## Quick start (development)

```bash
# 1. MongoDB (skip if you already run one)
docker run -d --name mongo -p 27017:27017 mongo:7

# 2. Backend
cd server
cp .env.example .env        # edit JWT_SECRET at minimum
npm install
npm run dev                 # http://localhost:5000

# 3. Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api and /socket.io to :5000)
```

Open http://localhost:5173, create an account, build a quiz (or generate one with AI), click **Host live**, then join from your phone at the same address using the PIN or QR code.

## Environment variables (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | API port, default 5000 |
| `CLIENT_URL` | yes in prod | Frontend origin for CORS + OAuth redirects |
| `MONGODB_URI` | yes | e.g. `mongodb://localhost:27017/sbg-buk-quiz` or an Atlas URI |
| `JWT_SECRET` | yes | Long random string — rotate = everyone signs in again |
| `JWT_EXPIRES_IN` | no | Default `7d` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Enables Google Sign-In |
| `OPENAI_API_KEY` | no | Enables the OpenAI provider |
| `ANTHROPIC_API_KEY` | no | Enables the Claude provider |
| `REDIS_URL` | no | Reserved for the Socket.IO adapter / BullMQ (multi-instance) |

## Google OAuth setup

1. In [Google Cloud Console](https://console.cloud.google.com) create a project → **APIs & Services → Credentials → Create credentials → OAuth client ID** (type: Web application).
2. Authorized redirect URI: `http://localhost:5000/api/auth/google/callback` (and your production equivalent, e.g. `https://quiz.example.com/api/auth/google/callback`).
3. Put the client ID/secret in `server/.env`. The "Continue with Google" button activates automatically; without keys the endpoint returns a clear 503.

## AI setup

Add `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` to `server/.env`. The generate page shows which providers are configured. Generation is rate-limited (30/hour per IP) and every AI draft must pass through the editor before it can be hosted.

## Production with Docker

```bash
cp server/.env.example .env       # compose reads JWT_SECRET etc. from repo-root .env
docker compose up -d --build      # app on http://localhost:8080
```

Compose runs MongoDB, Redis, the API, and an NGINX container serving the built client and proxying `/api` + `/socket.io` (WebSocket upgrade included). Put TLS in front with your usual reverse proxy or a cloud load balancer. For bare-metal/EC2 without Docker, build both packages and use `ecosystem.config.js` with PM2.

**Scaling note:** game state lives in server memory, so run one API instance. To scale horizontally, add `@socket.io/redis-adapter` and move `GameManager` state to Redis — the code isolates all state behind `server/src/socket/game.ts` to make that a contained change.

## API reference

Base URL: `/api`. Authenticated routes need `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | `{name,email,password,department?}` → `{token,user}` |
| POST | `/auth/login` | `{email,password}` → `{token,user}` |
| GET | `/auth/me` | Current user |
| PATCH | `/auth/profile` | Update name/institution/department/skillLevel/avatarUrl |
| POST | `/auth/change-password` | `{currentPassword,newPassword}` |
| GET | `/auth/google` → `/auth/google/callback` | OAuth flow, redirects to `/oauth/callback?token=…` |
| GET/POST | `/quizzes` | List own quizzes / create quiz |
| GET/PUT/DELETE | `/quizzes/:id` | Read / update / delete (owner only) |
| GET | `/quizzes/categories` | Category list |
| GET | `/ai/providers` | Which AI providers are configured |
| POST | `/ai/generate` | `{provider,topic,difficulty,count,language?,audience?,timePerQuestion}` → `{questions}` |
| GET | `/results/hosted` | Reports for games you hosted |
| GET | `/results/history` | Your score history as a player |
| GET | `/results/:id` | Full game report (host or participant) |
| GET | `/health` | Liveness check |

All bodies are validated with Zod; errors return `{error: "human-readable message"}`.

## Socket.IO events

Connect with `auth: {token}` (hosts must be signed in; players may be anonymous).

**Host emits** (all take `{pin}` and an ack callback): `host:create {quizId}`, `host:rejoin`, `host:start`, `host:next`, `host:skip`, `host:pause`, `host:resume`, `host:end`, `host:kick {playerId}`.

**Player emits**: `player:join {pin, playerId, name}`, `player:answer {pin, playerId, questionIndex, answer:number[]}`. `playerId` is a client-generated UUID kept in localStorage — rejoining with the same id restores score, streak, and the active question.

**Server emits**: `lobby:state`, `question:show {question, deadline, serverNow}`, `question:end {correctIndexes, explanation, stats, isLast}`, `player:result` (private: correct/points/rank/explanation), `leaderboard:update`, `host:answer-count`, `game:paused`, `game:resumed`, `game:over {podium, leaderboard}`, `player:kicked`.

`serverNow` lets clients compute clock skew so countdowns match the server deadline. Correct answers are never sent to players before `question:end`.

## Scoring

Correct answer = `base×0.5 + base×0.5×(timeRemaining/timeLimit)` + `min(streak,5)×50` bonus. Base defaults to 1000 and is editable per question. Wrong or missed answers score 0 and reset the streak. All scoring is server-side.

## PWA

Built with `vite-plugin-pwa`: installable manifest, app icons, auto-updating service worker that precaches the shell so the app opens instantly on repeat visits even on poor connections (API/socket traffic is never cached). `npm run build` then serve `client/dist` over HTTPS to enable install prompts.

## Project structure

```
aws-sbg-buk-quiz/
├─ ARCHITECTURE.md
├─ docker-compose.yml            # mongo + redis + api + nginx client
├─ ecosystem.config.js           # PM2 alternative
├─ .github/workflows/ci.yml
├─ server/
│  └─ src/
│     ├─ config/                 # env, db, passport (Google)
│     ├─ models/                 # User, Quiz(+questions), GameResult
│     ├─ middleware/             # auth (JWT), zod validate, errors
│     ├─ controllers/            # auth, quiz, ai, results
│     ├─ routes/                 # REST API + rate limits
│     ├─ services/               # ai.service (OpenAI + Anthropic)
│     ├─ socket/game.ts          # live game engine
│     └─ utils/
└─ client/
   └─ src/
      ├─ components/             # Navbar, ConnectionBanner, Leaderboard, Countdown, ui
      ├─ context/                # Auth, Theme
      ├─ lib/                    # api (retry), socket (backoff), player (answer persistence)
      └─ pages/                  # Landing, auth, Dashboard, QuizEditor, AIGenerate, Host, Join, Play, Profile, History
```

## Security notes

Helmet headers, CORS locked to `CLIENT_URL`, global + per-route rate limiting, Zod validation on every write, bcrypt(12) hashing, JWT expiry, owner checks on every quiz/report query, server-authoritative scoring, and React's escaping for XSS. The API is stateless (no cookies), which removes classic CSRF exposure; if you move tokens into cookies, add SameSite + a CSRF token.
