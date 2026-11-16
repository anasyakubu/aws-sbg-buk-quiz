/** MongoDB-backed live HTTP handler tests with an in-memory Mongoose substitute.
 * Run with `node --test tests/*.test.cjs`; no external database required. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const rooms = [];
  const participants = [];
  const reports = [];
  const routes = {};
  const q = { type: 'multiple_choice', text: 'AWS?', options: ['Yes', 'No'],
    correctIndexes: [0], timeLimit: 30, points: 1000 };
  const quiz = { _id: 'quiz-123', owner: 'host-user', title: 'Campus Quiz', questions: [q] };
  const router = {
    post(route, ...handlers) { routes[`POST ${route}`] = handlers.at(-1); },
    get(route, ...handlers) { routes[`GET ${route}`] = handlers.at(-1); },
  };
  const compare = (actual, wanted) => {
    if (wanted && typeof wanted === 'object' && !(wanted instanceof Date) && !Array.isArray(wanted)) {
      if ('$ne' in wanted) return actual !== wanted.$ne && !(Array.isArray(actual) && actual.includes(wanted.$ne));
      if ('$lte' in wanted) return actual <= wanted.$lte;
      if ('$gt' in wanted) return actual > wanted.$gt;
    }
    return String(actual) === String(wanted);
  };
  const matches = (obj, where) => Object.entries(where || {}).every(([key, wanted]) => {
    if (key === 'answers.questionIndex') return compare(obj.answers.map(a => a.questionIndex), wanted);
    if (key === 'expiresAt') return obj.expiresAt > wanted.$gt;
    if (key === 'status' && wanted && typeof wanted === 'object' && '$ne' in wanted) return obj.status !== wanted.$ne;
    return compare(obj[key], wanted);
  });
  const updateDoc = (obj, u) => {
    for (const [k, v] of Object.entries(u.$set || {})) obj[k] = v;
    for (const [k, v] of Object.entries(u.$inc || {})) obj[k] = (obj[k] || 0) + v;
    for (const [k, v] of Object.entries(u.$max || {})) obj[k] = Math.max(obj[k] || 0, v);
    for (const [k, v] of Object.entries(u.$push || {})) (obj[k] ??= []).push(v);
  };
  const model = rows => ({
    create: async data => { const doc = structuredClone(data); rows.push(doc); return doc; },
    findOne: query => ({ lean: async () => rows.find(row => matches(row, query)) || null }),
    find: query => ({ lean: async () => rows.filter(row => matches(row, query)) }),
    countDocuments: async query => rows.filter(row => matches(row, query)).length,
    exists: async query => rows.some(row => matches(row, query)),
    updateOne: async (query, update) => {
      const row = rows.find(row => matches(row, query));
      if (!row) return { modifiedCount: 0 };
      updateDoc(row, update); return { modifiedCount: 1 };
    },
    findOneAndUpdate: (query, update) => ({ lean: async () => {
      const row = rows.find(row => matches(row, query));
      if (!row) return null;
      updateDoc(row, update); return row;
    } }),
  });
  const mongoose = { isValidObjectId: id => Boolean(id), Types: { ObjectId: class { constructor(x) { return x; } } } };
  const mocks = {
    express: { Router: () => router },
    mongoose: { __esModule: true, default: mongoose },
    crypto: require('node:crypto'),
    '../models/LiveGame': { LiveGame: model(rooms) },
    '../models/LivePlayer': { LivePlayer: model(participants) },
    '../models/Quiz': { Quiz: { findOne: () => ({ lean: async () => quiz }) } },
    '../models/GameResult': { GameResult: { create: async row => reports.push(row) } },
    '../middleware/auth': { requireAuth: (_req, _res, next) => next?.() },
    '../utils/jwt': { verifyToken: token => {
      if (token !== 'host-token' && token !== 'player-token') throw new Error('Bad JWT');
      return { sub: token === 'host-token' ? 'host-user' : 'player-user' };
    } },
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../src/routes/live.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS, esModuleInterop: true }, reportDiagnostics: true });
  assert.equal(js.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const result = { exports: {} };
  vm.runInNewContext(js.outputText, { module: result, exports: result.exports,
    require: id => { if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`); return mocks[id]; },
    Date, String, Number, Math, Promise, Array, Object, Set, console }, { filename: 'live.js' });
  async function call(method, pattern, params = {}, body = {}, query = {}, auth) {
    const fn = routes[`${method} ${pattern}`];
    assert(fn, `missing route ${method} ${pattern}`);
    const req = { params, body, query, user: { _id: 'host-user' },
      headers: auth ? { authorization: `Bearer ${auth}` } : {} };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; } };
    let caught = null;
    await fn(req, res, err => { caught = err; });
    if (caught) throw caught;
    return { status: res.statusCode, data: res.data };
  }
  return { call, rooms, participants, reports };
}

const PIN = '11111111-1111-4111-8111-111111111111';
test('Vercel HTTP game: host, join, start, score once, reveal, final report', async () => {
  const { call, rooms, participants, reports } = fixture();
  const created = await call('POST', '/create', {}, { quizId: 'quiz-123' });
  assert.equal(created.status, 201);
  const pin = created.data.pin;
  assert.match(pin, /^\d{6}$/);
  const p = { pin };
  const joined = await call('POST', '/:pin/join', p, { playerId: PIN, name: 'Player One' });
  assert.equal(joined.data.ok, true);
  const guest = await call('GET', '/:pin/state', p, {}, { playerId: PIN });
  assert.equal(guest.data.state.status, 'lobby');
  assert.equal(guest.data.state.playerCount, 1);
  const notHost = await call('POST', '/:pin/host/:command', { pin, command: 'start' });
  assert.equal(notHost.status, 403);
  await call('POST', '/:pin/host/:command', { pin, command: 'start' }, {}, {}, 'host-token');
  const question = await call('GET', '/:pin/state', p, {}, { playerId: PIN });
  assert.equal(question.data.activeQuestion.question.correctIndexes, undefined, 'never reveal answer before scoring');
  const attempt = { playerId: PIN, questionIndex: 0, answer: [0] };
  assert.equal((await call('POST', '/:pin/answer', p, attempt)).data.ok, true);
  assert.equal((await call('POST', '/:pin/answer', p, attempt)).data.duplicate, true);
  assert.equal(participants[0].answers.length, 1);
  assert.ok(participants[0].score > 0);
  assert.equal(rooms[0].status, 'reveal');
  const revealed = await call('GET', '/:pin/state', p, {}, { playerId: PIN });
  assert.equal(revealed.data.revealedResult.correct, true);
  assert.deepEqual([...revealed.data.revealedResult.correctIndexes], [0]);
  const finished = await call('POST', '/:pin/host/:command', { pin, command: 'next' }, {}, {}, 'host-token');
  assert.equal(finished.data.ended, true);
  assert.equal(reports.length, 1);
  const rejoined = await call('GET', '/:pin/state', p, {}, { playerId: PIN });
  assert.equal(rejoined.data.state.status, 'ended');
  assert.equal(rejoined.data.finale.totalPlayers, 1);
  await call('POST', '/:pin/host/:command', { pin, command: 'end' }, {}, {}, 'host-token');
  assert.equal(reports.length, 1, 'no duplicate final game report');
});

test('Vercel HTTP game: pause, resume, kick, reconnect from another function', async () => {
  const { call, rooms } = fixture();
  const { data: { pin } } = await call('POST', '/create', {}, { quizId: 'quiz-123' });
  await call('POST', '/:pin/join', { pin }, { playerId: PIN, name: 'Cloud Ninja' });
  const host = async command => call('POST', '/:pin/host/:command', { pin, command }, {}, {}, 'host-token');
  await host('start');
  await host('pause');
  assert.equal(rooms[0].status, 'paused');
  await host('resume');
  assert.equal(rooms[0].status, 'question');
  rooms[0].questionDeadline = Date.now() - 1;
  const expired = await call('GET', '/:pin/state', { pin }, {}, { playerId: PIN });
  assert.equal(expired.data.state.status, 'reveal');
  assert.equal((await call('POST', '/:pin/host/:command', { pin, command: 'kick' }, { playerId: PIN }, {}, 'host-token')).data.ok, true);
  const kicked = await call('GET', '/:pin/state', { pin }, {}, { playerId: PIN });
  assert.equal(kicked.data.kicked, true);
  assert.equal((await call('POST', '/:pin/join', { pin }, { playerId: PIN, name: 'Cloud Ninja' })).status, 403);
});
