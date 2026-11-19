import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/subscribe.js';

let fixtureId = 0;
const requestId = '5d5b7bd8-af5b-4c52-9315-5bd6c129ed72';
const payload = { email: 'Visitor+UYI@Example.com', language: 'en', source: 'uyi.live', requestId, website: '' };
const credentials = () => ({
  FEISHU_APP_ID: `fixture-app-${++fixtureId}`,
  FEISHU_APP_SECRET: 'fixture-secret',
  FEISHU_APP_TOKEN: 'fixture-base',
  FEISHU_TABLE_ID: 'fixture-table',
});
const request = (body = payload, headers = {}) => new Request('https://uyi.live/api/subscribe', {
  method: 'POST',
  headers: { Origin: 'https://uyi.live', 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const token = () => Response.json({ code: 0, tenant_access_token: 'fixture-token', expire: 7200 });
const records = (items = []) => Response.json({ code: 0, data: { items } });
const saved = () => Response.json({ code: 0, data: { record: { record_id: 'rec-fixture' } } });

test('confirms success only after Feishu returns the created record', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    if (url.endsWith('/tenant_access_token/internal')) return token();
    if (url.includes('/search?')) return records();
    return saved();
  });
  const response = await onRequest({ request: request(), env: credentials() });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].body.filter.conditions, [
    { field_name: '邮箱', operator: 'is', value: ['visitor+uyi@example.com'] },
  ]);
  assert.deepEqual(calls[2].body.fields, {
    邮箱: 'visitor+uyi@example.com', 登记时间: calls[2].body.fields.登记时间,
    语言: 'en', 来源: 'uyi.live', 请求编号: requestId, 状态: '待通知',
  });
  assert.ok(Number.isFinite(calls[2].body.fields.登记时间));
  assert.match(new URL(calls[2].url).searchParams.get('client_token'),
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(new URL(calls[2].url).searchParams.has('ignore_consistency_check'), false);
});

test('keeps duplicate subscription responses private and avoids another write', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/tenant_access_token/internal')) return token();
    assert.ok(url.includes('/search?'));
    return records([{ record_id: 'rec-existing', fields: { 邮箱: 'visitor+uyi@example.com' } }]);
  });
  const response = await onRequest({ request: request(), env: credentials() });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
});

test('uses one provider operation for concurrent registrations of the same email', async t => {
  let searches = 0;
  let releaseSearches;
  const bothSearching = new Promise(resolve => { releaseSearches = resolve; });
  const operationIds = [];
  let stored = false;
  let created = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/tenant_access_token/internal')) return token();
    if (url.includes('/search?')) {
      searches++;
      if (searches <= 2) {
        if (searches === 2) releaseSearches();
        await bothSearching;
        return records();
      }
      return records(stored ? [{ record_id: 'rec-fixture' }] : []);
    }
    operationIds.push(new URL(url).searchParams.get('client_token'));
    if (stored) return Response.json({ code: 1255006 }, { status: 400 });
    stored = true;
    created++;
    return saved();
  });
  const env = credentials();
  const responses = await Promise.all([
    onRequest({ request: request(), env }),
    onRequest({ request: request({ ...payload, email: 'visitor+uyi@example.com', language: 'ja',
      requestId: 'c14b1770-e0de-436d-b2aa-89f34be4014a' }), env }),
  ]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.equal(created, 1);
  assert.equal(operationIds.length, 2);
  assert.equal(new Set(operationIds).size, 1);
});

test('finds the saved record after an ambiguous network failure', async t => {
  let stored = false;
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/tenant_access_token/internal')) return token();
    if (url.includes('/search?')) return records(stored ? [{ record_id: 'rec-fixture' }] : []);
    writes++;
    stored = true;
    throw new TypeError('connection dropped after accepting the request');
  });
  const response = await onRequest({ request: request(), env: credentials() });
  assert.equal(response.status, 200);
  assert.equal(writes, 1);
});

test('retries a write conflict with the same operation and payload', async t => {
  for (const [code, status] of [[1254291, 200], [1254608, 403]]) {
    const writes = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (url.endsWith('/tenant_access_token/internal')) return token();
      if (url.includes('/search?')) return records();
      writes.push({ url, body: options.body });
      if (writes.length === 1) return Response.json({ code }, { status });
      return saved();
    });
    const response = await onRequest({ request: request(), env: credentials() });
    assert.equal(response.status, 200);
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0], writes[1]);
  }
});

