# AWS Student Builder Group BUK Quiz Platform — Architecture

## 1. System overview

```
                        ┌─────────────────────────────┐
                        │        NGINX (TLS, gzip)     │
                        └──────┬───────────────┬───────┘
                               │ /api, /socket │ /
                     ┌─────────▼─────────┐ ┌───▼────────────┐
                     │  Node.js + Express │ │  React (Vite)  │
                     │  Socket.IO server  │ │  PWA, SW cache │
                     └──┬──────┬──────┬───┘ └────────────────┘
                        │      │      │
                ┌───────▼─┐ ┌──▼───┐ ┌▼──────────────┐
                │ MongoDB │ │Redis*│ │ OpenAI /      │
                │ (data)  │ │(scale│ │ Anthropic API │
                └─────────┘ │ +jobs)└───────────────-┘
                            └──────┘
* Redis is optional in development. In production it powers the
  Socket.IO adapter (multi-instance fan-out) and BullMQ jobs.
```

## 2. Core design decisions

| Concern | Decision | Why |
|---|---|---|
| Live game state | In-memory `GameManager` keyed by PIN, snapshot-persisted to MongoDB on game end | Sub-millisecond reads during a question; a quiz session is ephemeral. Redis adapter added for horizontal scale. |
| Reconnection | Stable `playerId` (UUID in localStorage) decoupled from `socket.id` | A dropped socket never loses a player's score. 45s grace window before a player is shown as "left". |
| Answer safety | Client writes the answer to localStorage **before** emitting; re-emits on reconnect; server dedupes per (player, question) | Answers survive brief disconnects on campus Wi-Fi. |
| Scoring | `500 + round(500 × timeRemaining/timeLimit) + min(streak,5)×50` for correct answers | Kahoot-style speed reward, bounded streak bonus. Computed server-side only. |
| Auth | JWT (7d) via bcrypt-hashed credentials or Google OAuth (Passport) | Stateless API; sockets authenticate with the same token or as anonymous participants. |
| AI generation | Provider-agnostic service; strict JSON prompt + Zod validation of model output | Host reviews/edits every question before publishing — AI output never goes live unreviewed. |
| Low bandwidth | compression middleware, payloads stripped of correct answers until reveal, PWA precache, exponential Socket.IO backoff | Optimized for unstable university networks. |

## 3. Data model (MongoDB)

- **User** — email, passwordHash?, googleId?, name, role (`admin | host | participant`), institution, department, avatarUrl
- **Quiz** — owner, title, description, category, embedded `questions[]` (type, text, options, correctIndexes, explanation, timeLimit, points, code/markdown, imageUrl), visibility, timestamps
- **GameResult** — quizId, hostId, pin, startedAt/endedAt, players[] (name, userId?, score, correct, accuracy, avgMs), perQuestion stats (for analytics)

Question `type` enum already covers the full roadmap:
`multiple_choice | true_false | multiple_answer | fill_blank | code_output | ordering | image`.
The editor ships MCQ / true-false / multiple-answer / code-output first; the schema requires no migration to enable the rest.

## 4. Socket.IO event contract

Host → server: `host:create` `host:start` `host:next` `host:skip` `host:pause` `host:resume` `host:end` `host:kick`
Player → server: `player:join` `player:answer` `player:rejoin`
Server → clients: `lobby:state` `question:show` `question:tick` `question:end` `player:result` `leaderboard:update` `game:paused` `game:resumed` `game:over` `game:error` `player:kicked`

Payloads sent to players never contain correct answers until `question:end`.

## 5. Delivery phases

1. ✅ Architecture, monorepo, tooling
2. ✅ Database design (all schemas)
3. ✅ Backend API (auth, quizzes, AI, results)
4. ✅ Authentication (JWT, bcrypt, profile)
5. ✅ Google OAuth
6. ✅ Socket.IO real-time game engine
7. ✅ AI integration (OpenAI + Anthropic, host review flow)
8. ✅ Quiz engine (create/edit/host/play, 4 question types live)
9. ✅ Leaderboard engine (speed scoring, streaks, top-10, animations)
10. ✅ Frontend UI (design system, dark/light, mobile-first)
11. ✅ Mobile optimization (touch targets, responsive layouts)
12. ✅ Offline & low-network (reconnect, answer recovery, status banner, PWA)
13. ▶ Analytics dashboard (data already captured in GameResult)
14. ✅ PWA (manifest, service worker via vite-plugin-pwa)
15. ▶ Testing (Vitest/Supertest harness — next phase)
16. ✅ Dockerization (Dockerfiles + compose with Mongo/Redis)
17. ✅ Deployment (NGINX config, compose, PM2 notes)
18. ✅ Documentation (README, env, API, socket contract)

▶ = scaffolded and scheduled for the next iteration, alongside: admin panel,
badges, PDF certificates, import/export, remaining question types, scheduling,
question bank UI, push notifications, BullMQ report jobs.
