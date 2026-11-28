import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { onRequest } from '../functions/api/subscribe.js';

// Stateful provider-boundary tests only, not evidence of production permissions.
const requestId = '5d5b7bd8-af5b-4c52-9315-5bd6c129ed72';
const nextRequestId = 'c14b1770-e0de-436d-b2aa-89f34be4014a';
const normalizedEmail = 'creator+uyi@example.com';
const PRIMARY = 'fixture-table';
const RAW = 'tblFeedbackFixture';
let fixtureId = 0;
const credentials = () => ({ FEISHU_APP_ID: `mac-application-fixture-${++fixtureId}`,
  FEISHU_APP_SECRET: 'fixture-secret-only', FEISHU_APP_TOKEN: 'fixture-base',
  FEISHU_TABLE_ID: PRIMARY, FEISHU_FEEDBACK_TABLE_ID: RAW });
const application = (overrides = {}) => ({
  kind: 'mac_application', email: ' Creator+UYI@Example.com ', language: 'ja', requestId, website: '',
  macConfirmed: true, macEnvironment: 'MacBook Air / M2 / macOS 15', creativeExperience: '3d',
  experienceDirection: 'studio_experienced', intent: '椅子を生成してAI空間に置き、操作で迷った点を具体的に伝えたいです。',
  xAccount: '@creator_fixture', source: 'homepage', ...overrides,
});
const request = (body = application(), headers = {}) => new Request('https://uyi.live/api/subscribe', {
  method: 'POST', headers: { Origin: 'https://uyi.live', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const clone = value => structuredClone(value);
const text = value => Array.isArray(value) ? value.map(part => part.text).join('') : value;
const sourceURL = source => `uyi.live/apply/?source=${source}`;
const applicationFields = (input = application()) => ({
  Mac环境: input.macEnvironment.trim(),
  创作经验: { '3d': '3D制作・3D生成の経験あり', other: 'その他の創作経験あり', none: '創作経験なし' }[input.creativeExperience],
  报名意向: input.intent.trim(), ...(input.xAccount?.trim() ? { X账号: input.xAccount.trim() } : {}),
  体验方向: { ai_space: 'AI空間を中心に試したい', studio_experienced: 'AI空間とUYI Studio（3D生成経験あり）',
    studio_new: 'AI空間とUYI Studio（3D生成経験なし）', undecided: '説明を聞いてから決めたい' }[input.experienceDirection],
  报名来源: { homepage: 'UYI公式サイト', event: 'イベント・先行体験ページ', creator: 'イベント・先行体験ページ',
    outreach: 'UYIからの直接のお誘い', referral: '知人・クリエイターの紹介', other: 'その他' }[input.source] || 'その他',
});

function mockProvider(t, initialRecords = [], hooks = {}) {
  const state = { records: clone(initialRecords), raw: [], calls: [], writes: [], createOperationIds: [], operations: new Map() };
  t.mock.method(globalThis, 'fetch', async (rawURL, options = {}) => {
    const url = new URL(rawURL);
    assert.equal(url.origin, 'https://open.feishu.cn');
    assert.equal(options.method, 'POST', 'Anonymous application must never PUT any existing record');
    const body = JSON.parse(options.body);
    let operation, table;
    if (url.pathname.endsWith('/auth/v3/tenant_access_token/internal')) operation = 'token';
    else {
      const match = url.pathname.match(/^\/open-apis\/bitable\/v1\/apps\/fixture-base\/tables\/([^/]+)\/records(\/search)?$/);
      assert.ok(match, `Unexpected provider route: ${url.pathname}`);
      table = match[1];
      assert.ok([PRIMARY, RAW].includes(table));
      operation = match[2] ? 'search' : 'create';
      assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    }
    const call = { operation, table, url: url.href, method: options.method, body };
    state.calls.push(call);
    const early = await hooks.before?.(call, state);
    if (early !== undefined) return early;
    let result;
    if (operation === 'token') result = { code: 0, tenant_access_token: 'fixture-token', expire: 7200 };
    else if (operation === 'search') {
      assert.equal(body.filter.conjunction, 'and');
      assert.equal(url.searchParams.get('page_size'), '2');
      const rows = table === PRIMARY ? state.records : state.raw;
      const matches = rows.filter(record => body.filter.conditions.every(condition => {
        assert.equal(condition.operator, 'is');
        return text(record.fields[condition.field_name]) === condition.value[0];
      }));
      const projected = matches.slice(0, 2).map(record => ({ record_id: record.record_id,
        fields: Object.fromEntries(body.field_names.filter(name => Object.hasOwn(record.fields, name)).map(name => [name, clone(record.fields[name])])) }));
      result = { code: 0, data: { items: projected, has_more: matches.length > 2 } };
    } else {
      const operationId = url.searchParams.get('client_token');
      assert.match(operationId || '', /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
      assert.equal(url.searchParams.has('ignore_consistency_check'), false);
      state.createOperationIds.push({ table, operationId });
      const key = `${table}/${operationId}`;
      let record = state.operations.get(key);
      if (!record) {
        const rows = table === PRIMARY ? state.records : state.raw;
        record = { record_id: `rec-${table}-${rows.length + 1}`, fields: clone(body.fields) };
        if (table === RAW) record.fields.提交时间 = Date.now();
        rows.push(record);
        state.operations.set(key, record);
        state.writes.push({ operation, table, record_id: record.record_id, fields: clone(body.fields) });
      }
      result = { code: 0, data: { record: clone(record) } };
    }
    const late = await hooks.after?.(call, state, clone(result));
    return late === undefined ? Response.json(result) : late;
  });
  return state;
}
const submit = (body = application(), env = credentials()) => onRequest({ request: request(body), env });
async function expectSuccess(response) {
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
}
async function expectUnavailable(response) {
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
}
const masterCreates = state => state.writes.filter(write => write.table === PRIMARY);
const rawCreates = state => state.writes.filter(write => write.table === RAW);

function assertRaw(raw, input, participantId) {
  const fields = raw.fields;
  assert.equal(fields.记录类型, '报名资料（待核对）');
  assert.equal(fields.反馈编号, input.requestId.toLowerCase());
  assert.equal(fields.请求编号, input.requestId.toLowerCase());
  assert.equal(fields.邮箱, input.email.trim().toLowerCase());
  assert.match(fields.内容校验, /^[a-f0-9]{64}$/);
  assert.equal(fields.处理状态, participantId ? '报名待核对' : '待匹配');
  if (participantId) assert.deepEqual(fields.参与者, [participantId]);
  else assert.equal(fields.参与者, undefined);
  for (const line of ['1. 联系邮箱：', '2. 可使用Mac：是', '3. 创作经验：', '4. 体验方向：',
    '5. 报名意向：', '6. X账号：', '7. 报名来源：', `语言：${input.language}`]) assert.ok(fields.具体反馈.includes(line));
  assert.ok(fields.具体反馈.includes(input.macEnvironment.trim()));
  assert.ok(fields.具体反馈.includes(input.intent.trim()));
  assert.equal(fields.实际体验日, undefined, 'application intake is not an experience day');
}

test('creates at most one new pending master and confirms an independent complete application log', async t => {
  const state = mockProvider(t);
  const input = application({ source: 'event', macEnvironment: '  MacBook Air / M2 / macOS 15  ',
    intent: '  小物を置いてサイズ調整の問題を確認したいです。  ', xAccount: '  @creator_fixture  ' });
  await expectSuccess(await submit(input));
  assert.equal(state.records.length, 1);
  const record = state.records[0];
  assert.deepEqual(record.fields, { 邮箱: normalizedEmail, 登记时间: record.fields.登记时间,
    语言: 'ja', 来源: sourceURL('event'), 请求编号: requestId, 状态: '待通知', ...applicationFields(input), 运营进度: '待筛选' });
  assert.equal(state.raw.length, 1);
  assertRaw(state.raw[0], input, record.record_id);
  assert.equal(rawCreates(state)[0].fields.提交时间, undefined, 'creation time belongs to Feishu');
  const rawCreate = state.calls.findIndex(call => call.operation === 'create' && call.table === RAW);
  assert.ok(state.calls.slice(rawCreate + 1).some(call => call.operation === 'search' && call.table === RAW));
});

test('records an explicitly empty X answer and only requires self-declared Mac availability', async t => {
  const state = mockProvider(t);
  const input = application({ xAccount: '   ', macEnvironment: '自宅のノート端末・機種確認中' });
  await expectSuccess(await submit(input));
  assert.equal(Object.hasOwn(state.records[0].fields, 'X账号'), false);
  assert.ok(state.raw[0].fields.具体反馈.includes('6. X账号：（未填写）'));
});

test('leaves every existing master field including blanks and source untouched and appends a pending application', async t => {
  const original = { record_id: 'rec-legacy', fields: { 邮箱: normalizedEmail, Mac环境: '', 创作经验: null,
    来源: 'uyi.live', 状态: '已通知', 运营进度: '已注册', 邀请码: 'TEST-ONLY', Credit核对: '保留', 已发礼品卡: 5000 } };
  const state = mockProvider(t, [original]);
  const input = application({ 状态: '已入选', 运营进度: '已完成', 邀请码: 'FORGED', Credit核对: '伪造', 已发礼品卡: 999999,
    fields: { Mac环境: '伪造覆写', 来源: 'FORGED' } });
  await expectSuccess(await submit(input));
  assert.deepEqual(state.records, [original]);
  assert.equal(masterCreates(state).length, 0);
  assertRaw(state.raw[0], input, original.record_id);
  assert.equal(state.raw[0].fields.具体反馈.includes('FORGED'), false);
});

test('retains new source history in separate raw submissions without editing the first source or filled profile', async t => {
  const original = { record_id: 'rec-source', fields: { 邮箱: normalizedEmail, ...applicationFields(), 来源: sourceURL('homepage'), 运营进度: '体验中' } };
  const state = mockProvider(t, [original]);
  await expectSuccess(await submit(application({ source: 'event' })));
  await expectSuccess(await submit(application({ source: 'outreach', requestId: nextRequestId, intent: '新しい意向です。' })));
  assert.deepEqual(state.records, [original]);
  assert.equal(state.raw.length, 2);
  assert.ok(state.raw[0].fields.具体反馈.includes('[event]'));
  assert.ok(state.raw[1].fields.具体反馈.includes('[outreach]'));
  assert.ok(state.raw[1].fields.具体反馈.includes('新しい意向です。'));
});

test('reads text-segment email values without rewriting any original field', async t => {
  const original = { record_id: 'rec-rich-text', fields: { 邮箱: [{ type: 'text', text: normalizedEmail }],
    来源: [{ type: 'text', text: 'uyi.live' }], Mac环境: [{ type: 'text', text: '人工核对设备' }] } };
  const state = mockProvider(t, [original]);
  await expectSuccess(await submit(application()));
  assert.deepEqual(state.records, [original]);
  assert.deepEqual(state.raw[0].fields.参与者, [original.record_id]);
});

test('preserves source codes and all Studio choices in raw original answers', async t => {
  const state = mockProvider(t, [{ record_id: 'rec-one', fields: { 邮箱: normalizedEmail } }]);
  for (const source of ['homepage', 'event', 'creator', 'outreach', 'referral', 'other', 'unknown']) {
    const input = application({ requestId: randomUUID(), source, creativeExperience: 'other', experienceDirection: 'studio_new' });
    await expectSuccess(await submit(input));
    const raw = state.raw.at(-1);
    assert.ok(raw.fields.具体反馈.includes(`[${source === 'unknown' ? 'other' : source}]`));
    assert.ok(raw.fields.具体反馈.includes('その他の創作経験あり [other]'));
    assert.ok(raw.fields.具体反馈.includes('AI空間とUYI Studio（3D生成経験なし） [studio_new]'));
  }
  assert.equal(state.raw.length, 7);
  assert.equal(masterCreates(state).length, 0);
});

test('accepts every supported experience direction for a new self-reported profile', async t => {
  for (const [creativeExperience, experienceDirection] of [['3d', 'ai_space'], ['other', 'studio_new'], ['none', 'undecided'], ['none', 'studio_experienced']]) {
    const state = mockProvider(t);
    const input = application({ creativeExperience, experienceDirection });
    await expectSuccess(await submit(input));
    assert.equal(state.records[0].fields.创作经验, applicationFields(input).创作经验);
    assert.equal(state.records[0].fields.体验方向, applicationFields(input).体验方向);
  }
});

test('same UUID/content retry is one raw log; a new UUID keeps another application for the same participant', async t => {
  const state = mockProvider(t);
  const env = credentials();
  await expectSuccess(await submit(application(), env));
  await expectSuccess(await submit(application({ email: normalizedEmail, requestId: requestId.toUpperCase(), intent: ` ${application().intent} ` }), env));
  await expectSuccess(await submit(application({ requestId: nextRequestId }), env));
  assert.equal(state.records.length, 1);
  assert.equal(state.raw.length, 2);
  assert.equal(masterCreates(state).length, 1);
});

test('same UUID with any changed business answer conflicts before another master can be created', async t => {
  const state = mockProvider(t);
  const env = credentials();
  await expectSuccess(await submit(application(), env));
  const priorMasterCalls = state.calls.filter(call => call.table === PRIMARY).length;
  for (const override of [{ email: 'someone-else@example.com' }, { macEnvironment: '另一台设备' }, { intent: '不同意向' },
    { source: 'event' }, { language: 'en' }, { xAccount: '' }, { creativeExperience: 'none' }, { experienceDirection: 'undecided' }]) {
    const response = await submit(application(override), env);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'conflict' });
  }
  assert.equal(state.records.length, 1);
  assert.equal(state.raw.length, 1);
  assert.equal(state.calls.filter(call => call.table === PRIMARY).length, priorMasterCalls);
});

test('different applications racing for one new email survive changed-body replay rejection and keep both raw answers', async t => {
  let initial = 0, creates = 0, rejectedReplay = 0, release, commit;
  const barrier = new Promise(resolve => { release = resolve; });
  const committed = new Promise(resolve => { commit = resolve; });
  const state = mockProvider(t, [], { before: async (call, current) => {
    if (call.table === PRIMARY && call.operation === 'create') {
      creates++;
      if (creates > 1) {
        await committed;
        assert.equal(current.records.length, 1);
        rejectedReplay++;
        return Response.json({ code: 1254001, msg: 'changed-body replay rejected' }, { status: 400 });
      }
    }
    if (call.table !== PRIMARY || call.operation !== 'search' || initial >= 2) return;
    initial++;
    if (initial === 2) release();
    await barrier;
    return Response.json({ code: 0, data: { items: [], has_more: false } });
  }, after: call => { if (call.table === PRIMARY && call.operation === 'create') commit(); } });
  const env = credentials();
  const inputs = [application({ source: 'creator' }), application({ requestId: nextRequestId, intent: '别的创作意向', source: 'referral' })];
  for (const response of await Promise.all(inputs.map(input => submit(input, env)))) await expectSuccess(response);
  assert.equal(state.records.length, 1);
  assert.equal(state.raw.length, 2);
  assert.equal(masterCreates(state).length, 1);
  const operations = state.calls.filter(call => call.table === PRIMARY && call.operation === 'create')
    .map(call => ({ operationId: new URL(call.url).searchParams.get('client_token') }));
  assert.equal(operations.length, 2);
  assert.equal(new Set(operations.map(operation => operation.operationId)).size, 1);
  assert.equal(rejectedReplay, 1, 'provider must reject the competing different-body replay in this regression');
  for (const input of inputs) assert.ok(state.raw.some(raw => raw.fields.具体反馈.includes(input.intent)));
});

test('an email-only signup winning the concurrent create stays intact while the full application survives in raw', async t => {
  const legacy = { record_id: 'rec-concurrent-legacy', fields: { 邮箱: normalizedEmail, 来源: 'uyi.live', 语言: 'en', 状态: '待通知' } };
  const state = mockProvider(t, [], { before: (call, current) => {
    if (call.table !== PRIMARY || call.operation !== 'create') return;
    current.records.push(clone(legacy));
    return Response.json({ code: 0, data: { record: clone(legacy) } });
  } });
  const input = application();
  await expectSuccess(await submit(input));
  assert.deepEqual(state.records, [legacy]);
  assertRaw(state.raw[0], input, legacy.record_id);
});

test('continues raw intake when Feishu rejects changed-body email-key replay after another master commits', async t => {
  const legacy = { record_id: 'rec-winner', fields: { 邮箱: normalizedEmail, 来源: 'uyi.live', 状态: '待通知' } };
  const state = mockProvider(t, [], { before: (call, current) => {
    if (call.table !== PRIMARY || call.operation !== 'create') return;
    current.records.push(clone(legacy));
    return Response.json({ code: 1254001, msg: 'different payload for the existing operation' }, { status: 400 });
  } });
  const input = application({ source: 'creator', intent: '后提交的创作计划应完整保留。' });
  await expectSuccess(await submit(input));
  assert.deepEqual(state.records, [legacy]);
  assert.equal(state.calls.filter(call => call.table === PRIMARY && call.operation === 'create').length, 1);
  assert.equal(masterCreates(state).length, 0);
  assertRaw(state.raw[0], input, legacy.record_id);
});

test('existing blank profiles and an intervening operator correction survive concurrent applications without PUT', async t => {
  const original = { record_id: 'rec-blank', fields: { 邮箱: normalizedEmail, Mac环境: '', 来源: 'uyi.live' } };
  let reads = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const state = mockProvider(t, [original], { after: async (call, current, result) => {
    if (call.table !== PRIMARY || call.operation !== 'search' || reads >= 2) return;
    reads++;
    if (reads === 2) {
      Object.assign(current.records[0].fields, { Mac环境: '运营已核对的设备', 来源: '运营已修正来源', 运营进度: '已注册' });
      release();
    }
    await barrier;
    return Response.json(result);
  } });
  const env = credentials();
  for (const response of await Promise.all([submit(application(), env), submit(application({ requestId: nextRequestId, macEnvironment: '另一设备', source: 'event' }), env)])) await expectSuccess(response);
  assert.equal(state.records[0].fields.Mac环境, '运营已核对的设备');
  assert.equal(state.records[0].fields.来源, '运营已修正来源');
  assert.equal(state.records[0].fields.运营进度, '已注册');
  assert.equal(state.raw.length, 2);
  assert.equal(masterCreates(state).length, 0);
});

test('duplicate existing master emails are not merged or arbitrarily chosen; full application is retained for matching', async t => {
  const originals = [{ record_id: 'rec-one', fields: { 邮箱: normalizedEmail } }, { record_id: 'rec-two', fields: { 邮箱: normalizedEmail } }];
  const state = mockProvider(t, originals);
  const input = application();
  await expectSuccess(await submit(input));
  assert.deepEqual(state.records, originals);
  assertRaw(state.raw[0], input);
  assert.equal(masterCreates(state).length, 0);
});

test('recovers an ambiguous raw commit and does not create another application or master', async t => {
  let dropped = false;
  const state = mockProvider(t, [], { after: call => {
    if (call.table === RAW && call.operation === 'create' && !dropped) { dropped = true; throw new TypeError('response lost after commit'); }
  } });
  await expectSuccess(await submit(application()));
  assert.equal(state.records.length, 1);
  assert.equal(state.raw.length, 1);
});

test('a raw failure after master creation is not success; retry safely saves only the missing raw log', async t => {
  t.mock.method(console, 'error', () => {});
  let blocked = true;
  const state = mockProvider(t, [], { before: call => {
    if (call.table === RAW && call.operation === 'create' && blocked) return Response.json({ code: 99991401 }, { status: 403 });
  } });
  const env = credentials();
  await expectUnavailable(await submit(application(), env));
  assert.equal(state.records.length, 1);
  assert.equal(state.raw.length, 0);
  blocked = false;
  await expectSuccess(await submit(application(), env));
  assert.equal(masterCreates(state).length, 1);
  assert.equal(state.raw.length, 1);
});

test('retries ambiguous master creation without ever filling a concurrently owned master', async t => {
  let dropped = false;
  const state = mockProvider(t, [], { after: call => {
    if (call.table === PRIMARY && call.operation === 'create' && !dropped) { dropped = true; throw new TypeError('master receipt lost'); }
  } });
  await expectSuccess(await submit(application()));
  assert.equal(state.records.length, 1);
  assert.equal(state.raw.length, 1);
  assert.equal(masterCreates(state).length, 1);
});

test('requires actual raw hash confirmation and rejects malformed/business-error provider responses', async t => {
  t.mock.method(console, 'error', () => {});
  for (const [table, operation, response] of [[RAW, 'create', { code: 0, data: {} }],
    [RAW, 'create', { code: 0, data: { record: { record_id: 'rec-not-stored' } } }],
    [RAW, 'search', { code: 0, data: { items: [{}] } }],
    [PRIMARY, 'search', { code: 0, data: { items: null } }],
    [RAW, 'search', { code: 1254045, msg: 'private details' }]]) {
    const state = mockProvider(t, [], { before: call => {
      if (call.table === table && call.operation === operation) return Response.json(response);
    } });
    await expectUnavailable(await submit(application()));
    assert.equal(state.raw.length, 0);
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
