const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', relative);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require: id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('node:')) return require(id);
    throw new Error(`Missing mocked module ${id} in ${relative}`);
  }, console, Buffer, Promise, Object, Array, String, Date, setTimeout, clearTimeout }, {filename});
  return module.exports;
}

function response() {
  return {
    statusCode: 200, data: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };
}

test('OAuth state is random, bound to its cookie, and rejects missing/tampered values', () => {
  const oauth = load('utils/googleOAuth.ts');
  const state = oauth.newGoogleState();
  const cookie = oauth.googleStateCookie(state, 'register');
  assert.match(state, /^[0-9a-f]{64}$/);
  assert.equal(oauth.readCookie('x=ignored; sbg_google_oauth=' + cookie + '; p=1', oauth.GOOGLE_COOKIE), cookie);
  assert.equal(oauth.verifyGoogleState(state, cookie), 'register');
  assert.equal(oauth.verifyGoogleState(state, undefined), null);
  assert.equal(oauth.verifyGoogleState(state + 'a', cookie), null);
  assert.equal(oauth.verifyGoogleState(oauth.newGoogleState(), cookie), null);
  assert.equal(oauth.verifyGoogleState(state, `${state}.https://evil.com`), null);
});

test('email/password registration creates a user and returns token; duplicate is rejected', async () => {
  let stored = null;
  const User = {
    findOne: async ({ email }) => stored?.email === email ? stored : null,
    create: async fields => { stored = {...fields, id:'u1', role:'host'}; return stored; },
  };
  // zod schemas are unnecessary to exercise controller behavior because
  // Express validation occurs before the controller.
  const passthrough = () => {
    const chain = new Proxy({}, { get: () => () => chain });
    return chain;
  };
  const controller = load('controllers/auth.controller.ts', {
    bcryptjs: { hash: async () => 'hashed', compare: async () => true },
    zod: { z: { object: () => ({}), string: passthrough, enum: passthrough, literal: passthrough } },
    '../models/User': { User },
    '../utils/jwt': { signToken: () => 'signed-token' },
    '../middleware/auth': {},
  });
  const input = { name:'Test Student', email:'student@example.com', password:'strong-pass', department:'Computer Science' };
  const created = response();
  await controller.register({body:input}, created);
  assert.equal(created.statusCode, 201);
  assert.equal(created.data.token, 'signed-token');
  assert.equal(created.data.user.email, 'student@example.com');
  assert.equal(created.data.user.passwordHash, undefined);
  assert.equal(stored.passwordHash, 'hashed');
  const duplicate = response();
  await controller.register({body:input}, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.match(duplicate.data.error, /already exists/i);
});

test('async handler forwards Promise rejections to the Express error handler', async () => {
  const { asyncHandler } = load('middleware/asyncHandler.ts');
  const problem = new Error('MongoDB failed');
  const wrapped = asyncHandler(async () => { throw problem; });
  const reported = await new Promise(resolve => wrapped({}, {}, resolve));
  assert.equal(reported, problem);
});

test('duplicate email race is reported as HTTP 409 rather than an unhandled 500', () => {
  const { errorHandler } = load('middleware/error.ts');
  const res = response();
  errorHandler({code:11000}, {}, res, () => {});
  assert.equal(res.statusCode, 409);
  assert.match(res.data.error, /already exists/i);
});

test('Google strategy accepts verified primary emails and safely matches users by googleId', async () => {
  let verify;
  let created;
  let user = null;
  class FakeGoogleStrategy { constructor(_options, fn) { verify = fn; } }
  const passport = { use(name, strategy) { assert.equal(name, 'google'); assert.ok(strategy); } };
  const User = {
    findOne: async query => user && (query.googleId === user.googleId || query.email === user.email) ? user : null,
    create: async attrs => { created = attrs; user = {...attrs, role:'host', id:'u2'}; return user; },
  };
  const { configurePassport, googleConfigured } = load('config/passport.ts', {
    passport: {__esModule:true, default:passport},
    'passport-google-oauth20': { Strategy: FakeGoogleStrategy },
    '../models/User': {User},
    './env': {env:{google:{clientId:'id',clientSecret:'secret'},serverUrl:'https://api.example.com'}},
  });
  assert.equal(googleConfigured, true);
  assert.equal(configurePassport(), true);
  const done = (profile) => new Promise((resolve, reject) => verify('', '', profile, (err, u) => err ? reject(err) : resolve(u)));
  const gmail = {id:'google-id', emails:[{value:'User@Gmail.com'}], displayName:'User Name', _json:{verified_email:true}};
  const record = await done(gmail);
  assert.equal(record.email, 'user@gmail.com');
  assert.equal(created.googleId, 'google-id');
  assert.equal((await done(gmail)), record, 'same Google ID returns same user');
  await assert.rejects(done({id:'other-id',emails:[{value:'User@Gmail.com'}],_json:{verified_email:false}}), /verify/i);
});

test('auth route exposes providers endpoint and follows registered Google callback path', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/auth.ts'), 'utf8');
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.ts'), 'utf8');
  assert.match(routeSource, /router\.get\('\/providers'/);
  assert.match(routeSource, /router\.post\('\/register', authLimiter, validate\(auth\.registerSchema\), asyncHandler\(auth\.register\)/);
  assert.match(routeSource, /router\.get\('\/google\/callback'/);
  assert.match(routeSource, /#token=/);
  assert.match(indexSource, /router\.use\('\/auth', authRoutes\)/);
});
