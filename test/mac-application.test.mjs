import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/subscribe.js';

// This provider is an in-memory boundary mock. Every request is inspected;
// no test calls Feishu or needs a real account, table, or credential.
const requestId = '5d5b7bd8-af5b-4c52-9315-5bd6c129ed72';
const nextRequestId = 'c14b1770-e0de-436d-b2aa-89f34be4014a';
const normalizedEmail = 'creator+uyi@example.com';
let fixtureId = 0;
const credentials = () => ({
  FEISHU_APP_ID: `mac-application-fixture-${++fixtureId}`,
  FEISHU_APP_SECRET: 'fixture-secret-only',
  FEISHU_APP_TOKEN: 'fixture-base',
  FEISHU_TABLE_ID: 'fixture-table',
});
const application = (overrides = {}) => ({
  kind: 'mac_application', email: ' Creator+UYI@Example.com ',
  language: 'ja', requestId, website: '',
  macConfirmed: true,
  macEnvironment: 'MacBook Air / M2 / macOS 15',
  creativeExperience: '3d',
  experienceDirection: 'studio_experienced',
  intent: '椅子を生成してAI空間に置き、操作で迷った点を具体的に伝えたいです。',
  xAccount: '@creator_fixture',
  source: 'homepage',
  ...overrides,
});
const request = (body = application(), headers = {}) => new Request('https://uyi.live/api/subscribe', {
  method: 'POST',
  headers: { Origin: 'https://uyi.live', 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const clone = value => JSON.parse(JSON.stringify(value));
const sourceURL = source => `uyi.live/apply/?source=${source}`;
const applicationFields = (input = application()) => ({
  Mac环境: input.macEnvironment.trim(),
  创作经验: {
    '3d': '3D制作・3D生成の経験あり',
    other: 'その他の創作経験あり',
    none: '創作経験なし',
  }[input.creativeExperience],
  报名意向: input.intent.trim(),
  ...(input.xAccount.trim() ? { X账号: input.xAccount.trim() } : {}),
  体验方向: {
    ai_space: 'AI空間を中心に試したい',
    studio_experienced: 'AI空間とUYI Studio（3D生成経験あり）',
    studio_new: 'AI空間とUYI Studio（3D生成経験なし）',
    undecided: '説明を聞いてから決めたい',
  }[input.experienceDirection],
  报名来源: {
    homepage: 'UYI公式サイト', event: 'イベント・先行体験ページ',
    creator: 'イベント・先行体験ページ', outreach: 'UYIからの直接のお誘い',
    referral: '知人・クリエイターの紹介', other: 'その他',
  }[input.source] || 'その他',
});

function mockProvider(t, initialRecords = [], hooks = {}) {
  const state = {
    records: clone(initialRecords), calls: [], writes: [],
    createOperationIds: [], operations: new Map(),
  };
  t.mock.method(globalThis, 'fetch', async (rawURL, options = {}) => {
    const url = new URL(rawURL);
    const body = options.body ? JSON.parse(options.body) : undefined;
    const method = options.method || 'GET';
    let operation;
    if (url.pathname.endsWith('/auth/v3/tenant_access_token/internal') && method === 'POST') operation = 'token';
    else if (url.pathname.endsWith('/records/search') && method === 'POST') operation = 'search';
    else if (url.pathname.endsWith('/records') && method === 'POST') operation = 'create';
    else if (/\/records\/[^/]+$/.test(url.pathname) && method === 'PUT') operation = 'update';
    else assert.fail(`Unexpected provider request: ${method} ${url.pathname}`);
    const call = { operation, url: url.href, method, body };
    state.calls.push(call);
    if (operation !== 'token') {
      assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    }
    const early = await hooks.before?.(call, state);
    if (early !== undefined) return early;
    let result;
    if (operation === 'token') {
      result = { code: 0, tenant_access_token: 'fixture-token', expire: 7200 };
    } else if (operation === 'search') {
      const conditions = body.filter?.conditions;
      assert.equal(body.filter?.conjunction, 'and');
      assert.deepEqual(conditions, [
        { field_name: '邮箱', operator: 'is', value: [normalizedEmail] },
      ]);
      const matches = state.records.filter(record => {
        const email = record.fields.邮箱;
        return (Array.isArray(email) ? email.map(item => item.text).join('') : email) === normalizedEmail;
      });
      const pageSize = Number(url.searchParams.get('page_size')) || matches.length;
      const projected = matches.slice(0, pageSize).map(record => ({
        record_id: record.record_id,
        fields: body.field_names ? Object.fromEntries(body.field_names
          .filter(name => Object.hasOwn(record.fields, name))
          .map(name => [name, clone(record.fields[name])])) : clone(record.fields),
      }));
      result = { code: 0, data: { items: projected, has_more: matches.length > pageSize } };
    } else if (operation === 'create') {
      const operationId = url.searchParams.get('client_token');
      assert.match(operationId || '', /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
      assert.equal(url.searchParams.has('ignore_consistency_check'), false);
      state.createOperationIds.push(operationId);
      let record = state.operations.get(operationId);
      if (!record) {
        record = { record_id: `rec-application-${state.records.length + 1}`, fields: clone(body.fields) };
        state.records.push(record);
        state.operations.set(operationId, record);
        state.writes.push({ operation, record_id: record.record_id, fields: clone(body.fields) });
      }
      result = { code: 0, data: { record: clone(record) } };
    } else {
      const recordId = decodeURIComponent(url.pathname.split('/').at(-1));
      const record = state.records.find(item => item.record_id === recordId);
      assert.ok(record, 'Updates must address an existing record ID');
      Object.assign(record.fields, clone(body.fields));
      state.writes.push({ operation, record_id: recordId, fields: clone(body.fields) });
      result = { code: 0, data: { record: clone(record) } };
    }
    const late = await hooks.after?.(call, state, clone(result));
    return late === undefined ? Response.json(result) : late;
  });
  return state;
}

async function submit(body, env = credentials()) {
  return onRequest({ request: request(body), env });
}
async function expectSuccess(response) {
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
}
async function expectUnavailable(response) {
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
}

test('maps a complete Mac application into the configured table and confirms durable storage', async t => {
  const state = mockProvider(t);
  const input = application({
    source: 'event', macEnvironment: '  MacBook Air / M2 / macOS 15  ',
    intent: '  小物を置いてサイズ調整の問題を確認したいです。  ', xAccount: '  @creator_fixture  ',
  });
  await expectSuccess(await submit(input));
  assert.equal(state.records.length, 1);
  const record = state.records[0];
  assert.deepEqual(record.fields, {
    邮箱: normalizedEmail, 登记时间: record.fields.登记时间,
    语言: 'ja', 来源: sourceURL('event'), 请求编号: requestId, 状态: '待通知',
    ...applicationFields(input), 运营进度: '待筛选',
  });
  assert.ok(Number.isFinite(record.fields.登记时间));
  const createIndex = state.calls.findIndex(call => call.operation === 'create');
  assert.ok(createIndex >= 0);
  assert.ok(state.calls.slice(createIndex + 1).some(call => call.operation === 'search'),
    'Read back the stored record; a create operation receipt can belong to an earlier legacy subscription');
  assert.ok(state.calls.filter(call => call.operation === 'search')
    .every(call => new URL(call.url).searchParams.get('page_size') === '2'),
  'Lookups must detect an existing duplicate email instead of silently picking one record');
});

test('allows an empty optional X account and relies on explicit Mac self-confirmation rather than keyword guessing', async t => {
  const state = mockProvider(t);
  const input = application({ xAccount: '   ', macEnvironment: '自宅のノート端末・機種確認中' });
  await expectSuccess(await submit(input));
  assert.equal(state.records[0].fields.Mac环境, input.macEnvironment);
  assert.equal(Object.hasOwn(state.records[0].fields, 'X账号'), false);
});

test('supplements the same legacy subscription record without changing its original or manual fields', async t => {
  const original = {
    record_id: 'rec-legacy-existing',
    fields: {
      邮箱: normalizedEmail, 登记时间: 1700000000000, 语言: 'en', 来源: 'uyi.live',
      请求编号: 'original-operation', 状态: '已通知',
      Mac环境: '', 创作经验: null, 报名意向: '', 体验方向: '', 报名来源: '',
      运营进度: '已注册', 邀请码: 'TEST-DO-NOT-ISSUE', Credit核对: '测试已核对',
      首次审核: '测试已通过', 应发礼品卡: 5000, 已发礼品卡: 5000,
      邀请人: '测试人工指定', 反馈链接: 'https://example.invalid/fixture-feedback',
    },
  };
  const state = mockProvider(t, [original]);
  const input = application({
    状态: '已入选', 运营进度: '已完成', 邀请码: 'ATTACKER-CODE', Credit核对: '伪造',
    应发礼品卡: 999999, 已发礼品卡: 999999,
    fields: { 状态: '已入选', 邀请码: 'ATTACKER-CODE', Credit: 999999, 已发礼品卡: 999999 },
  });
  await expectSuccess(await submit(input));
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].record_id, original.record_id);
  const expected = {
    ...original.fields, ...applicationFields(input),
    来源: `uyi.live\n${sourceURL('homepage')}`,
  };
  assert.deepEqual(state.records[0].fields, expected);
  assert.equal(state.calls.some(call => call.operation === 'create'), false);
  const updates = state.calls.filter(call => call.operation === 'update');
  assert.ok(updates.length > 0);
  for (const call of updates) {
    assert.equal(new URL(call.url).pathname.split('/').at(-1), original.record_id);
    assert.ok(Object.keys(call.body.fields).every(key => [
      'Mac环境', '创作经验', '报名意向', 'X账号', '体验方向', '报名来源', '来源',
    ].includes(key)), 'A public supplement must not write operational or legacy subscription fields');
  }
});

test('a repeated application cannot overwrite filled application fields or operator decisions', async t => {
  const originalInput = application();
  const original = {
    record_id: 'rec-complete-existing',
    fields: {
      邮箱: normalizedEmail, ...applicationFields(originalInput),
      来源: sourceURL('homepage'), 状态: '已通知', 运营进度: '体验中',
      邀请码: 'TEST-EXISTING-CODE', Credit核对: '保留', 已发礼品卡: 10000,
    },
  };
  const state = mockProvider(t, [original]);
  await expectSuccess(await submit(application({
    requestId: nextRequestId, macEnvironment: '其他设备', creativeExperience: 'none',
    experienceDirection: 'undecided', intent: '修改已填写的意向', xAccount: '@different',
    运营进度: '已完成', 邀请码: 'FORGED', 已发礼品卡: 99999,
  })));
  assert.deepEqual(state.records, [original]);
  assert.equal(state.writes.length, 0);
});

test('appends a new entry source once while retaining the first application source and existing data', async t => {
  const original = {
    record_id: 'rec-source-existing',
    fields: { 邮箱: normalizedEmail, ...applicationFields(application()),
      来源: `uyi.live\n${sourceURL('homepage')}`, 运营进度: '已注册' },
  };
  const state = mockProvider(t, [original]);
  const env = credentials();
  await expectSuccess(await submit(application({ source: 'event' }), env));
  await expectSuccess(await submit(application({ source: 'event', requestId: nextRequestId }), env));
  assert.equal(state.records.length, 1);
  assert.deepEqual(state.records[0].fields, {
    ...original.fields, 来源: `uyi.live\n${sourceURL('homepage')}\n${sourceURL('event')}`,
  });
  assert.equal(state.writes.length, 1);
});

test('preserves text-segment values returned by Feishu and appends the source using a valid text write', async t => {
  const fields = applicationFields(application());
  const fixture = {
    record_id: 'rec-text-segments',
    fields: {
      ...fields,
      邮箱: [{ type: 'text', text: normalizedEmail }],
      Mac环境: [{ type: 'text', text: '原始Mac环境' }],
      报名意向: [{ type: 'text', text: '原始报名意向' }],
      X账号: [{ type: 'text', text: '@original_fixture' }],
      来源: [{ type: 'text', text: 'uyi.live' }],
      运营进度: '体验中', 已发礼品卡: 5000,
    },
  };
  const state = mockProvider(t, [fixture]);
  await expectSuccess(await submit(application({ source: 'outreach' })));
  assert.equal(state.records.length, 1);
  assert.deepEqual(state.records[0], {
    ...fixture, fields: { ...fixture.fields, 来源: `uyi.live\n${sourceURL('outreach')}` },
  });
  assert.deepEqual(state.writes.map(write => write.fields), [{ 来源: `uyi.live\n${sourceURL('outreach')}` }]);
});

test('maps all supported entry sources and falls back to other for an unknown source', async t => {
  const state = mockProvider(t);
  for (const source of ['homepage', 'event', 'creator', 'outreach', 'referral', 'other', 'not-a-supported-entry']) {
    state.records.length = 0;
    state.operations.clear();
    const input = application({ source });
    await expectSuccess(await submit(input));
    assert.equal(state.records.length, 1);
    assert.equal(state.records[0].fields.报名来源, applicationFields(input).报名来源);
    const normalizedSource = source === 'not-a-supported-entry' ? 'other' : source;
    assert.equal(state.records[0].fields.来源, sourceURL(normalizedSource));
  }
});

test('accepts all documented experience and optional Studio choices without rewriting the selected direction', async t => {
  const state = mockProvider(t);
  for (const [creativeExperience, experienceDirection] of [
    ['3d', 'ai_space'], ['other', 'studio_new'], ['none', 'undecided'],
    ['3d', 'studio_new'], ['none', 'studio_experienced'],
  ]) {
    state.records.length = 0;
    state.operations.clear();
    const input = application({ creativeExperience, experienceDirection });
    await expectSuccess(await submit(input));
    assert.equal(state.records[0].fields.创作经验, applicationFields(input).创作经验);
    assert.equal(state.records[0].fields.体验方向, applicationFields(input).体验方向);
  }
});

test('handles retries with both the same request ID and a new request ID as one participant', async t => {
  const state = mockProvider(t);
  const env = credentials();
  await expectSuccess(await submit(application(), env));
  await expectSuccess(await submit(application(), env));
  await expectSuccess(await submit(application({ requestId: nextRequestId, email: normalizedEmail }), env));
  assert.equal(state.records.length, 1);
  assert.equal(state.writes.filter(write => write.operation === 'create').length, 1);
  assert.equal(state.writes.filter(write => write.operation === 'update').length, 0);
});

test('concurrent first applications share one provider operation for the normalized email', async t => {
  let initialSearches = 0;
  let release;
  const bothSearching = new Promise(resolve => { release = resolve; });
  const state = mockProvider(t, [], {
    before: async call => {
      if (call.operation !== 'search') return;
      initialSearches++;
      if (initialSearches > 2) return;
      if (initialSearches === 2) release();
      await bothSearching;
      return Response.json({ code: 0, data: { items: [], has_more: false } });
    },
  });
  const env = credentials();
  const responses = await Promise.all([
    submit(application(), env),
    submit(application({ email: normalizedEmail, requestId: nextRequestId }), env),
  ]);
  for (const response of responses) await expectSuccess(response);
  assert.equal(state.records.length, 1);
  assert.equal(state.writes.filter(write => write.operation === 'create').length, 1);
  assert.equal(state.createOperationIds.length, 2);
  assert.equal(new Set(state.createOperationIds).size, 1);
});

test('readback supplements a legacy record returned by a concurrent subscription create', async t => {
  const legacy = {
    record_id: 'rec-concurrent-legacy',
    fields: { 邮箱: normalizedEmail, 登记时间: 1700000000000, 语言: 'en',
      来源: 'uyi.live', 请求编号: 'legacy-request', 状态: '待通知' },
  };
  const state = mockProvider(t, [], {
    before(call, current) {
      if (call.operation !== 'create') return;
      current.records.push(clone(legacy));
      return Response.json({ code: 0, data: { record: clone(legacy) } });
    },
  });
  await expectSuccess(await submit(application()));
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].record_id, legacy.record_id);
  assert.deepEqual(state.records[0].fields, {
    ...legacy.fields, ...applicationFields(application()),
    来源: `uyi.live\n${sourceURL('homepage')}`,
  });
  assert.ok(state.writes.some(write => write.operation === 'update' && write.record_id === legacy.record_id));
});

