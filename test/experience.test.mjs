import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { onRequest } from '../functions/api/experience.js';

// Feishu boundary model only: this suite proves the handler's business contract,
// not production app permissions, field types, deployment, or live delivery.
const ORIGIN = 'https://uyi.live';
const PRIMARY_TABLE = 'tblParticipantFixture';
const RAW_TABLE = 'tblFeedbackFixture';
const EMAIL = 'creator+uyi@example.invalid';
const JAPAN_TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
let fixtureId = 0;
let peerId = 0;
const clone = value => structuredClone(value);
const fieldText = value => Array.isArray(value) ? value.map(item => item.text).join('') : value;
const credentials = () => ({
  FEISHU_APP_ID: `experience-fixture-${++fixtureId}`,
  FEISHU_APP_SECRET: 'fixture-secret-not-a-real-credential',
  FEISHU_APP_TOKEN: 'fixture-same-base',
  FEISHU_TABLE_ID: PRIMARY_TABLE,
  FEISHU_FEEDBACK_TABLE_ID: RAW_TABLE,
});
const report = (overrides = {}) => ({
  kind: 'experience_report', email: ' Creator+UYI@Example.invalid ',
  requestId: randomUUID(), experienceDate: JAPAN_TODAY,
  activities: ['ai_space', 'studio'], completion: 'partly', reuse: 'unsure',
  comment: '小物の配置を試しました。サイズの確認が難しかったので、配置前に寸法が見えると助かります。',
  recordLink: '', website: '', language: 'ja', source: 'experience', ...overrides,
});
const supplement = (originalReportId, overrides = {}) => ({
  kind: 'experience_supplement', email: EMAIL, requestId: randomUUID(), originalReportId,
  recordLink: 'https://example.invalid/private-record', note: '前回の操作動画を補足します。',
  website: '', ...overrides,
});
const participant = (overrides = {}) => ({
  record_id: 'rec-participant-private',
  fields: {
    邮箱: EMAIL, 状态: '已通知', 运营进度: '体验中', 邀请码: 'TEST-DO-NOT-ISSUE',
    Credit核对: '人工核对保留', 应发礼品卡: 5000, 已发礼品卡: 5000,
    ...overrides,
  },
});
const request = body => new Request(`${ORIGIN}/api/experience`, {
  method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

function mockFeishu(t, { participants = [participant()], raw = [], before, after } = {}) {
  const state = { participants: clone(participants), raw: clone(raw), calls: [], creates: [], operations: new Map() };
  t.mock.method(globalThis, 'fetch', async (rawURL, options = {}) => {
    const url = new URL(rawURL);
    assert.equal(url.origin, 'https://open.feishu.cn', 'No email, reward, external evidence, or other service calls');
    assert.equal(options.method, 'POST', 'Intake must only search or append; never update original/operator records');
    const body = JSON.parse(options.body);
    let operation, table;
    if (url.pathname.endsWith('/auth/v3/tenant_access_token/internal')) operation = 'token';
    else {
      const match = url.pathname.match(/^\/open-apis\/bitable\/v1\/apps\/fixture-same-base\/tables\/([^/]+)\/records(\/search)?$/);
      assert.ok(match, `Unexpected Feishu route: ${url.pathname}`);
      table = match[1];
      assert.ok([PRIMARY_TABLE, RAW_TABLE].includes(table));
      operation = match[2] ? 'search' : 'create';
      assert.equal(options.headers.Authorization, 'Bearer fixture-token');
      if (operation === 'create') assert.equal(table, RAW_TABLE, 'Public feedback must not create participants');
    }
    const call = { operation, table, url: url.href, body };
    state.calls.push(call);
    const early = await before?.(call, state);
    if (early !== undefined) return early;
    let result;
    if (operation === 'token') result = { code: 0, tenant_access_token: 'fixture-token', expire: 7200 };
    else if (operation === 'search') {
      assert.equal(url.searchParams.get('page_size'), '2', 'Detect ambiguity rather than silently taking a first row');
      assert.equal(body.filter.conjunction, 'and');
      const rows = table === PRIMARY_TABLE ? state.participants : state.raw;
      const matching = rows.filter(row => body.filter.conditions.every(condition => {
        assert.equal(condition.operator, 'is');
        assert.ok(['邮箱', '请求编号', '反馈编号', '记录类型'].includes(condition.field_name));
        assert.equal(condition.value.length, 1);
        return fieldText(row.fields[condition.field_name]) === condition.value[0];
      }));
      const selected = matching.slice(0, 2).map(row => ({
        record_id: row.record_id,
        fields: Object.fromEntries(body.field_names.filter(name => Object.hasOwn(row.fields, name))
          .map(name => [name, clone(row.fields[name])])),
      }));
      result = { code: 0, data: { items: selected, has_more: matching.length > 2 } };
    } else {
      const operationId = url.searchParams.get('client_token');
      assert.match(operationId || '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.equal(url.searchParams.has('ignore_consistency_check'), false);
      let stored = state.operations.get(operationId);
      if (!stored) {
        stored = { record_id: `rec-raw-private-${state.raw.length + 1}`,
          fields: { ...clone(body.fields), 提交时间: Date.now() } };
        state.raw.push(stored);
        state.operations.set(operationId, stored);
        state.creates.push({ operationId, fields: clone(body.fields), record_id: stored.record_id });
      }
      result = { code: 0, data: { record: clone(stored) } };
    }
    const late = await after?.(call, state, clone(result));
    return late === undefined ? Response.json(result) : late;
  });
  return state;
}

const submit = (body, env = credentials(), handler = onRequest) => handler({ request: request(body), env });
async function receipt(response, input) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  const result = await response.json();
  assert.deepEqual(result, {
    success: true, reportId: input.requestId.toLowerCase(), status: 'received',
    evidenceStatus: input.recordLink?.trim() ? 'present' : 'missing', kind: input.kind,
  });
  return result;
}
async function failure(response, status) {
  assert.equal(response.status, status);
  const result = await response.json();
  assert.notEqual(result.success, true);
  return result;
}

test('appends a matched report to the raw table, preserves participant/operator fields and confirms readback', async t => {
  const original = participant();
  const state = mockFeishu(t, { participants: [original] });
  const input = report({ comment: '  生成中の待ち時間が分からなかったので、進捗表示があると助かります。  ' });
  const before = Date.now();
  await receipt(await submit(input), input);
  assert.deepEqual(state.participants, [original]);
  assert.equal(state.raw.length, 1);
  const fields = state.raw[0].fields;
  assert.equal(fields.反馈编号, input.requestId);
  assert.equal(fields.请求编号, input.requestId);
  assert.equal(fields.邮箱, EMAIL);
  assert.equal(fields.实际体验日, input.experienceDate);
  assert.equal(fields.具体反馈, input.comment.trim());
  assert.equal(fields.记录链接, '');
  assert.equal(fields.本次使用, 'AI空間を試した、UYI Studioを試した');
  assert.equal(fields.完成情况, '一部できた');
  assert.equal(fields.再用意愿, 'まだわからない');
  assert.equal(fields.记录类型, '体验反馈');
  assert.equal(fields.处理状态, '待核验');
  assert.equal(fields.测试标记, '自动验收测试');
  assert.deepEqual(fields.参与者, [original.record_id]);
  assert.match(fields.内容校验, /^[0-9a-f]{64}$/);
  assert.ok(fields.提交时间 >= before && fields.提交时间 <= Date.now());
  assert.equal(Object.hasOwn(state.creates[0].fields, '提交时间'), false,
    'Submission time belongs to Feishu creation-time metadata, not client/provisional API time');
  assert.equal(Object.hasOwn(fields, '应发礼品卡'), false);
  const created = state.calls.findIndex(call => call.operation === 'create');
  assert.ok(state.calls.slice(created + 1).some(call => call.operation === 'search' &&
    call.table === RAW_TABLE && call.body.filter.conditions.some(condition => condition.field_name === '请求编号')));
});

test('multiple rounds by the same email create separate raw records without overwriting a prior round', async t => {
  const state = mockFeishu(t);
  const env = credentials();
  const first = report();
  await receipt(await submit(first, env), first);
  const originalRow = clone(state.raw[0]);
  const second = report({ comment: '再度配置を試すと操作しやすくなりましたが、サイズ確認はまだ必要です。' });
  await receipt(await submit(second, env), second);
  assert.equal(state.raw.length, 2);
  assert.deepEqual(state.raw[0], originalRow);
  assert.notEqual(state.raw[0].fields.反馈编号, state.raw[1].fields.反馈编号);
  assert.equal(state.participants.length, 1);
  assert.equal(state.creates.length, 2);
  assert.equal(new Set(state.creates.map(create => create.operationId)).size, 2,
    'Raw rounds must not use email as their sole idempotency key');
});

test('identical request retries are idempotent after normalizing email, whitespace and activity ordering', async t => {
  const state = mockFeishu(t);
  const env = credentials();
  const input = report();
  await receipt(await submit(input, env), input);
  const row = clone(state.raw[0]);
  const repeated = { ...input, email: EMAIL, activities: ['studio', 'ai_space'], comment: ` ${input.comment} `,
    language: 'en', source: 'other' };
  await receipt(await submit(repeated, env), repeated);
  assert.equal(state.raw.length, 1);
  assert.equal(state.creates.length, 1);
  assert.deepEqual(state.raw[0], row);
});

test('a changed body under the same request ID conflicts rather than changing the stored report', async t => {
  const state = mockFeishu(t);
  const env = credentials();
  const first = report();
  await receipt(await submit(first, env), first);
  const stored = clone(state.raw[0]);
  const result = await failure(await submit({ ...first, comment: '同じIDの原文を置換するための変更です。' }, env), 409);
  assert.deepEqual(result, { error: 'conflict' });
  assert.deepEqual(state.raw, [stored]);
  assert.equal(state.creates.length, 1);
});

test('concurrent handlers dedupe identical request IDs and reject a competing different body', async t => {
  let initialSearches = 0;
  let release;
  const bothSearching = new Promise(resolve => { release = resolve; });
  const state = mockFeishu(t, {
    before: async call => {
      if (call.operation !== 'search' || call.table !== RAW_TABLE ||
          !call.body.filter.conditions.some(condition => condition.field_name === '请求编号')) return;
      initialSearches++;
      if (initialSearches > 2) return;
      if (initialSearches === 2) release();
      await bothSearching;
      return Response.json({ code: 0, data: { items: [], has_more: false } });
    },
  });
  const env = credentials();
  const peer = await import(`../functions/api/experience.js?peer-fixture=${++peerId}`);
  const first = report();
  const competing = { ...first, comment: '同時送信の別内容です。' };
  const responses = await Promise.all([submit(first, env), submit(competing, env, peer.onRequest)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(state.raw.length, 1);
  assert.equal(state.creates.length, 1);
  const winner = state.raw[0].fields.具体反馈 === first.comment ? first : competing;
  const success = responses.find(response => response.status === 200);
  await receipt(success, winner);
});

test('supplements append independently, reference a matching original and do not replace its answers/date', async t => {
  const state = mockFeishu(t);
  const env = credentials();
  const first = report();
  await receipt(await submit(first, env), first);
  const original = clone(state.raw[0]);
  const addition = supplement(first.requestId);
  await receipt(await submit(addition, env), addition);
  await receipt(await submit(addition, env), addition);
  assert.equal(state.raw.length, 2);
  assert.deepEqual(state.raw[0], original);
  const fields = state.raw[1].fields;
  assert.equal(fields.记录类型, '材料补充');
  assert.equal(fields.原反馈编号, first.requestId);
  assert.equal(fields.记录链接, addition.recordLink);
  assert.equal(fields.具体反馈, addition.note);
  assert.equal(fields.处理状态, '待核验');
  assert.deepEqual(fields.参与者, [state.participants[0].record_id]);
  assert.equal(Object.hasOwn(fields, '实际体验日'), false,
    'A supplement is not a new use day');
  assert.equal(Object.hasOwn(fields, '完成情况'), false);
  const originalLookup = state.calls.find(call => call.operation === 'search' && call.table === RAW_TABLE &&
    call.body.filter.conditions.some(condition => condition.field_name === '反馈编号'));
  assert.deepEqual(originalLookup.body.field_names.sort(), ['反馈编号', '邮箱', '记录类型'].sort());
});

test('unmatched and duplicate-email participants receive the same generic receipt without enrolment or arbitrary linking', async t => {
  for (const participants of [[], [participant(), { ...participant(), record_id: 'rec-other-duplicate-private' }]]) {
    const state = mockFeishu(t, { participants });
    const input = report();
    const result = await receipt(await submit(input), input);
    assert.equal(state.raw.length, 1);
    assert.equal(state.raw[0].fields.处理状态, '待匹配');
    assert.equal(Object.hasOwn(state.raw[0].fields, '参与者'), false);
    assert.deepEqual(state.participants, participants);
    assert.equal(JSON.stringify(result).includes('待匹配'), false);
    assert.equal(JSON.stringify(result).includes('rec-'), false);
    assert.equal(JSON.stringify(result).includes(EMAIL), false);
  }
});

test('an unknown or wrong-email original reference is kept pending without exposing or mutating someone else’s report', async t => {
  const otherEmail = 'other-creator@example.invalid';
  const otherParticipant = { ...participant({ 邮箱: otherEmail }), record_id: 'rec-other-participant-private' };
  const state = mockFeishu(t, { participants: [participant(), otherParticipant] });
  const env = credentials();
  const first = report();
  await receipt(await submit(first, env), first);
  const original = clone(state.raw[0]);
  for (const input of [
    supplement(randomUUID()),
    supplement(first.requestId, { email: otherEmail }),
  ]) {
    const result = await receipt(await submit(input, env), input);
    const pending = state.raw.at(-1);
    assert.equal(pending.fields.处理状态, '待匹配');
    assert.equal(Object.hasOwn(pending.fields, '参与者'), false);
    assert.equal(pending.fields.原反馈编号, input.originalReportId);
    assert.deepEqual(state.raw[0], original);
    assert.equal(JSON.stringify(result).includes(first.comment), false);
    assert.equal(JSON.stringify(result).includes('待匹配'), false);
  }
  assert.equal(state.raw.length, 3);
  assert.equal(state.participants.length, 2);
});

test('public receipts never return participant data, operator state, balance, internal record IDs, or saved prior content', async t => {
  const state = mockFeishu(t);
  const input = report({ recordLink: 'https://example.invalid/current-evidence' });
  const result = await receipt(await submit(input), input);
  const json = JSON.stringify(result);
  for (const secret of [EMAIL, input.comment, input.recordLink, 'rec-participant-private', 'rec-raw-private', 'TEST-DO-NOT-ISSUE', '人工核对保留', '已通知', '体验中', '5000']) {
    assert.equal(json.includes(secret), false);
  }
  const participantSearches = state.calls.filter(call => call.operation === 'search' && call.table === PRIMARY_TABLE);
  assert.ok(participantSearches.every(call => JSON.stringify(call.body.field_names) === JSON.stringify(['邮箱'])));
});

test('handles Feishu text-segment values during idempotency and original-report matching', async t => {
  const state = mockFeishu(t);
  const env = credentials();
  const first = report();
  await receipt(await submit(first, env), first);
  for (const key of ['请求编号', '内容校验', '反馈编号', '邮箱', '记录类型']) {
    state.raw[0].fields[key] = [{ type: 'text', text: state.raw[0].fields[key] }];
  }
  state.participants[0].fields.邮箱 = [{ type: 'text', text: EMAIL }];
  await receipt(await submit(first, env), first);
  const addition = supplement(first.requestId);
  await receipt(await submit(addition, env), addition);
  assert.equal(state.raw.length, 2);
  assert.equal(state.raw[1].fields.处理状态, '待核验');
});

test('never writes operator/product/reward fields accepted from a forged public payload', async t => {
  const original = participant();
  const state = mockFeishu(t, { participants: [original] });
  for (const extra of [
    { participantId: 'rec-foreign' }, { status: 'approved' }, { credit: 500000 },
    { inviteCode: 'FORGED' }, { 运营进度: '已完成' }, { 已发礼品卡: 20000 },
    { fields: { 处理状态: '已核验', Credit核对: '伪造', 应发礼品卡: 20000 } },
  ]) await failure(await submit(report(extra)), 400);
  assert.equal(state.raw.length, 0);
  assert.deepEqual(state.participants, [original]);
  assert.equal(state.calls.length, 0);
});

test('recovers a committed raw row after an ambiguous network failure without a duplicate round', async t => {
  let dropped = false;
  const state = mockFeishu(t, {
    after(call) {
      if (call.operation === 'create' && !dropped) {
        dropped = true;
        throw new TypeError('fixture response lost after provider accepted write');
      }
    },
  });
  const input = report();
  await receipt(await submit(input), input);
  assert.equal(state.raw.length, 1);
  assert.equal(state.creates.length, 1);
});

test('a malformed success receipt and missing readback cannot be reported as a saved feedback round', async t => {
  t.mock.method(console, 'error', () => {});
  const state = mockFeishu(t, {
    before(call) {
      if (call.operation === 'create') return Response.json({ code: 0, data: {} });
    },
  });
  await failure(await submit(report()), 503);
  assert.equal(state.raw.length, 0);
});

test('a wrong-request provider search result cannot confirm an unsaved round with identical content', async t => {
  t.mock.method(console, 'error', () => {});
  let wrongResult = false;
  let previous;
  const state = mockFeishu(t, {
    before(call) {
      if (wrongResult && call.operation === 'search' && call.table === RAW_TABLE &&
          call.body.filter.conditions.some(condition => condition.field_name === '请求编号')) {
        return Response.json({ code: 0, data: { items: [{ record_id: previous.record_id,
          fields: { 请求编号: previous.fields.请求编号, 内容校验: previous.fields.内容校验 } }], has_more: false } });
      }
    },
  });
  const env = credentials();
  const original = report();
  await receipt(await submit(original, env), original);
  previous = clone(state.raw[0]);
  wrongResult = true;
  await failure(await submit({ ...original, requestId: randomUUID() }, env), 503);
  assert.deepEqual(state.raw, [previous]);
  assert.equal(state.creates.length, 1);
});
