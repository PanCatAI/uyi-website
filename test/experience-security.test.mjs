import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/experience.js';

let fixtureId = 0;
const requestId = '5d5b7bd8-af5b-4c52-9315-5bd6c129ed72';
const payload = {
  kind: 'experience_report', email: 'Visitor+UYI@Example.com', requestId,
  experienceDate: '2026-11-27', activities: ['ai_space'], completion: 'no', reuse: 'no',
  comment: '操作を試しましたが、思った場所に置けませんでした。元に戻せると助かります。',
  recordLink: '', website: '', language: 'ja', source: 'experience',
};
const credentials = () => ({
  FEISHU_APP_ID: `feedback-fixture-${++fixtureId}`, FEISHU_APP_SECRET: 'fixture-secret',
  FEISHU_APP_TOKEN: 'fixture-base', FEISHU_TABLE_ID: 'tblParticipants', FEISHU_FEEDBACK_TABLE_ID: 'tblFeedback',
});
const request = (body = payload, headers = {}) => new Request('https://uyi.live/api/experience', {
  method: 'POST', headers: { Origin: 'https://uyi.live', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const token = () => Response.json({ code: 0, tenant_access_token: 'fixture-token', expire: 7200 });
const records = (items = [], has_more = false) => Response.json({ code: 0, data: { items, has_more } });
const saved = () => Response.json({ code: 0, data: { record: { record_id: 'recFeedback' } } });

function provider(t, { participant = [], mutateCreate, mutateSearch } = {}) {
  const rows = [];
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.startsWith('https://open.feishu.cn/open-apis/'), 'external links are never fetched');
    assert.equal(options.method, 'POST', 'no public flow changes existing records');
    const body = JSON.parse(options.body);
    calls.push({ url, body, rawBody: options.body });
    if (url.endsWith('/tenant_access_token/internal')) return token();
    if (url.includes('/search?')) {
      if (mutateSearch) {
        const override = mutateSearch(url, body, rows);
        if (override) return override;
      }
      const source = url.includes('/tblParticipants/') ? participant : rows;
      const filtered = source.filter(row => body.filter.conditions.every(condition => row.fields[condition.field_name] === condition.value[0]));
      return records(filtered.map(row => ({ record_id: row.record_id, fields: Object.fromEntries(body.field_names.map(name => [name, row.fields[name]])) })));
    }
    if (mutateCreate) return mutateCreate(url, body, rows);
    rows.push({ record_id: 'recFeedback', fields: body.fields });
    return saved();
  });
  return { rows, calls };
}

test('rejects unsupported fields and malformed report data before any provider call', async t => {
  let fetched = 0;
  t.mock.method(globalThis, 'fetch', async () => { fetched++; throw new Error('must not fetch'); });
  const invalid = [
    [null, 'invalid_request'], [[], 'invalid_request'],
    [{ ...payload, kind: 'supplement' }, 'invalid_request'],
    [{ ...payload, participantId: 'recSomeone' }, 'invalid_request'],
    [{ ...payload, Credit: 999 }, 'invalid_request'],
    [{ ...payload, status: '已核验' }, 'invalid_request'],
    [{ ...payload, requestId: ['bad'] }, 'invalid_request'],
    [{ ...payload, requestId: 'not-a-uuid' }, 'invalid_request'],
    [{ ...payload, website: 'bot.example' }, 'invalid_request'],
    [{ ...payload, website: undefined }, 'invalid_request'],
    [{ ...payload, language: 'zh' }, 'invalid_request'],
    [{ ...payload, email: 'bad-address' }, 'invalid_email'],
    [{ ...payload, email: `${'x'.repeat(65)}@example.com` }, 'invalid_email'],
    [{ ...payload, experienceDate: '2026-02-30' }, 'invalid_report'],
    [{ ...payload, experienceDate: '2026-2-03' }, 'invalid_report'],
    [{ ...payload, experienceDate: '9999-12-31' }, 'invalid_report'],
    [{ ...payload, activities: [] }, 'invalid_report'],
    [{ ...payload, activities: ['studio', 'studio'] }, 'invalid_report'],
    [{ ...payload, activities: ['bogus'] }, 'invalid_report'],
    [{ ...payload, activities: 'studio' }, 'invalid_report'],
    [{ ...payload, completion: '__proto__' }, 'invalid_report'],
    [{ ...payload, reuse: 'approved' }, 'invalid_report'],
    [{ ...payload, comment: ' ' }, 'invalid_report'],
    [{ ...payload, comment: 'あ'.repeat(1501) }, 'invalid_report'],
    [{ ...payload, recordLink: 'javascript:alert(1)' }, 'invalid_report'],
    [{ ...payload, recordLink: 'file:///private/data' }, 'invalid_report'],
    [{ ...payload, recordLink: 'https://username:password@example.com' }, 'invalid_report'],
    [{ ...payload, recordLink: `https://example.com/${'x'.repeat(2000)}` }, 'invalid_report'],
    [{ ...payload, recordLink: 123 }, 'invalid_report'],
  ];
  for (const [body, error] of invalid) {
    const response = await onRequest({ request: request(body), env: credentials() });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(await response.json(), { error });
  }
  assert.equal(fetched, 0);
});

