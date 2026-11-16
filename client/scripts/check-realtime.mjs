// npm run check:realtime -- https://your-api-project.vercel.app
// Verifies the MongoDB-backed HTTP live-quiz API without requiring a WebSocket.
const origin = process.argv[2]?.replace(/\/$/, '');
if (!origin || !/^https?:\/\//.test(origin)) {
  console.error('Usage: npm run check:realtime -- https://your-vercel-api-domain');
  process.exit(2);
}
const api = async path => {
  const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, data: body };
};
const health = await api('/api/health');
if (health.status !== 200 || health.data?.ok !== true || health.data?.transport !== 'http-polling') {
  throw new Error(`Expected HTTP live transport at /api/health, got: ${JSON.stringify(health)}`);
}
console.log('OK: API is running the Vercel-compatible live quiz transport');
const missing = await api('/api/live/not-a-pin/state');
if (missing.status !== 404 || !/game not found/i.test(missing.data?.error || '')) {
  throw new Error(`The live quiz route is missing or misrouted: ${JSON.stringify(missing)}`);
}
console.log('OK: Live game state endpoint routed correctly (unknown PIN returns game not found)');
console.log('To fully test gameplay, sign in, host a quiz and join it from a second device.');
