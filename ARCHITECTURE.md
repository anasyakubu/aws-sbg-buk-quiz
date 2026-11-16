# Architecture — Vercel-compatible quiz app

Frontend: Vite 6, React 18, TypeScript, Tailwind CSS, vite-plugin-pwa.
API: Express 4, TypeScript, JWT authentication, MongoDB/Mongoose.

## Active game flow

- `POST /api/live/create` records quiz metadata and the question snapshot in
  the MongoDB `LiveGame` collection; returns an unpredictable six-digit PIN.
- `POST /api/live/:pin/join` records one `LivePlayer` document per participant,
  with a stable browser-generated UUID. Players can reconnect without losing
  their score. Kicked players cannot rejoin with the same UUID.
- `GET /api/live/:pin/state` returns a host snapshot, or a private player
  snapshot using a `playerId` query string. The browser polls every ~1.4 sec.
- Host actions run through `POST /api/live/:pin/host/:command`. The API verifies
  the host's JWT against the game's owner and conditionally changes state.
- Participant answers are validated and scored on the server, with an atomic
  MongoDB update on the participant document. Duplicate submissions are rejected
  by the `answers.questionIndex` filter.
- Question timeout is enforced by server-authoritative deadlines. If no
  browser is connected at the deadline, the first subsequent read/command
  transitions it to the reveal state. Pauses store the remaining duration.
- On game completion, the final leaderboard is stored in `LiveGame`, and a
  `GameResult` report is written for history.

No live data depends on process-local state or Socket.IO sticky routing.
Vercel Functions are stateless and can scale across instances. The original
socket module is retained as an optional local legacy backend; the PWA uses
HTTP for live sessions.

## Security

JWT required to host games or execute host controls. Players can join by PIN,
can only view their own current scores/results (correct answers are omitted
until reveal), and answer indexes are checked against the live question.
The API excludes correct answer indices from active question snapshots.
Mongoose update predicates prevent duplicate submissions across serverless
instances. MongoDB, JWT secrets, Google OAuth and AI provider secrets must
all be configured in the Vercel API project.

## Production

Two Vercel projects with Root Directories `client` and `server`; shared
MongoDB Atlas. See `DEPLOYMENT.md`.