test('rejects empty/invalid supplement and client attempts to overwrite four answers', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not fetch'); });
  const supplement = { kind: 'experience_supplement', email: payload.email, requestId,
    originalReportId: 'c14b1770-e0de-436d-b2aa-89f34be4014a', website: '', recordLink: '', note: ' ' };
  for (const body of [supplement, { ...supplement, originalReportId: requestId, note: 'update' },
    { ...supplement, originalReportId: 'bad', note: 'update' }, { ...supplement, note: 'x'.repeat(1501) }]) {
    const response = await onRequest({ request: request(body), env: credentials() });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'invalid_supplement' });
  }
  const response = await onRequest({ request: request({ ...supplement, comment: 'replace old answer' }), env: credentials() });
  assert.deepEqual(await response.json(), { error: 'invalid_request' });
});

test('enforces method, exact same origin, JSON and 16KiB streamed body cap', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not fetch'); });
  for (const [req, status] of [
    [new Request('https://uyi.live/api/experience'), 405],
    [request(payload, { Origin: 'https://evil.example' }), 403],
    [request(payload, { Origin: 'null' }), 403],
    [request(payload, { 'Sec-Fetch-Site': 'cross-site' }), 403],
    [request(payload, { 'Content-Type': 'text/plain' }), 415],
    [request(payload, { 'Content-Length': '16385' }), 413],
    [request({ ...payload, comment: 'x'.repeat(17000) }), 413],
    [new Request('https://uyi.live/api/experience', { method: 'POST', headers: { Origin: 'https://uyi.live', 'Content-Type': 'application/json' }, body: '{' }), 400],
  ]) {
    const response = await onRequest({ request: req, env: credentials() });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    if (status === 405) assert.equal(response.headers.get('Allow'), 'POST');
  }
});

test('fails closed without existing credentials or a distinct raw table ID', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not fetch'); });
  const base = credentials();
  for (const env of [{ ...base, FEISHU_APP_SECRET: '' }, { ...base, FEISHU_FEEDBACK_TABLE_ID: '' },
    { ...base, FEISHU_FEEDBACK_TABLE_ID: base.FEISHU_TABLE_ID }, { ...base, FEISHU_FEEDBACK_TABLE_ID: '../other-base' }]) {
    const response = await onRequest({ request: request(), env });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'unavailable' });
  }
});

test('uses Japan calendar day and keeps negative/blocked feedback without brittle sentiment checks', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-28T15:05:00Z'));
  const { rows } = provider(t);
  const response = await onRequest({ request: request({ ...payload, experienceDate: '2026-11-29', activities: ['studio', 'setup'], completion: 'blocked', language: undefined, source: 'unknown' }), env: credentials() });
  assert.equal(response.status, 200);
  assert.equal(rows[0].fields['实际体验日'], '2026-11-29');
  assert.equal(rows[0].fields['完成情况'], '試す前に止まった');
  assert.equal(rows[0].fields['再用意愿'], '今は使わない');
  assert.equal(rows[0].fields['提交时间'], undefined, 'native Feishu creation time is not written');
});