test('recovers a durably saved application after a create response is lost', async t => {
  let dropped = false;
  const state = mockProvider(t, [], {
    after(call) {
      if (call.operation === 'create' && !dropped) {
        dropped = true;
        throw new TypeError('simulated connection loss after provider commit');
      }
    },
  });
  await expectSuccess(await submit(application()));
  assert.equal(state.records.length, 1);
  assert.equal(state.writes.length, 1);
  assert.deepEqual(Object.fromEntries(Object.keys(applicationFields(application()))
    .map(key => [key, state.records[0].fields[key]])), applicationFields(application()));
});

test('fails safely when the email lookup finds multiple existing records', async t => {
  t.mock.method(console, 'error', () => {});
  const fixtures = [
    { record_id: 'rec-duplicate-one', fields: { 邮箱: normalizedEmail, 来源: 'uyi.live' } },
    { record_id: 'rec-duplicate-two', fields: { 邮箱: normalizedEmail, 来源: 'old-source' } },
  ];
  const state = mockProvider(t, fixtures);
  await expectUnavailable(await submit(application()));
  assert.deepEqual(state.records, fixtures);
  assert.equal(state.writes.length, 0);
});

test('does not report success when updating an existing subscription is forbidden', async t => {
  t.mock.method(console, 'error', () => {});
  const fixture = { record_id: 'rec-no-update-permission', fields: { 邮箱: normalizedEmail, 来源: 'uyi.live' } };
  const state = mockProvider(t, [fixture], {
    before(call) {
      if (call.operation === 'update') return Response.json({ code: 99991401, msg: 'private permission details' }, { status: 403 });
    },
  });
  await expectUnavailable(await submit(application()));
  assert.deepEqual(state.records, [fixture]);
  assert.equal(state.writes.length, 0);
  assert.ok(state.calls.some(call => call.operation === 'update'));
  assert.equal(state.calls.some(call => call.operation === 'create'), false);
});

