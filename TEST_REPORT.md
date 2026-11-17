# Verification report — Vercel quiz / authentication / PWA

## Authentication update (November 2026)

- **11/11 Node.js automated tests passed** (`npm test`), including 6 new authentication checks: Google OAuth nonce and cookie validation, registration success and duplicates, Express async rejection forwarding, MongoDB duplicate conflict handling, verified Google identity creation/reuse, and authentication route wiring.
- **54 TypeScript/TSX source files syntax-transpiled successfully**, without syntax errors. This is **not** a full TypeScript typecheck.
- `npm ci --offline` failed (`ENOTCACHED`); online dependency download did not complete. Therefore, full builds, a real MongoDB signup, browser/E2E testing and a live Google OAuth exchange are **not verified**.
- Review `AUTH_SIGNUP_FIX.md`, then redeploy the Vercel API and frontend to validate against real deployment and credentials.


## Completed locally

- **5/5 Node.js tests passed** using `node --test server/tests/*.test.cjs`.
  - 2 Vercel-compatible HTTP route / MongoDB-state contract tests (database mocked):
    creation, anonymous join, host JWT enforcement, player-safe snapshots,
    server-side answer validation/scoring, duplicate replay protection, early
    reveal, leaderboard results, final report once, pause/resume, expiry, kick.
  - 3 existing legacy Socket.IO game-engine tests passed.
- **50 frontend/backend TypeScript/TSX sources parsed** without syntax errors
  using the installed TypeScript transpiler (this is not full type checking).
- The Vercel API entry is now `server/src/app.ts`; legacy standalone entry
  renamed `server/src/local.ts` to avoid accidental auto-detection.
- Browser code uses `/api/live` requests. It no longer imports Socket.IO client
  or requests `/socket.io/?EIO=4`.
- Client HTML has `mobile-web-app-capable`, and Vite PWA configuration and icon
  files are included.
- The ZIP archive integrity was checked after packaging.

## Not verified in this environment

- `npm ci`, full `tsc` project builds, `vite build`, or Chrome/Safari UI tests.
  Installing npm dependencies was blocked/unavailable in this runtime.
- A real MongoDB Atlas integration test and a multi-device live game on your
  deployed Vercel projects: those need your MongoDB credentials and Vercel
  deployment settings, which were not provided and are not included in the ZIP.
- OAuth and AI-provider requests, which require third-party API credentials.

## How to verify after deploying

1. Redeploy **API** from `server/` and **frontend** from `client/`.
2. Confirm `/api/health` shows `"transport":"http-polling"`.
3. From `client/`: `npm run check:realtime -- https://YOUR-API.vercel.app`.
4. Join one room from two devices, start/answer/pause/reveal/end, reload,
   inspect the report, and test PWA installation on a supported device.

Expected live-update latency is about 1–2 seconds, not WebSocket immediacy.