test('normalizes source without expanding stored fields, preserves raw comment and only stores external link', async t => {
  const { rows } = provider(t);
  const comment = '=1+1\n改善点：戻る操作がほしい。';
  const response = await onRequest({ request: request({ ...payload, comment: `  ${comment}  `, recordLink: 'http://127.0.0.1/private-record', source: { unrelated: true } }), env: credentials() });
  assert.equal(response.status, 200);
  assert.equal(rows[0].fields['具体反馈'], comment, 'text is stored as text; not evaluated or rewritten');
  assert.equal(rows[0].fields['记录链接'], 'http://127.0.0.1/private-record');
  assert.deepEqual(await response.json(), { success: true, reportId: requestId, status: 'received', evidenceStatus: 'present', kind: payload.kind });
});

test('malformed provider lookup fails without manufacturing unmatched state', async t => {
  t.mock.method(console, 'error', () => {});
  for (const invalid of [{ code: 0, data: {} }, { code: 0, data: { items: [{}] } },
    { code: 0, data: { items: [{ record_id: 'rec', fields: [] }] } }]) {
    t.mock.method(globalThis, 'fetch', async url => url.endsWith('/tenant_access_token/internal') ? token() : Response.json(invalid));
    const response = await onRequest({ request: request(), env: credentials() });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'unavailable' });
  }
});

test('retries uncertain writes with identical body and operation ID and never claims unconfirmed saves', async t => {
  t.mock.method(console, 'error', () => {});
  const { calls } = provider(t, { mutateCreate: () => Response.json({ code: 0, data: {} }) });
  const response = await onRequest({ request: request(), env: credentials() });
  assert.equal(response.status, 503);
  const writes = calls.filter(call => !call.url.includes('/search?') && !call.url.endsWith('/tenant_access_token/internal'));
  assert.equal(writes.length, 3);
  assert.equal(new Set(writes.map(call => call.url)).size, 1);
  assert.equal(new Set(writes.map(call => call.rawBody)).size, 1);
  assert.match(new URL(writes[0].url).searchParams.get('client_token'), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(new URL(writes[0].url).searchParams.has('ignore_consistency_check'), false);
});

test('requires stored hash confirmation even after provider returns record_id', async t => {
  t.mock.method(console, 'error', () => {});
  const { rows } = provider(t, { mutateCreate: () => saved() });
  const response = await onRequest({ request: request(), env: credentials() });
  assert.equal(rows.length, 0);
  assert.equal(response.status, 503);
});

test('maps real provider throttle separately from monthly quota and never logs provider text', async t => {
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(args));
  for (const [code, status] of [[1254290, 429], [99991403, 503], [1254001, 503]]) {
    t.mock.method(globalThis, 'fetch', async url => url.endsWith('/tenant_access_token/internal') ? token() :
      Response.json({ code, msg: 'private email, link and secret must stay private' }));
    const response = await onRequest({ request: request(), env: credentials() });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: status === 429 ? 'rate_limited' : 'unavailable' });
    assert.equal(response.headers.get('Retry-After'), status === 429 ? '60' : null);
  }
  assert.ok(logged.length >= 3);
  assert.ok(logged.every(([label, metadata]) => label === 'experience_intake_failed' && Object.keys(metadata).sort().join(',') === 'code,status'));
  assert.equal(JSON.stringify(logged).includes('private'), false);
});

test('invalidates rejected cached app tokens without exposing credentials', async t => {
  t.mock.method(console, 'error', () => {});
  const env = credentials();
  let tokens = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/tenant_access_token/internal')) { tokens++; return token(); }
    return Response.json({ code: 99991663 });
  });
  assert.equal((await onRequest({ request: request(), env })).status, 503);
  assert.equal((await onRequest({ request: request(), env })).status, 503);
  assert.equal(tokens, 2);
});