test('requires the update receipt to identify the exact existing record', async t => {
  t.mock.method(console, 'error', () => {});
  const fixture = { record_id: 'rec-expected-update', fields: { 邮箱: normalizedEmail, 来源: 'uyi.live' } };
  const state = mockProvider(t, [fixture], {
    before(call) {
      if (call.operation === 'update') return Response.json({ code: 0, data: { record: { record_id: 'rec-wrong-record' } } });
    },
  });
  await expectUnavailable(await submit(application()));
  assert.deepEqual(state.records, [fixture]);
  assert.equal(state.writes.length, 0);
});

test('does not accept malformed create, search, or HTTP-200 business-error responses', async t => {
  t.mock.method(console, 'error', () => {});
  for (const [operation, result] of [
    ['create', { code: 0, data: {} }],
    ['search', { code: 0, data: { items: [{}] } }],
    ['search', { code: 0, data: { items: null } }],
    ['search', { code: 1254045, msg: 'private provider details' }],
  ]) {
    const state = mockProvider(t, [], {
      before(call) {
        if (call.operation === operation) return Response.json(result);
      },
    });
    await expectUnavailable(await submit(application()));
    assert.equal(state.records.length, 0);
  }
});

test('validates the application contract before contacting Feishu', async t => {
  let fetches = 0;
  t.mock.method(globalThis, 'fetch', async () => { fetches++; throw new Error('unexpected network request'); });
  const invalidOverrides = [
    { kind: 'another_application' }, { kind: null },
    { macConfirmed: false }, { macConfirmed: 'true' }, { macConfirmed: undefined },
    { macEnvironment: '' }, { macEnvironment: ' '.repeat(10) }, { macEnvironment: 'a'.repeat(301) },
    { creativeExperience: 'unknown' }, { creativeExperience: undefined },
    { creativeExperience: ['3d'] }, { creativeExperience: { toString: null, valueOf: null } },
    { experienceDirection: 'unknown' }, { experienceDirection: undefined },
    { experienceDirection: ['ai_space'] }, { experienceDirection: { toString: null, valueOf: null } },
    { intent: '' }, { intent: ' '.repeat(10) }, { intent: 'a'.repeat(1001) },
    { xAccount: 'a'.repeat(201) }, { xAccount: 123 },
  ];
  for (const override of invalidOverrides) {
    const response = await submit(application(override));
    assert.equal(response.status, 400, `Invalid application must fail: ${JSON.stringify(override)}`);
    assert.equal((await response.json()).success, undefined);
  }
  assert.equal(fetches, 0);
});

test('accepts a valid multibyte application above the legacy 4KB limit but below the 8KB cap', async t => {
  const input = application({
    macEnvironment: 'あ'.repeat(300), intent: 'い'.repeat(1000), xAccount: 'う'.repeat(200),
  });
  const bytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  assert.ok(bytes > 4096 && bytes < 8192);
  const state = mockProvider(t);
  await expectSuccess(await submit(input));
  assert.equal(state.records[0].fields.Mac环境, input.macEnvironment);
  assert.equal(state.records[0].fields.报名意向, input.intent);
  assert.equal(state.records[0].fields.X账号, input.xAccount);
});

test('enforces the application 8KB limit for streamed bytes and declared content length before Feishu', async t => {
  let fetches = 0;
  t.mock.method(globalThis, 'fetch', async () => { fetches++; throw new Error('unexpected network request'); });
  const oversized = application({ intent: 'a'.repeat(9000) });
  for (const input of [request(oversized), request(application(), { 'Content-Length': '9000' })]) {
    const response = await onRequest({ request: input, env: credentials() });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).success, undefined);
  }
  assert.equal(fetches, 0);
});