test('retries a temporarily unavailable duplicate lookup before creating', async t => {
  let searches = 0;
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/tenant_access_token/internal')) return token();
    if (url.includes('/search?')) {
      searches++;
      if (searches === 1) return Response.json({ code: 1254607 }, { status: 400 });
      return records();
    }
    writes++;
    return saved();
  });
  assert.equal((await onRequest({ request: request(), env: credentials() })).status, 200);
  assert.equal(searches, 2);
  assert.equal(writes, 1);
});

test('keeps an unresolved idempotency conflict as a bounded failure', async t => {
  t.mock.method(console, 'error', () => {});
  const operationIds = [];
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/tenant_access_token/internal')) return token();
    if (url.includes('/search?')) return records();
    operationIds.push(new URL(url).searchParams.get('client_token'));
    return Response.json({ code: 1255006 }, { status: 400 });
  });
  const response = await onRequest({ request: request(), env: credentials() });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
  assert.equal(operationIds.length, 3);
  assert.equal(new Set(operationIds).size, 1);
});

test('rejects an HTTP 200 business error and keeps provider details out of the response', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/tenant_access_token/internal')) return token();
    return Response.json({ code: 1254045, msg: 'private provider details' });
  });
  const response = await onRequest({ request: request(), env: credentials() });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
});

test('does not claim success for an incomplete or malformed provider response', async t => {
  t.mock.method(console, 'error', () => {});
  for (const result of [{ code: 0, data: {} }, { code: 0, data: { items: null } }, { code: 0, data: { items: [{}] } }]) {
    t.mock.method(globalThis, 'fetch', async url => {
      if (url.endsWith('/tenant_access_token/internal')) return token();
      return Response.json(result);
    });
    assert.equal((await onRequest({ request: request(), env: credentials() })).status, 503);
  }
});

test('requires a record receipt even when create returns code zero', async t => {
  t.mock.method(console, 'error', () => {});
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/tenant_access_token/internal')) return token();
    if (url.includes('/search?')) return records();
    writes++;
    return Response.json({ code: 0, data: {} });
  });
  const response = await onRequest({ request: request(), env: credentials() });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
  assert.equal(writes, 3);
});

test('returns rate limiting without success and handles exhausted monthly quota separately', async t => {
  t.mock.method(console, 'error', () => {});
  for (const [code, expectedStatus] of [[1254290, 429], [99991403, 503]]) {
    t.mock.method(globalThis, 'fetch', async url => {
      if (url.endsWith('/tenant_access_token/internal')) return token();
      return Response.json({ code }, { status: 429 });
    });
    const response = await onRequest({ request: request(), env: credentials() });
    assert.equal(response.status, expectedStatus);
    assert.equal((await response.json()).success, undefined);
    if (expectedStatus === 429) assert.equal(response.headers.get('Retry-After'), '60');
  }
});

test('refreshes cached credentials on the next retry after token rejection', async t => {
  t.mock.method(console, 'error', () => {});
  let tokenCalls = 0;
  let rejected = false;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/tenant_access_token/internal')) {
      tokenCalls++;
      return token();
    }
    if (!rejected) {
      rejected = true;
      return Response.json({ code: 99991663 });
    }
    return records([{ record_id: 'rec-existing' }]);
  });
  const env = credentials();
  assert.equal((await onRequest({ request: request(), env })).status, 503);
  assert.equal((await onRequest({ request: request(), env })).status, 200);
  assert.equal(tokenCalls, 2);
});

test('rejects invalid input, honeypot submissions, oversized bodies and cross-origin requests before Feishu', async t => {
  let fetches = 0;
  t.mock.method(globalThis, 'fetch', async () => { fetches++; throw new Error('unexpected network request'); });
  const cases = [
    [request({ ...payload, email: 'not-an-email' }), 400],
    [request({ ...payload, email: 'a'.repeat(65) + '@example.com' }), 400],
    [request({ ...payload, language: 'xx' }), 400],
    [request({ ...payload, requestId: [requestId] }), 400],
    [request({ ...payload, requestId: 'invalid' }), 400],
    [request({ ...payload, website: 'https://spam.example' }), 400],
    [request({ ...payload, email: 'a'.repeat(5000) }), 413],
    [request(payload, { Origin: 'https://unrelated.example' }), 403],
    [request(payload, { Origin: 'null' }), 403],
    [request(payload, { 'Sec-Fetch-Site': 'cross-site' }), 403],
    [request(payload, { 'Content-Type': 'text/plain' }), 415],
    [new Request('https://uyi.live/api/subscribe'), 405],
  ];
  for (const [input, status] of cases) {
    const response = await onRequest({ request: input, env: credentials() });
    assert.equal(response.status, status);
    assert.equal((await response.json()).success, undefined);
  }
  assert.equal(fetches, 0);
});

test('fails closed without server credentials', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected network request'); });
  const response = await onRequest({ request: request(), env: {} });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
});
