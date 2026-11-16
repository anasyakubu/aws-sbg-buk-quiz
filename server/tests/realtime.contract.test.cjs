/** In-memory game contract checks: no MongoDB or public network needed. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const writes = [];
  const quiz = {
    _id: 'quiz-1', title: 'Campus Quiz', questions: [{
      type: 'multiple_choice', text: 'Which option?', options: ['A', 'B'],
      correctIndexes: [0], timeLimit: 20, points: 1000,
    }],
  };
  const fakeModule = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, '../src/socket/game.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } });
  const mocks = {
    nanoid: { customAlphabet: () => () => '123456' },
    '../models/Quiz': { Quiz: { findOne: () => ({ lean: async () => quiz }) } },
    '../models/GameResult': { GameResult: { create: async row => { writes.push(row); } } },
    '../utils/jwt': { verifyToken: token => ({ sub: token }) },
  };
  vm.runInNewContext(outputText, {
    module: fakeModule, exports: fakeModule.exports,
    require: id => { if (!(id in mocks)) throw Error(`Unexpected import: ${id}`); return mocks[id]; },
    setTimeout: () => ({}), clearTimeout: () => {}, Date, Map, Set, console,
  }, { filename: 'game.js' });

  class Socket {
    constructor(id, token) {
      this.id = id;
      this.handshake = { auth: { token } };
      this.data = {};
      this.handlers = {};
      this.rooms = new Set();
      this.events = [];
    }
    on(name, fn) { this.handlers[name] = fn; }
    join(name) { this.rooms.add(name); }
    leave(name) { this.rooms.delete(name); }
    async ask(name, data) {
      let response;
      await this.handlers[name](data, r => { response = r; });
      return response;
    }
  }
  const sockets = new Map();
  const io = {
    sockets: { sockets },
    on(event, cb) { if (event === 'connection') this.connected = cb; },
    to(room) { return { emit: (name, data) => {
      for (const s of sockets.values()) {
        if (s.id === room || s.rooms.has(room)) s.events.push({ name, data });
      }
    } }; },
  };
  fakeModule.exports.registerGameHandlers(io);
  function connect(id, token) {
    const s = new Socket(id, token);
    sockets.set(id, s);
    io.connected(s);
    return s;
  }
  return { io, connect, writes };
}

test('host creates a game and a player joins, answers safely, and reconnects', async () => {
  const { connect, writes } = fixture();
  const host = connect('host-socket', 'host-user');
  const created = await host.ask('host:create', { quizId: 'quiz-1' });
  assert.equal(created.pin, '123456');
  const playerId = '11111111-1111-4111-8111-111111111111';
  const player = connect('player-socket');
  const joined = await player.ask('player:join', { pin: created.pin, playerId, name: 'First' });
  assert.equal(joined.state.status, 'lobby');
  assert.deepEqual((await host.ask('host:start', { pin: created.pin })).ok, true);
  const invalid = await player.ask('player:answer', { pin: created.pin, playerId, questionIndex: 0, answer: [-1] });
  assert.equal(invalid.error, 'Invalid answer.');
  assert.equal((await player.ask('player:answer', { pin: created.pin, playerId, questionIndex: 0, answer: [0] })).ok, true);

  const recoveredHost = connect('host-reconnected', 'host-user');
  const hostState = await recoveredHost.ask('host:rejoin', { pin: created.pin });
  assert.equal(hostState.state.status, 'reveal');
  assert.equal(hostState.reveal.correctIndexes[0], 0);

  const recoveredPlayer = connect('player-reconnected');
  const playerState = await recoveredPlayer.ask('player:join', { pin: created.pin, playerId, name: 'First' });
  assert.equal(playerState.revealedResult.correct, true);
  assert.equal(playerState.revealedResult.score > 0, true);

  assert.equal((await recoveredHost.ask('host:next', { pin: created.pin })).ended, true);
  assert.equal(writes.length, 1);
  assert.equal((await recoveredHost.ask('host:end', { pin: created.pin })).ok, true);
  assert.equal(writes.length, 1, 'ending twice must not duplicate results');
  const final = await recoveredPlayer.ask('player:join', { pin: created.pin, playerId, name: 'First' });
  assert.equal(final.finale.quizTitle, 'Campus Quiz');
});

test('a kicked player cannot rejoin the same live lobby', async () => {
  const { connect } = fixture();
  const host = connect('host2', 'host-user');
  const { pin } = await host.ask('host:create', { quizId: 'quiz-1' });
  const playerId = '22222222-2222-4222-8222-222222222222';
  const p = connect('player2');
  assert.ok((await p.ask('player:join', { pin, playerId, name: 'Kick Me' })).you);
  assert.equal((await host.ask('host:kick', { pin, playerId })).ok, true);
  assert.equal((await p.ask('player:join', { pin, playerId, name: 'Kick Me' })).error, 'You were removed from this game.');
  assert.equal(p.rooms.has(`game:${pin}`), false);
});

test('paused games recover their active question and reject answers from a different socket', async () => {
  const { connect } = fixture();
  const host = connect('host3', 'host-user');
  const { pin } = await host.ask('host:create', { quizId: 'quiz-1' });
  const playerId = '33333333-3333-4333-8333-333333333333';
  const first = connect('player3');
  await first.ask('player:join', { pin, playerId, name: 'Still Here' });
  await host.ask('host:start', { pin });
  assert.equal((await host.ask('host:pause', { pin })).ok, true);
  const hostReturn = connect('host4', 'host-user');
  const restoredHost = await hostReturn.ask('host:rejoin', { pin });
  assert.equal(restoredHost.state.status, 'paused');
  assert.equal(restoredHost.activeQuestion.question.text, 'Which option?');
  const playerReturn = connect('player4');
  const restoredPlayer = await playerReturn.ask('player:join', { pin, playerId, name: 'Still Here' });
  assert.equal(restoredPlayer.activeQuestion.question.index, 0);
  assert.equal(restoredPlayer.state.status, 'paused');
  assert.equal((await first.ask('player:answer', { pin, playerId, questionIndex: 0, answer: [0] })).error,
    'You are not in this game.');
  await hostReturn.ask('host:resume', { pin });
  assert.equal((await playerReturn.ask('player:answer', { pin, playerId, questionIndex: 0, answer: [0] })).ok, true);
});
